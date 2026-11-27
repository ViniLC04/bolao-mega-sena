-- =====================================================================================================
-- Bolão da Mega da Virada — banco da Fase 8: autoatendimento pelo link do bolão (inscrição, PIX, comprovante)
--
-- COMO USAR: SQL Editor → New query → cole TUDO → Run. Rode DEPOIS de 001 a 006. Pode rodar mais de uma vez.
--
-- O QUE FAZ
--   * Cada cota passa a ter "qtd_paga" (quantas cotas já têm o PIX confirmado pelo ORGANIZADOR). "pago" vira derivado.
--   * O público, com o link secreto do bolão (e se o ADM ligou a inscrição), pode: se inscrever (nome + WhatsApp +
--     1 a 10 cotas), e, com o link PESSOAL que recebe, AUMENTAR as cotas (nunca diminuir), ver o PIX do organizador
--     e enviar o comprovante. Tudo validado AQUI no servidor, com limite de tentativas.
--   * Inscrição pelo link só vale como cota depois que o ADM confirma o pagamento: pendente não aparece na lista pública.
--   * Fechar as inscrições conta só as cotas pagas (as pendentes são descartadas, com confirmação do ADM).
--   * NÃO há integração com banco: o app só mostra o PIX; quem confirma que o dinheiro caiu é o ADM.
-- =====================================================================================================

-- ---------- Cotas: quantidade paga e origem ----------
alter table public.cotas add column if not exists qtd_paga int not null default 0;

-- Migra o "pago" de hoje (verdadeiro/falso) para a quantidade paga e troca "pago" por uma coluna derivada.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'cotas' and column_name = 'pago' and is_generated = 'NEVER') then
    update public.cotas set qtd_paga = qtd where pago;
    alter table public.cotas drop column pago;
  end if;
end
$$;
alter table public.cotas add column if not exists pago boolean generated always as (qtd_paga >= qtd) stored;
alter table public.cotas drop constraint if exists cotas_qtd_paga_valida;
alter table public.cotas add constraint cotas_qtd_paga_valida check (qtd_paga >= 0 and qtd_paga <= qtd);

alter table public.cotas add column if not exists origem text not null default 'adm';
alter table public.cotas drop constraint if exists cotas_origem_valida;
alter table public.cotas add constraint cotas_origem_valida check (origem in ('adm', 'link'));

-- WhatsApp só com números, para achar repetidos
alter table public.participantes add column if not exists contato_digitos text generated always as (regexp_replace(coalesce(contato, ''), '\D', '', 'g')) stored;

-- ---------- Link do bolão: liga/desliga a inscrição e limite por pessoa ----------
alter table public.bolao_links add column if not exists autoinscricao boolean not null default false;
alter table public.bolao_links add column if not exists max_cotas_pessoa int not null default 10;
alter table public.bolao_links drop constraint if exists bolao_links_max_valido;
alter table public.bolao_links add constraint bolao_links_max_valido check (max_cotas_pessoa between 1 and 100);

-- ---------- Registro das tentativas de inscrição (limite por hora) e comprovantes ----------
create table if not exists public.inscricoes_log (
  id        bigint generated always as identity primary key,
  quando    timestamptz not null default now(),
  bolao_id  uuid not null references public.bolaos (id) on delete cascade,
  resultado text not null
);
create index if not exists inscricoes_log_idx on public.inscricoes_log (bolao_id, quando);
alter table public.inscricoes_log enable row level security;
alter table public.inscricoes_log force row level security;
revoke all on public.inscricoes_log from anon, authenticated;
grant all on public.inscricoes_log to service_role;

create table if not exists public.comprovantes (
  id           uuid primary key default gen_random_uuid(),
  cota_id      uuid not null references public.cotas (id) on delete cascade,
  caminho      text not null unique,
  nome_arquivo text,
  criado_em    timestamptz not null default now()
);
create index if not exists comprovantes_cota_idx on public.comprovantes (cota_id);
alter table public.comprovantes enable row level security;
alter table public.comprovantes force row level security;
drop policy if exists comprovantes_adm on public.comprovantes;
create policy comprovantes_adm on public.comprovantes for all to authenticated using (public.is_adm()) with check (public.is_adm());
revoke all on public.comprovantes from anon, authenticated;
grant select, insert, update, delete on public.comprovantes to authenticated;
grant all on public.comprovantes to service_role;

