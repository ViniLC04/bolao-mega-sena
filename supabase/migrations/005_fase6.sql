-- =====================================================================================================
-- Bolão da Mega da Virada — banco da Fase 6: link público por bolão
--
-- COMO USAR: SQL Editor → New query → cole TUDO → Run. Rode DEPOIS de 001 a 004. Pode rodar mais de uma vez.
--
-- O QUE FAZ: cada bolão pode ter UM link público secreto. Quem tem o link vê: o resumo do bolão (totais),
-- a lista de PRIMEIROS NOMES com as cotas de cada um e os jogos (se o bolão já estiver congelado).
-- NUNCA saem do banco: sobrenome, contato, quem pagou ou deve. Token errado ou link desligado = nada.
-- (A regra "o público nunca vê nomes" mudou por decisão do organizador: agora só com o link secreto do bolão,
--  e só o primeiro nome. A página geral e publico_boloes() continuam sem nenhum nome.)
-- =====================================================================================================

-- O link fica numa tabela PRÓPRIA (e não na linha do bolão) porque bolão congelado não pode mais ser alterado,
-- mas o organizador precisa poder ligar, desligar e renovar o link depois.
create table if not exists public.bolao_links (
  bolao_id      uuid primary key references public.bolaos (id) on delete cascade,
  token         text not null unique check (token ~ '^[0-9a-f]{64}$'),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.bolao_links enable row level security;
alter table public.bolao_links force row level security;
drop policy if exists bolao_links_adm on public.bolao_links;
create policy bolao_links_adm on public.bolao_links for all to authenticated using (public.is_adm()) with check (public.is_adm());
revoke all on public.bolao_links from anon, authenticated;
grant select, insert, update, delete on public.bolao_links to authenticated;
grant all on public.bolao_links to service_role;

-- A auditoria também guarda o bolão do registro (o segredo do link é ocultado na tela de auditoria).
create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  reg   record;
  v_det jsonb;
begin
  if tg_op = 'DELETE' then reg := old; else reg := new; end if;
  v_det := to_jsonb(reg) - 'regras_snapshot';
  insert into public.auditoria (usuario, acao, tabela, registro, detalhe)
  values (auth.uid(), tg_op, tg_table_name,
          coalesce(v_det ->> 'id', v_det ->> 'chave', v_det ->> 'user_id', v_det ->> 'numero', v_det ->> 'bolao_id'), v_det);
  return null;
end;
$$;
revoke all on function public.auditar() from public, anon, authenticated;

drop trigger if exists t_audit_bolao_links on public.bolao_links;
create trigger t_audit_bolao_links after insert or update or delete on public.bolao_links
  for each row execute function public.auditar();

-- ---------- Funções públicas (só com o token certo de um link ligado) ----------

-- Resumo do bolão: só totais.
create or replace function public.publico_bolao(p_token text) returns table (
  bolao_id uuid, nome text, concurso_alvo int, n_cotas int, cota_cent bigint, status text, congelado_em timestamptz, hash text,
  jogos int, custo_cent bigint,
  cotas_vendidas int, cotas_pagas int, previsto_cent bigint, arrecadado_cent bigint, vias_entregues int
)
language sql stable security definer set search_path = public as $$
  select b.id, b.nome, b.concurso_alvo, b.n_cotas,
         nullif(b.regras_snapshot -> 'plano' ->> 'cotaCobradaCent', '')::bigint,
         b.status, b.congelado_em, b.hash,
         (select count(*) from public.jogos j join public.recibos r on r.id = j.recibo_id where r.bolao_id = b.id)::int,
         (select coalesce(sum(r.total_cent), 0) from public.recibos r where r.bolao_id = b.id)::bigint,
         coalesce(c.vendidas, 0)::int, coalesce(c.pagas, 0)::int,
         coalesce(c.previsto, 0)::bigint, coalesce(c.arrecadado, 0)::bigint, coalesce(c.vias, 0)::int
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

-- Quem está no bolão: SÓ o primeiro nome e as cotas. Homônimos viram "Ana (1)" e "Ana (2)". Sem contato, sem pagamento.
create or replace function public.publico_bolao_participantes(p_token text) returns table (nome text, qtd int)
language sql stable security definer set search_path = public as $$
  with base as (
    select left(split_part(btrim(p.nome), ' ', 1), 30) as primeiro, c.qtd, c.criado_em, p.id
    from public.bolao_links l
    join public.cotas c on c.bolao_id = l.bolao_id
    join public.participantes p on p.id = c.participante_id
    where l.ativo and length(coalesce(p_token, '')) = 64 and l.token = p_token
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

-- Jogos do bolão: só depois de congelado.
create or replace function public.publico_bolao_jogos(p_token text) returns table (
  recibo_ordem smallint, k smallint, g smallint, jogo_ordem smallint, dezenas smallint[]
)
language sql stable security definer set search_path = public as $$
  select r.ordem, r.k, r.g, j.ordem, j.dezenas
  from public.bolao_links l
  join public.bolaos b on b.id = l.bolao_id and b.status = 'congelado'
  join public.recibos r on r.bolao_id = b.id
  join public.jogos j on j.recibo_id = r.id
  where l.ativo and length(coalesce(p_token, '')) = 64 and l.token = p_token
  order by r.ordem, j.ordem
$$;

revoke all on function public.publico_bolao(text)               from public, anon, authenticated;
revoke all on function public.publico_bolao_participantes(text) from public, anon, authenticated;
revoke all on function public.publico_bolao_jogos(text)         from public, anon, authenticated;
grant execute on function public.publico_bolao(text)               to anon, authenticated, service_role;
grant execute on function public.publico_bolao_participantes(text) to anon, authenticated, service_role;
grant execute on function public.publico_bolao_jogos(text)         to anon, authenticated, service_role;
