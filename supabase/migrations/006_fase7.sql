-- =====================================================================================================
-- Bolão da Mega da Virada — banco da Fase 7: bolão ABERTO (inscrições sem número de cotas definido)
--
-- COMO USAR: SQL Editor → New query → cole TUDO → Run. Rode DEPOIS de 001 a 005. Pode rodar mais de uma vez.
--
-- O QUE FAZ
--   * Um bolão pode nascer "aberto": só com o valor da cota e a data limite de inscrição, SEM número de cotas (N)
--     e sem jogos. As pessoas entram conforme confirmam.
--   * Depois da data, o ADM FECHA as inscrições: N passa a ser o total de cotas cadastradas, o bolão vira
--     "rascunho" (com N) e segue o caminho de sempre: simular, gerar os jogos, congelar.
--   * Enquanto aberto, o banco recusa cota nova depois da data de inscrição (o ADM pode prorrogar a data).
--   * Os links públicos (do bolão e pessoal) passam a aceitar bolão aberto (N vazio).
-- =====================================================================================================

-- ---------- Colunas e regras do bolão ----------
alter table public.bolaos alter column n_cotas drop not null;
alter table public.bolaos add column if not exists inscricoes_ate timestamptz;
alter table public.bolaos add column if not exists inscricoes_encerradas_em timestamptz;

alter table public.bolaos drop constraint if exists bolaos_status_check;
alter table public.bolaos add constraint bolaos_status_check check (status in ('aberto', 'rascunho', 'congelado'));
-- só o bolão aberto pode ficar sem N
alter table public.bolaos drop constraint if exists bolao_com_n;
alter table public.bolaos add constraint bolao_com_n check (status = 'aberto' or n_cotas is not null);

-- ---------- Cotas: limite de N só quando N existe; data de inscrição só no bolão aberto ----------
create or replace function public.cotas_validar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_bolao     public.bolaos%rowtype;
  v_vendidas  bigint;
  v_limite    timestamptz;
begin
  -- trava a linha do bolão para duas vendas ao mesmo tempo não furarem o limite
  select * into v_bolao from public.bolaos where id = new.bolao_id for update;
  if not found then
    raise exception 'Bolão não encontrado.' using errcode = 'P0002';
  end if;

  select coalesce(sum(qtd), 0) into v_vendidas from public.cotas where bolao_id = new.bolao_id and id <> new.id;
  if v_bolao.n_cotas is not null and v_vendidas + new.qtd > v_bolao.n_cotas then
    raise exception 'Cotas demais: o bolão tem % cota(s) e já há % vendida(s).', v_bolao.n_cotas, v_vendidas using errcode = 'P0001';
  end if;

  -- Cota nova (ou aumento de quantidade) só até as datas limite. Marcar pago/via entregue continua livre.
  if tg_op = 'INSERT' or new.qtd > old.qtd then
    if v_bolao.status = 'aberto' and v_bolao.inscricoes_ate is not null and now() > v_bolao.inscricoes_ate then
      raise exception 'As inscrições deste bolão encerraram em %. Para incluir mais cotas, prorrogue a data de inscrição do bolão.',
        to_char(v_bolao.inscricoes_ate at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') using errcode = 'P0001';
    end if;
    v_limite := public.data_limite_vigente();
    if v_limite is not null and now() > v_limite then
      raise exception 'A data limite de aposta já passou (%). Para prorrogar, crie uma nova versão das regras com outra data limite.',
        to_char(v_limite at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.cotas_validar() from public, anon, authenticated;
grant execute on function public.cotas_validar() to service_role;

-- Um número inteiro das regras vigentes (ex.: bolao_cotas_min), com valor padrão se as regras não estiverem no banco.
create or replace function public.regra_inteira(p_chave text, p_padrao int) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(json -> 'params' ->> p_chave, '')::int
       from public.rules_versions
      where vigencia_inicio <= (now() at time zone 'America/Sao_Paulo')::date
      order by vigencia_inicio desc limit 1),
    p_padrao)
$$;
revoke all on function public.regra_inteira(text, int) from public, anon, authenticated;
grant execute on function public.regra_inteira(text, int) to service_role;