drop trigger if exists t_audit_comprovantes on public.comprovantes;
create trigger t_audit_comprovantes after insert or update or delete on public.comprovantes
  for each row execute function public.auditar();

-- ---------- Armazenamento privado dos comprovantes ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Funções de apoio das regras do armazenamento (o primeiro pedaço do caminho é o token pessoal)
create or replace function public.token_pessoal_valido(p_token text) returns boolean
language sql stable security definer set search_path = public as $$
  select length(coalesce(p_token, '')) = 64
     and exists (select 1 from public.participantes p where p.link_ativo and p.link_token = p_token)
$$;
create or replace function public.comprovantes_enviados(p_token text) returns int
language sql stable security definer set search_path = public, storage as $$
  select count(*)::int from storage.objects o where o.bucket_id = 'comprovantes' and o.name like p_token || '/%'
$$;
revoke all on function public.token_pessoal_valido(text) from public, anon, authenticated;
revoke all on function public.comprovantes_enviados(text) from public, anon, authenticated;
grant execute on function public.token_pessoal_valido(text) to anon, authenticated, service_role;
grant execute on function public.comprovantes_enviados(text) to anon, authenticated, service_role;

drop policy if exists comprovantes_adm_ler on storage.objects;
create policy comprovantes_adm_ler on storage.objects for select to authenticated using (bucket_id = 'comprovantes' and public.is_adm());
drop policy if exists comprovantes_adm_apagar on storage.objects;
create policy comprovantes_adm_apagar on storage.objects for delete to authenticated using (bucket_id = 'comprovantes' and public.is_adm());
-- Enviar: só quem tem um link pessoal válido, só dentro da pasta do próprio token, até 3 arquivos. Nunca ler nem trocar.
drop policy if exists comprovantes_enviar on storage.objects;
create policy comprovantes_enviar on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'comprovantes'
    and public.token_pessoal_valido(split_part(name, '/', 1))
    and public.comprovantes_enviados(split_part(name, '/', 1)) < 3
  );

-- ---------- Apoio ----------
-- WhatsApp: só números (10 ou 11, com DDD); tira o 55 do país. Devolve null se não servir.
create or replace function public.normalizar_whatsapp(p_texto text) returns text
language sql immutable as $$
  select case
    when length(d) in (10, 11) then d
    when d like '55%' and length(d) in (12, 13) then substr(d, 3)
    else null
  end
  from (select regexp_replace(coalesce(p_texto, ''), '\D', '', 'g') as d) t
$$;

