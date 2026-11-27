-- =====================================================================================================
-- Bolão da Mega da Virada — banco da Fase 3: participantes, cotas, pagamentos, caixinha e visão pública
--
-- COMO USAR: SQL Editor → New query → cole TUDO → Run. Rode DEPOIS de 001_fase2.sql.
-- Pode rodar mais de uma vez sem estragar nada.
--
-- REGRAS DE SEGURANÇA (SPEC seção 11):
--   * Nomes e contatos dos participantes, cotas e caixinha: SÓ o ADM lê e escreve (RLS + permissões).
--   * O público (anon) não tem permissão em NENHUMA tabela. Só executa duas funções que devolvem
--     TOTAIS e os jogos de bolões CONGELADOS, sem nomes.
--   * Regras no servidor: as cotas de um bolão nunca passam de N; cota nova depois da data limite é recusada.
-- =====================================================================================================

-- ---------- Tabelas ----------
create table if not exists public.participantes (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null check (length(btrim(nome)) between 1 and 120),
  contato   text check (contato is null or length(contato) <= 200),
  criado_em timestamptz not null default now()
);

create table if not exists public.cotas (
  id                uuid primary key default gen_random_uuid(),
  participante_id   uuid not null references public.participantes (id),
  bolao_id          uuid not null references public.bolaos (id),
  qtd               int not null check (qtd >= 1),
  valor_devido_cent bigint not null check (valor_devido_cent >= 0),
  pago              boolean not null default false,
  via_entregue      boolean not null default false,
  criado_em         timestamptz not null default now(),
  unique (participante_id, bolao_id)
);
create index if not exists cotas_bolao_idx on public.cotas (bolao_id);

-- Caixinha: lançamentos manuais (entrada positiva, saída negativa).
create table if not exists public.caixinha_mov (
  id        uuid primary key default gen_random_uuid(),
  bolao_id  uuid not null references public.bolaos (id),
  valor_cent bigint not null check (valor_cent <> 0),
  motivo    text not null check (length(btrim(motivo)) between 1 and 200),
  criado_em timestamptz not null default now()
);
create index if not exists caixinha_bolao_idx on public.caixinha_mov (bolao_id);

-- ---------- Regras no servidor ----------

-- Data limite vigente (da versão de regras em vigor hoje, horário de Brasília). Sem regras no banco = sem limite.
create or replace function public.data_limite_vigente() returns timestamptz
language sql stable security definer set search_path = public as $$
  select nullif(json -> 'params' ->> 'data_limite_aposta', '')::timestamptz
  from public.rules_versions
  where vigencia_inicio <= (now() at time zone 'America/Sao_Paulo')::date
  order by vigencia_inicio desc
  limit 1
$$;

create or replace function public.cotas_validar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_n         int;
  v_vendidas  bigint;
  v_limite    timestamptz;
begin
  -- trava a linha do bolão para duas vendas ao mesmo tempo não furarem o limite
  select n_cotas into v_n from public.bolaos where id = new.bolao_id for update;
  if v_n is null then
    raise exception 'Bolão não encontrado.' using errcode = 'P0002';
  end if;

  select coalesce(sum(qtd), 0) into v_vendidas from public.cotas where bolao_id = new.bolao_id and id <> new.id;
  if v_vendidas + new.qtd > v_n then
    raise exception 'Cotas demais: o bolão tem % cota(s) e já há % vendida(s).', v_n, v_vendidas using errcode = 'P0001';
  end if;

  -- Cota nova (ou aumento de quantidade) só até a data limite. Marcar pago/via entregue continua livre.
  if tg_op = 'INSERT' or new.qtd > old.qtd then
    v_limite := public.data_limite_vigente();
    if v_limite is not null and now() > v_limite then
      raise exception 'A data limite de aposta já passou (%). Para prorrogar, crie uma nova versão das regras com outra data limite.',
        to_char(v_limite at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists t_cotas_validar on public.cotas;
create trigger t_cotas_validar before insert or update on public.cotas
  for each row execute function public.cotas_validar();

-- Auditoria (reaproveita a função da Fase 2)
drop trigger if exists t_audit_participantes on public.participantes;
create trigger t_audit_participantes after insert or update or delete on public.participantes
  for each row execute function public.auditar();
drop trigger if exists t_audit_cotas on public.cotas;
create trigger t_audit_cotas after insert or update or delete on public.cotas
  for each row execute function public.auditar();
drop trigger if exists t_audit_caixinha on public.caixinha_mov;
create trigger t_audit_caixinha after insert or update or delete on public.caixinha_mov
  for each row execute function public.auditar();

-- ---------- RLS ----------
alter table public.participantes enable row level security;
alter table public.cotas         enable row level security;
alter table public.caixinha_mov  enable row level security;
alter table public.participantes force row level security;
alter table public.cotas         force row level security;
alter table public.caixinha_mov  force row level security;

drop policy if exists participantes_adm on public.participantes;
create policy participantes_adm on public.participantes for all to authenticated using (public.is_adm()) with check (public.is_adm());
drop policy if exists cotas_adm on public.cotas;
create policy cotas_adm on public.cotas for all to authenticated using (public.is_adm()) with check (public.is_adm());
drop policy if exists caixinha_adm on public.caixinha_mov;
create policy caixinha_adm on public.caixinha_mov for all to authenticated using (public.is_adm()) with check (public.is_adm());

-- ---------- Permissões: público sem nada; ADM (authenticated) com RLS por cima ----------
revoke all on public.participantes, public.cotas, public.caixinha_mov from anon, authenticated;
grant select, insert, update, delete on public.participantes, public.cotas, public.caixinha_mov to authenticated;
grant all on public.participantes, public.cotas, public.caixinha_mov to service_role; -- chave secreta: só servidor/testes

revoke all on function public.data_limite_vigente() from public, anon, authenticated;
revoke all on function public.cotas_validar()       from public, anon, authenticated;

-- ---------- Visão pública: só totais e jogos de bolões CONGELADOS, sem nenhum nome ----------
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
           sum(qtd) filter (where pago) as pagas,
           sum(valor_devido_cent) filter (where pago) as arrecadado,
           sum(qtd) filter (where via_entregue) as vias
    from public.cotas where bolao_id = b.id
  ) c on true
  where b.status = 'congelado'
  order by b.congelado_em desc
$$;

create or replace function public.publico_jogos(p_bolao uuid) returns table (
  recibo_ordem smallint, k smallint, g smallint, jogo_ordem smallint, dezenas smallint[]
)
language sql stable security definer set search_path = public as $$
  select r.ordem, r.k, r.g, j.ordem, j.dezenas
  from public.bolaos b
  join public.recibos r on r.bolao_id = b.id
  join public.jogos j on j.recibo_id = r.id
  where b.id = p_bolao and b.status = 'congelado'
  order by r.ordem, j.ordem
$$;

revoke all on function public.publico_boloes()      from public, anon, authenticated;
revoke all on function public.publico_jogos(uuid)   from public, anon, authenticated;
grant execute on function public.publico_boloes()    to anon, authenticated;
grant execute on function public.publico_jogos(uuid) to anon, authenticated;
grant execute on function public.publico_boloes(), public.publico_jogos(uuid), public.data_limite_vigente(), public.cotas_validar() to service_role;