-- ---------- Fechar e reabrir as inscrições (só o ADM) ----------
create or replace function public.fechar_inscricoes(p_bolao uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_status   text;
  v_vendidas int;
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
  select coalesce(sum(qtd), 0) into v_vendidas from public.cotas where bolao_id = p_bolao;
  if v_vendidas < v_min or v_vendidas > v_max then
    raise exception 'O bolão precisa ter de % a % cotas para fechar (hoje tem %).', v_min, v_max, v_vendidas using errcode = 'P0001';
  end if;
  update public.bolaos set n_cotas = v_vendidas, status = 'rascunho', inscricoes_encerradas_em = now() where id = p_bolao;
  return jsonb_build_object('n_cotas', v_vendidas);
end;
$$;

create or replace function public.reabrir_inscricoes(p_bolao uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_b public.bolaos%rowtype;
begin
  if not public.is_adm() then
    raise exception 'Acesso negado: só o ADM pode reabrir as inscrições.' using errcode = '42501';
  end if;
  select * into v_b from public.bolaos where id = p_bolao for update;
  if not found then
    raise exception 'Bolão não encontrado.' using errcode = 'P0002';
  end if;
  if v_b.status <> 'rascunho' or v_b.inscricoes_encerradas_em is null then
    raise exception 'Só dá para reabrir um bolão que foi aberto e fechado e ainda não foi congelado.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.recibos where bolao_id = p_bolao) then
    raise exception 'Este bolão já tem jogos salvos. Apague o rascunho dos jogos antes de reabrir as inscrições.' using errcode = 'P0001';
  end if;
  update public.bolaos set n_cotas = null, status = 'aberto', inscricoes_encerradas_em = null where id = p_bolao;
  return jsonb_build_object('reaberto', true);
end;
$$;

revoke all on function public.fechar_inscricoes(uuid)  from public, anon, authenticated;
revoke all on function public.reabrir_inscricoes(uuid) from public, anon, authenticated;
grant execute on function public.fechar_inscricoes(uuid)  to authenticated, service_role;
grant execute on function public.reabrir_inscricoes(uuid) to authenticated, service_role;

-- ---------- Funções públicas: aceitam bolão aberto (N vazio) e devolvem a data de inscrição ----------
drop function if exists public.publico_bolao(text);
create function public.publico_bolao(p_token text) returns table (
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
           sum(qtd) filter (where pago) as pagas,
           sum(valor_devido_cent) as previsto,
           sum(valor_devido_cent) filter (where pago) as arrecadado,
           sum(qtd) filter (where via_entregue) as vias
    from public.cotas where bolao_id = b.id
  ) c on true
  where l.ativo and length(coalesce(p_token, '')) = 64 and l.token = p_token
$$;
revoke all on function public.publico_bolao(text) from public, anon, authenticated;
grant execute on function public.publico_bolao(text) to anon, authenticated, service_role;

drop function if exists public.publico_participante(text);
create function public.publico_participante(p_token text) returns table (
  participante text, bolao_id uuid, bolao_nome text, concurso_alvo int, n_cotas int, status text, congelado_em timestamptz, hash text,
  qtd int, valor_devido_cent bigint, pago boolean, via_entregue boolean, custo_cent bigint, cota_cent bigint,
  inscricoes_ate timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.nome, b.id, b.nome, b.concurso_alvo, b.n_cotas, b.status, b.congelado_em, b.hash,
         c.qtd, c.valor_devido_cent, c.pago, c.via_entregue,
         (select coalesce(sum(r.total_cent), 0) from public.recibos r where r.bolao_id = b.id)::bigint,
         coalesce(nullif(b.regras_snapshot -> 'plano' ->> 'cotaCobradaCent', '')::bigint, b.cota_base_cent),
         b.inscricoes_ate
  from public.participantes p
  join public.cotas c on c.participante_id = p.id
  join public.bolaos b on b.id = c.bolao_id
  where p.link_ativo and p.link_token is not null and length(coalesce(p_token, '')) = 64 and p.link_token = p_token
  order by b.criado_em desc
$$;
revoke all on function public.publico_participante(text) from public, anon, authenticated;
grant execute on function public.publico_participante(text) to anon, authenticated, service_role;