-- ---------- Inscrição pelo link do bolão ----------
create or replace function public.inscrever_no_bolao(p_token text, p_nome text, p_whatsapp text, p_qtd int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_l      public.bolao_links%rowtype;
  v_b      public.bolaos%rowtype;
  v_nome   text := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  v_zap    text := public.normalizar_whatsapp(p_whatsapp);
  v_erro   text;
  v_total  bigint;
  v_cap    int := public.regra_inteira('bolao_cotas_max', 100);
  v_limite timestamptz;
  v_tok    text;
  v_p      uuid;
begin
  select * into v_l from public.bolao_links where length(coalesce(p_token, '')) = 64 and token = p_token and ativo;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Este link não é válido ou foi desligado.');
  end if;
  select * into v_b from public.bolaos where id = v_l.bolao_id for update;

  if (select count(*) from public.inscricoes_log where bolao_id = v_b.id and quando > now() - interval '1 hour' and resultado = 'ok') >= 40
     or (select count(*) from public.inscricoes_log where bolao_id = v_b.id and quando > now() - interval '10 minutes' and resultado <> 'ok') >= 30 then
    return jsonb_build_object('ok', false, 'erro', 'Muitas inscrições seguidas. Espere um pouco e tente de novo, ou fale com o organizador.');
  end if;

  v_limite := public.data_limite_vigente();
  select coalesce(sum(qtd), 0) into v_total from public.cotas where bolao_id = v_b.id;

  v_erro := case
    when not v_l.autoinscricao then 'As inscrições por este link estão desligadas. Fale com o organizador.'
    when v_b.status <> 'aberto' then 'As inscrições deste bolão já foram fechadas.'
    when v_b.inscricoes_ate is not null and now() > v_b.inscricoes_ate then
      'As inscrições deste bolão terminaram em ' || to_char(v_b.inscricoes_ate at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '.'
    when v_limite is not null and now() > v_limite then 'O prazo das apostas já passou.'
    when v_b.cota_base_cent is null or v_b.cota_base_cent <= 0 then 'Este bolão ainda não tem o valor da cota definido.'
    when length(v_nome) < 5 or length(v_nome) > 80 or v_nome !~ '^[[:alpha:]][[:alpha:] ''.-]*$' or position(' ' in v_nome) = 0 then
      'Informe o seu nome completo (nome e sobrenome, só letras).'
    when v_zap is null then 'Informe um WhatsApp com DDD (10 ou 11 números).'
    when p_qtd is null or p_qtd < 1 or p_qtd > v_l.max_cotas_pessoa then
      'Você pode pedir de 1 a ' || v_l.max_cotas_pessoa || ' cotas.'
    when v_total + p_qtd > v_cap then 'O bolão está lotado: o máximo é de ' || v_cap || ' cotas.'
    when exists (select 1 from public.cotas c join public.participantes p on p.id = c.participante_id
                  where c.bolao_id = v_b.id and p.contato_digitos in (v_zap, '55' || v_zap)) then
      'Este WhatsApp já está inscrito neste bolão. Use o link pessoal que você recebeu; se perdeu, fale com o organizador.'
    else null
  end;
  if v_erro is not null then
    insert into public.inscricoes_log (bolao_id, resultado) values (v_b.id, 'recusado');
    return jsonb_build_object('ok', false, 'erro', v_erro);
  end if;

  v_tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.participantes (nome, contato, link_token, link_ativo) values (v_nome, v_zap, v_tok, true) returning id into v_p;
  insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent, qtd_paga, origem)
  values (v_p, v_b.id, p_qtd, p_qtd * v_b.cota_base_cent, 0, 'link');
  insert into public.inscricoes_log (bolao_id, resultado) values (v_b.id, 'ok');
  return jsonb_build_object('ok', true, 'token', v_tok, 'qtd', p_qtd, 'valor_cent', p_qtd * v_b.cota_base_cent);
exception when others then
  if v_b.id is not null then
    insert into public.inscricoes_log (bolao_id, resultado) values (v_b.id, 'recusado');
  end if;
  return jsonb_build_object('ok', false, 'erro', 'Não consegui fazer a inscrição agora. Tente de novo.');
end;
$$;

-- ---------- Aumentar as próprias cotas (nunca diminuir) ----------
create or replace function public.aumentar_minhas_cotas(p_token text, p_bolao uuid, p_nova_qtd int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_p      public.participantes%rowtype;
  v_c      public.cotas%rowtype;
  v_b      public.bolaos%rowtype;
  v_l      public.bolao_links%rowtype;
  v_erro   text;
  v_total  bigint;
  v_cap    int := public.regra_inteira('bolao_cotas_max', 100);
  v_limite timestamptz;
begin
  select * into v_p from public.participantes where length(coalesce(p_token, '')) = 64 and link_token = p_token and link_ativo;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Este link não é válido ou foi desligado.');
  end if;
  select * into v_b from public.bolaos where id = p_bolao for update;
  select * into v_c from public.cotas where participante_id = v_p.id and bolao_id = p_bolao for update;
  select * into v_l from public.bolao_links where bolao_id = p_bolao;
  if v_c.id is null or v_b.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Você não está neste bolão.');
  end if;
  select coalesce(sum(qtd), 0) into v_total from public.cotas where bolao_id = p_bolao;
  v_limite := public.data_limite_vigente();

  v_erro := case
    when v_l.bolao_id is null or not v_l.autoinscricao then 'Aumentar as cotas por aqui está desligado. Fale com o organizador.'
    when v_b.status <> 'aberto' then 'As inscrições deste bolão já foram fechadas.'
    when v_b.inscricoes_ate is not null and now() > v_b.inscricoes_ate then 'As inscrições deste bolão já terminaram.'
    when v_limite is not null and now() > v_limite then 'O prazo das apostas já passou.'
    when p_nova_qtd is null or p_nova_qtd <= v_c.qtd then 'Só dá para aumentar: informe uma quantidade maior que a atual (' || v_c.qtd || '). Para diminuir, fale com o organizador.'
    when p_nova_qtd > v_l.max_cotas_pessoa then 'O máximo por pessoa é de ' || v_l.max_cotas_pessoa || ' cotas.'
    when v_total - v_c.qtd + p_nova_qtd > v_cap then 'O bolão está lotado: o máximo é de ' || v_cap || ' cotas.'
    else null
  end;
  if v_erro is not null then
    return jsonb_build_object('ok', false, 'erro', v_erro);
  end if;

  update public.cotas set qtd = p_nova_qtd, valor_devido_cent = p_nova_qtd * v_b.cota_base_cent where id = v_c.id;
  return jsonb_build_object('ok', true, 'qtd', p_nova_qtd, 'a_pagar_cent', (p_nova_qtd - v_c.qtd_paga) * v_b.cota_base_cent);
exception when others then
  return jsonb_build_object('ok', false, 'erro', 'Não consegui aumentar as cotas agora. Tente de novo.');
end;
$$;

-- ---------- PIX do organizador: só para quem tem link pessoal com pagamento pendente ----------
create or replace function public.publico_recebimento(p_token text) returns table (tipo text, chave text, nome text, cidade text, whatsapp text)
language sql stable security definer set search_path = public as $$
  select r.valor ->> 'tipo', r.valor ->> 'chave', r.valor ->> 'nome', r.valor ->> 'cidade', r.valor ->> 'whatsapp'
  from public.config r
  where r.chave = 'recebimento'
    and public.token_pessoal_valido(p_token)
    and exists (
      select 1 from public.participantes p
      join public.cotas c on c.participante_id = p.id
      where p.link_token = p_token and p.link_ativo and c.qtd_paga < c.qtd
    )
$$;

-- ---------- Comprovante enviado pela pessoa (o arquivo já foi para o armazenamento privado) ----------
create or replace function public.enviar_comprovante(p_token text, p_bolao uuid, p_caminho text, p_nome text) returns jsonb
language plpgsql security definer set search_path = public, storage as $$
declare
  v_c public.cotas%rowtype;
begin
  select c.* into v_c
  from public.participantes p
  join public.cotas c on c.participante_id = p.id and c.bolao_id = p_bolao
  where length(coalesce(p_token, '')) = 64 and p.link_token = p_token and p.link_ativo;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Este link não é válido ou você não está neste bolão.');
  end if;
  if p_caminho is null or p_caminho not like p_token || '/%' or length(p_caminho) > 200
     or not exists (select 1 from storage.objects o where o.bucket_id = 'comprovantes' and o.name = p_caminho) then
    return jsonb_build_object('ok', false, 'erro', 'Arquivo não encontrado. Tente enviar de novo.');
  end if;
  if (select count(*) from public.comprovantes where cota_id = v_c.id) >= 3 then
    return jsonb_build_object('ok', false, 'erro', 'Você já enviou 3 comprovantes. Mande o resto pelo WhatsApp.');
  end if;
  insert into public.comprovantes (cota_id, caminho, nome_arquivo) values (v_c.id, p_caminho, left(coalesce(p_nome, ''), 120))
  on conflict (caminho) do nothing;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- Fechar inscrições: só as cotas PAGAS entram; as pendentes são descartadas (com confirmação) ----------
drop function if exists public.fechar_inscricoes(uuid);
create or replace function public.fechar_inscricoes(p_bolao uuid, p_descartar boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_status   text;
  v_pagas    int;
  v_pend     int;
  v_min      int := public.regra_inteira('bolao_cotas_min', 2);
  v_max      int := public.regra_inteira('bolao_cotas_max', 100);
begin
  if not public.is_adm() then
    raise exception 'Acesso negado: só o ADM pode fechar as inscrições.' using errcode = '42501';
  end if;
  select status into v_status from public.bolaos where id = p_bolao for update;
  if v_status is null then
    raise exception 'Bolão não encontrado.' using errcode = 'P0002';
  end if;
  if v_status <> 'aberto' then
    raise exception 'Este bolão não está com as inscrições abertas.' using errcode = 'P0001';
  end if;
  select coalesce(sum(qtd_paga), 0), coalesce(sum(qtd - qtd_paga), 0) into v_pagas, v_pend from public.cotas where bolao_id = p_bolao;
  if v_pend > 0 and not p_descartar then
    raise exception 'Há % cota(s) sem pagamento confirmado. Confirme os pagamentos ou aceite descartar as pendentes.', v_pend using errcode = 'P0001';
  end if;
  if v_pagas < v_min or v_pagas > v_max then
    raise exception 'O bolão precisa ter de % a % cotas pagas para fechar (hoje tem %).', v_min, v_max, v_pagas using errcode = 'P0001';
  end if;
  if v_pend > 0 then
    delete from public.cotas where bolao_id = p_bolao and qtd_paga = 0;
    update public.cotas set valor_devido_cent = valor_devido_cent * qtd_paga / qtd, qtd = qtd_paga where bolao_id = p_bolao and qtd_paga < qtd;
  end if;
  update public.bolaos set n_cotas = v_pagas, status = 'rascunho', inscricoes_encerradas_em = now() where id = p_bolao;
  return jsonb_build_object('n_cotas', v_pagas, 'descartadas', v_pend);
end;
$$;

-- ---------- Funções públicas que olham pagamento: agora por quantidade paga ----------
create or replace function public.publico_boloes() returns table (
  id uuid, nome text, concurso_alvo int, n_cotas int, cota_cent bigint, congelado_em timestamptz, hash text,
  jogos int, custo_cent bigint,
  cotas_vendidas int, cotas_pagas int, arrecadado_cent bigint, vias_entregues int
)
language sql stable security definer set search_path = public as $$
  select b.id, b.nome, b.concurso_alvo, b.n_cotas,
         nullif(b.regras_snapshot -> 'plano' ->> 'cotaCobradaCent', '')::bigint,
         b.congelado_em, b.hash,
         (select count(*) from public.jogos j join public.recibos r on r.id = j.recibo_id where r.bolao_id = b.id)::int,
         (select coalesce(sum(r.total_cent), 0) from public.recibos r where r.bolao_id = b.id)::bigint,
         coalesce(c.vendidas, 0)::int, coalesce(c.pagas, 0)::int, coalesce(c.arrecadado, 0)::bigint, coalesce(c.vias, 0)::int
  from public.bolaos b
  left join lateral (
    select sum(qtd) as vendidas,
           sum(qtd_paga) as pagas,
           sum(valor_devido_cent * qtd_paga / nullif(qtd, 0)) as arrecadado,
           sum(qtd) filter (where via_entregue) as vias
    from public.cotas where bolao_id = b.id
  ) c on true
  where b.status = 'congelado'
  order by b.congelado_em desc
$$;

create or replace function public.publico_bolao(p_token text) returns table (
  bolao_id uuid, nome text, concurso_alvo int, n_cotas int, cota_cent bigint, status text, congelado_em timestamptz, hash text,
  jogos int, custo_cent bigint,
  cotas_vendidas int, cotas_pagas int, previsto_cent bigint, arrecadado_cent bigint, vias_entregues int,
  inscricoes_ate timestamptz
)
language sql stable security definer set search_path = public as $$
  select b.id, b.nome, b.concurso_alvo, b.n_cotas,
         coalesce(nullif(b.regras_snapshot -> 'plano' ->> 'cotaCobradaCent', '')::bigint, b.cota_base_cent),
         b.status, b.congelado_em, b.hash,
         (select count(*) from public.jogos j join public.recibos r on r.id = j.recibo_id where r.bolao_id = b.id)::int,
         (select coalesce(sum(r.total_cent), 0) from public.recibos r where r.bolao_id = b.id)::bigint,
         coalesce(c.vendidas, 0)::int, coalesce(c.pagas, 0)::int,
         coalesce(c.previsto, 0)::bigint, coalesce(c.arrecadado, 0)::bigint, coalesce(c.vias, 0)::int,
         b.inscricoes_ate
  from public.bolao_links l
  join public.bolaos b on b.id = l.bolao_id
  left join lateral (
    select sum(qtd) as vendidas,
           sum(qtd_paga) as pagas,
           sum(valor_devido_cent) as previsto,
           sum(valor_devido_cent * qtd_paga / nullif(qtd, 0)) as arrecadado,
           sum(qtd) filter (where via_entregue) as vias
    from public.cotas where bolao_id = b.id
  ) c on true
  where l.ativo and length(coalesce(p_token, '')) = 64 and l.token = p_token
$$;

-- Quem está no bolão: primeiro nome + cotas. Quem se inscreveu pelo link só aparece DEPOIS de ter pago (confirmado).
create or replace function public.publico_bolao_participantes(p_token text) returns table (nome text, qtd int)
language sql stable security definer set search_path = public as $$
  with base as (
    select left(split_part(btrim(p.nome), ' ', 1), 30) as primeiro, c.qtd, c.criado_em, p.id
    from public.bolao_links l
    join public.cotas c on c.bolao_id = l.bolao_id
    join public.participantes p on p.id = c.participante_id
    where l.ativo and length(coalesce(p_token, '')) = 64 and l.token = p_token
      and (c.origem = 'adm' or c.qtd_paga > 0)
  ),
  numerado as (
    select primeiro, qtd,
           row_number() over (partition by lower(primeiro) order by criado_em, id) as n,
           count(*) over (partition by lower(primeiro)) as total
    from base
  )
  select case when total > 1 then primeiro || ' (' || n || ')' else primeiro end, qtd::int
  from numerado
  order by qtd desc, primeiro, n
$$;

drop function if exists public.publico_participante(text);
create function public.publico_participante(p_token text) returns table (
  participante text, bolao_id uuid, bolao_nome text, concurso_alvo int, n_cotas int, status text, congelado_em timestamptz, hash text,
  qtd int, valor_devido_cent bigint, pago boolean, via_entregue boolean, custo_cent bigint, cota_cent bigint,
  inscricoes_ate timestamptz, qtd_paga int, aumentar_liberado boolean, max_cotas_pessoa int
)
language sql stable security definer set search_path = public as $$
  select p.nome, b.id, b.nome, b.concurso_alvo, b.n_cotas, b.status, b.congelado_em, b.hash,
         c.qtd, c.valor_devido_cent, c.pago, c.via_entregue,
         (select coalesce(sum(r.total_cent), 0) from public.recibos r where r.bolao_id = b.id)::bigint,
         coalesce(nullif(b.regras_snapshot -> 'plano' ->> 'cotaCobradaCent', '')::bigint, b.cota_base_cent),
         b.inscricoes_ate, c.qtd_paga,
         (coalesce(l.autoinscricao, false) and b.status = 'aberto'
            and (b.inscricoes_ate is null or now() <= b.inscricoes_ate)),
         coalesce(l.max_cotas_pessoa, 10)
  from public.participantes p
  join public.cotas c on c.participante_id = p.id
  join public.bolaos b on b.id = c.bolao_id
  left join public.bolao_links l on l.bolao_id = b.id and l.ativo
  where p.link_ativo and p.link_token is not null and length(coalesce(p_token, '')) = 64 and p.link_token = p_token
  order by b.criado_em desc
$$;

-- ---------- Permissões ----------
revoke all on function public.normalizar_whatsapp(text)                        from public, anon, authenticated;
revoke all on function public.inscrever_no_bolao(text, text, text, int)        from public, anon, authenticated;
revoke all on function public.aumentar_minhas_cotas(text, uuid, int)           from public, anon, authenticated;
revoke all on function public.publico_recebimento(text)                        from public, anon, authenticated;
revoke all on function public.enviar_comprovante(text, uuid, text, text)       from public, anon, authenticated;
revoke all on function public.fechar_inscricoes(uuid, boolean)                 from public, anon, authenticated;
revoke all on function public.publico_boloes()                                 from public, anon, authenticated;
revoke all on function public.publico_bolao(text)                              from public, anon, authenticated;
revoke all on function public.publico_bolao_participantes(text)                from public, anon, authenticated;
revoke all on function public.publico_participante(text)                       from public, anon, authenticated;

grant execute on function public.normalizar_whatsapp(text)                      to service_role;
grant execute on function public.inscrever_no_bolao(text, text, text, int)      to anon, authenticated, service_role;
grant execute on function public.aumentar_minhas_cotas(text, uuid, int)         to anon, authenticated, service_role;
grant execute on function public.publico_recebimento(text)                      to anon, authenticated, service_role;
grant execute on function public.enviar_comprovante(text, uuid, text, text)     to anon, authenticated, service_role;
grant execute on function public.fechar_inscricoes(uuid, boolean)               to authenticated, service_role;
grant execute on function public.publico_boloes()                               to anon, authenticated, service_role;
grant execute on function public.publico_bolao(text)                            to anon, authenticated, service_role;
grant execute on function public.publico_bolao_participantes(text)             to anon, authenticated, service_role;
grant execute on function public.publico_participante(text)                    to anon, authenticated, service_role;
