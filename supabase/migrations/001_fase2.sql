-- =====================================================================================================
-- Bolão da Mega da Virada — banco da Fase 2 (Supabase / PostgreSQL)
--
-- COMO USAR: abra o projeto no Supabase → "SQL Editor" → "New query", cole TUDO e clique em "Run".
-- Pode rodar mais de uma vez sem estragar nada (é "idempotente").
--
-- O QUE FAZ: cria as tabelas do ADM, liga a proteção linha a linha (RLS) em todas, tira do público tudo
-- o que não for público e cria a função que "congela" um bolão.
--
-- REGRAS DE SEGURANÇA (SPEC seção 11):
--   * Só o ADM (tabela `admins`, um único) lê e escreve bolões, jogos, combinações, configuração e auditoria.
--   * O público (anon) só LÊ regras e concursos (dados públicos). Nunca escreve nada.
--   * Duas camadas: (1) RLS com política "só ADM" e (2) permissões de tabela retiradas do público.
--   * Dinheiro em centavos (bigint). Nenhuma regra oficial fixa aqui (preço, limites): isso vive em
--     `rules_versions`. Só há restrições de ESTRUTURA do jogo (60 dezenas, 6 sorteadas, jogo de 6 a 60).
-- =====================================================================================================

-- ---------- Funções de apoio (puras) ----------

-- Sorteio: exatamente 6 dezenas distintas entre 1 e 60.
create or replace function public.dezenas_validas(d smallint[]) returns boolean
language sql immutable as $$
  select d is not null
     and array_length(d, 1) = 6
     and (select count(distinct x) from unnest(d) as x) = 6
     and not exists (select 1 from unnest(d) as x where x < 1 or x > 60)
$$;

-- Jogo: de 6 a 60 dezenas distintas entre 1 e 60 (o limite de 20 do bolão é regra e fica nas regras).
create or replace function public.dezenas_jogo_validas(d smallint[]) returns boolean
language sql immutable as $$
  select d is not null
     and array_length(d, 1) between 6 and 60
     and (select count(distinct x) from unnest(d) as x) = array_length(d, 1)
     and not exists (select 1 from unnest(d) as x where x < 1 or x > 60)
$$;

-- ---------- Tabelas ----------

-- Quem é o ADM. Só pode existir UM (índice único abaixo). Cadastro pelo SQL Editor (bootstrap_adm.sql).
create table if not exists public.admins (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);
create unique index if not exists admins_um_so on public.admins ((true));

-- Pergunta "o usuário logado é o ADM?". As políticas abaixo usam esta função.
create or replace function public.is_adm() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- Regras versionadas por data de vigência (cada mudança é uma NOVA versão: nunca se edita nem apaga).
create table if not exists public.rules_versions (
  id               bigint generated always as identity primary key,
  vigencia_inicio  date not null unique,
  json             jsonb not null,
  criado_em        timestamptz not null default now(),
  criado_por       uuid default auth.uid()
);

-- Configurações soltas do ADM (ex.: data_limite_aposta, viradas).
create table if not exists public.config (
  chave          text primary key,
  valor          jsonb not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

-- Histórico de alterações. Só leitura para o ADM; quem grava são os gatilhos e as funções abaixo.
create table if not exists public.auditoria (
  id       bigint generated always as identity primary key,
  quando   timestamptz not null default now(),
  usuario  uuid,
  acao     text not null,
  tabela   text,
  registro text,
  detalhe  jsonb
);

-- Concursos da Mega-Sena (dados públicos). Só se insere: nunca se sobrescreve.
create table if not exists public.concursos (
  numero               int primary key,
  data                 date not null,
  dezenas              smallint[] not null check (public.dezenas_validas(dezenas)),
  ordem_sorteio        smallint[],
  arrecadacao_cent     bigint check (arrecadacao_cent is null or arrecadacao_cent >= 0),
  estimativa_prox_cent bigint check (estimativa_prox_cent is null or estimativa_prox_cent >= 0),
  acumulado_virada_cent bigint check (acumulado_virada_cent is null or acumulado_virada_cent >= 0),
  acumulado_prox_cent  bigint check (acumulado_prox_cent is null or acumulado_prox_cent >= 0),
  acumulado_sena_cent  bigint check (acumulado_sena_cent is null or acumulado_sena_cent >= 0),
  cidades              text,
  observacao           text,
  fonte                text not null,
  obtido_em            timestamptz not null default now(),
  status               text not null default 'oficial_importado'
                       check (status in ('confirmado', 'aguardando', 'oficial_importado'))
);

-- Rateio oficial por faixa (4 = quadra, 5 = quina, 6 = sena).
create table if not exists public.concurso_faixas (
  concurso   int not null references public.concursos (numero) on delete cascade,
  faixa      smallint not null check (faixa in (4, 5, 6)),
  ganhadores int not null check (ganhadores >= 0),
  valor_cent bigint not null check (valor_cent >= 0),
  primary key (concurso, faixa)
);

-- Bolões do ADM.
create table if not exists public.bolaos (
  id               uuid primary key default gen_random_uuid(),
  concurso_alvo    int not null,
  nome             text not null,
  n_cotas          int not null check (n_cotas >= 1),
  cota_base_cent   bigint check (cota_base_cent is null or cota_base_cent > 0),
  modo_cobranca    text not null default 'cota_fixa' check (modo_cobranca in ('cota_fixa', 'cota_teto')),
  status           text not null default 'rascunho' check (status in ('rascunho', 'congelado')),
  regras_versao_id bigint references public.rules_versions (id),
  regras_snapshot  jsonb,
  semente          bigint,
  criado_em        timestamptz not null default now(),
  congelado_em     timestamptz,
  hash             text,
  constraint bolao_congelado_completo check (status = 'rascunho' or (congelado_em is not null and hash is not null))
);

-- Recibos do bolão (1 a 10 jogos, todos com o mesmo k). `foto_path` é reservado para a Fase 3.
create table if not exists public.recibos (
  id         uuid primary key default gen_random_uuid(),
  bolao_id   uuid not null references public.bolaos (id) on delete cascade,
  ordem      smallint not null,
  k          smallint not null check (k between 6 and 60),
  g          smallint not null check (g >= 1),
  total_cent bigint not null check (total_cent > 0),
  cotas_n    int not null check (cotas_n >= 1),
  foto_path  text,
  unique (bolao_id, ordem)
);
create index if not exists recibos_bolao_idx on public.recibos (bolao_id);

create table if not exists public.jogos (
  id        uuid primary key default gen_random_uuid(),
  recibo_id uuid not null references public.recibos (id) on delete cascade,
  ordem     smallint not null,
  dezenas   smallint[] not null check (public.dezenas_jogo_validas(dezenas)),
  travado   boolean not null default false,
  unique (recibo_id, ordem)
);
create index if not exists jogos_recibo_idx on public.jogos (recibo_id);

-- Todas as combinações de 6 dezenas já cobertas num concurso (combo_rank = posição de 0 a 50.063.859 na ordem
-- "colex", calculada pelo motor). A chave primária faz o PRÓPRIO BANCO impedir combinação repetida entre bolões.
-- Só é escrita pela função congelar_bolao.
create table if not exists public.combinacoes_cobertas (
  concurso   int not null,
  combo_rank int not null check (combo_rank >= 0),
  bolao_id   uuid not null references public.bolaos (id),
  primary key (concurso, combo_rank)
);
create index if not exists cobertas_bolao_idx on public.combinacoes_cobertas (bolao_id);

-- ---------- Imutabilidade: bolão congelado não muda ----------
create or replace function public.bloquear_se_congelado() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  reg      record;
  v_bolao  uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then reg := old; else reg := new; end if;

  if tg_table_name = 'bolaos' then
    v_bolao := reg.id;
  elsif tg_table_name = 'recibos' then
    v_bolao := reg.bolao_id;
  else -- jogos
    select r.bolao_id into v_bolao from public.recibos r where r.id = reg.recibo_id;
  end if;

  select b.status into v_status from public.bolaos b where b.id = v_bolao;

  if v_status = 'congelado' then
    -- Única exceção: anexar/trocar a foto do recibo depois de congelar (Fase 3).
    if tg_table_name = 'recibos' and tg_op = 'UPDATE'
       and (to_jsonb(new) - 'foto_path') = (to_jsonb(old) - 'foto_path') then
      return new;
    end if;
    raise exception 'Este bolão está congelado: jogos, recibos e dados do bolão não podem mais ser alterados, incluídos ou apagados.'
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists t_bolaos_imutavel on public.bolaos;
create trigger t_bolaos_imutavel before update or delete on public.bolaos
  for each row execute function public.bloquear_se_congelado();

drop trigger if exists t_recibos_imutavel on public.recibos;
create trigger t_recibos_imutavel before insert or update or delete on public.recibos
  for each row execute function public.bloquear_se_congelado();

drop trigger if exists t_jogos_imutavel on public.jogos;
create trigger t_jogos_imutavel before insert or update or delete on public.jogos
  for each row execute function public.bloquear_se_congelado();

-- ---------- Auditoria por gatilho ----------
create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  reg   record;
  v_det jsonb;
begin
  if tg_op = 'DELETE' then reg := old; else reg := new; end if;
  v_det := to_jsonb(reg) - 'regras_snapshot'; -- campo grande: fica só na própria linha do bolão
  insert into public.auditoria (usuario, acao, tabela, registro, detalhe)
  values (auth.uid(), tg_op, tg_table_name, coalesce(v_det ->> 'id', v_det ->> 'chave', v_det ->> 'user_id'), v_det);
  return null;
end;
$$;

drop trigger if exists t_audit_bolaos on public.bolaos;
create trigger t_audit_bolaos after insert or update or delete on public.bolaos
  for each row execute function public.auditar();
drop trigger if exists t_audit_rules on public.rules_versions;
create trigger t_audit_rules after insert or update or delete on public.rules_versions
  for each row execute function public.auditar();
drop trigger if exists t_audit_config on public.config;
create trigger t_audit_config after insert or update or delete on public.config
  for each row execute function public.auditar();
drop trigger if exists t_audit_admins on public.admins;
create trigger t_audit_admins after insert or update or delete on public.admins
  for each row execute function public.auditar();

-- ---------- Congelar o bolão (tudo numa transação) ----------
-- p_hash  = SHA-256 do conjunto de jogos (calculado pelo app, 64 caracteres hexadecimais)
-- p_ranks = combo_rank de TODAS as combinações de 6 dezenas cobertas pelos jogos do bolão (calculado pelo motor)
create or replace function public.congelar_bolao(p_bolao uuid, p_hash text, p_ranks int[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_bolao     public.bolaos%rowtype;
  v_total     int;
  v_distintos int;
  v_conflitos int;
  v_agora     timestamptz := now();
begin
  if not public.is_adm() then
    raise exception 'Acesso negado: só o ADM pode congelar um bolão.' using errcode = '42501';
  end if;

  select * into v_bolao from public.bolaos where id = p_bolao for update;
  if not found then
    raise exception 'Bolão não encontrado.' using errcode = 'P0002';
  end if;
  if v_bolao.status <> 'rascunho' then
    raise exception 'Este bolão já está congelado.' using errcode = 'P0001';
  end if;
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Hash inválido: esperado SHA-256 em 64 caracteres hexadecimais.' using errcode = '22023';
  end if;

  v_total := coalesce(array_length(p_ranks, 1), 0);
  if v_total = 0 then
    raise exception 'Nenhuma combinação informada para congelar.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_ranks) as r where r is null or r < 0 or r >= 50063860) then
    raise exception 'Há combinação fora do intervalo válido (0 a 50.063.859).' using errcode = '22023';
  end if;

  select count(distinct r) into v_distintos from unnest(p_ranks) as r;
  if v_distintos <> v_total then
    raise exception 'Há % combinação(ões) repetida(s) dentro do próprio bolão.', v_total - v_distintos using errcode = '23505';
  end if;

  select count(*) into v_conflitos
  from unnest(p_ranks) as r
  join public.combinacoes_cobertas c on c.concurso = v_bolao.concurso_alvo and c.combo_rank = r;
  if v_conflitos > 0 then
    raise exception 'Congelamento recusado: % combinação(ões) deste bolão já estão cobertas por outro bolão do concurso %.',
      v_conflitos, v_bolao.concurso_alvo using errcode = '23505';
  end if;

  insert into public.combinacoes_cobertas (concurso, combo_rank, bolao_id)
  select v_bolao.concurso_alvo, r, p_bolao from unnest(p_ranks) as r;

  update public.bolaos set status = 'congelado', congelado_em = v_agora, hash = p_hash where id = p_bolao;

  insert into public.auditoria (usuario, acao, tabela, registro, detalhe)
  values (auth.uid(), 'CONGELAR', 'bolaos', p_bolao::text,
          jsonb_build_object('hash', p_hash, 'combinacoes', v_total, 'concurso', v_bolao.concurso_alvo));

  return jsonb_build_object('combinacoes', v_total, 'congelado_em', v_agora);
end;
$$;

-- ---------- RLS ligada em TUDO (inclusive para o dono da tabela) ----------
alter table public.admins              enable row level security;
alter table public.rules_versions      enable row level security;
alter table public.config              enable row level security;
alter table public.auditoria           enable row level security;
alter table public.concursos           enable row level security;
alter table public.concurso_faixas     enable row level security;
alter table public.bolaos              enable row level security;
alter table public.recibos             enable row level security;
alter table public.jogos               enable row level security;
alter table public.combinacoes_cobertas enable row level security;

alter table public.admins              force row level security;
alter table public.rules_versions      force row level security;
alter table public.config              force row level security;
alter table public.auditoria           force row level security;
alter table public.concursos           force row level security;
alter table public.concurso_faixas     force row level security;
alter table public.bolaos              force row level security;
alter table public.recibos             force row level security;
alter table public.jogos               force row level security;
alter table public.combinacoes_cobertas force row level security;

-- ---------- Permissões: tira TUDO do público e devolve só o necessário ----------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Tabelas e funções criadas no futuro também nascem fechadas (no Supabase o dono é o papel "postgres").
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- Funções: ninguém executa nada por padrão; abre só o necessário.
revoke all on function public.is_adm()                             from public, anon, authenticated;
revoke all on function public.congelar_bolao(uuid, text, int[])    from public, anon, authenticated;
revoke all on function public.bloquear_se_congelado()              from public, anon, authenticated;
revoke all on function public.auditar()                            from public, anon, authenticated;
revoke all on function public.dezenas_validas(smallint[])          from public, anon, authenticated;
revoke all on function public.dezenas_jogo_validas(smallint[])     from public, anon, authenticated;

grant execute on function public.is_adm()                          to anon, authenticated; -- as políticas precisam
grant execute on function public.dezenas_validas(smallint[])       to anon, authenticated;
grant execute on function public.dezenas_jogo_validas(smallint[])  to anon, authenticated;
grant execute on function public.congelar_bolao(uuid, text, int[]) to authenticated;

-- Dados públicos: qualquer um LÊ; só o ADM insere (e só inserir: nada de update/delete).
grant select on public.rules_versions, public.concursos, public.concurso_faixas to anon, authenticated;
grant insert on public.rules_versions, public.concursos, public.concurso_faixas to authenticated;

-- Só o ADM:
grant select on public.admins, public.auditoria, public.combinacoes_cobertas to authenticated;
grant select, insert, update, delete on public.config, public.bolaos, public.recibos, public.jogos to authenticated;
grant usage on all sequences in schema public to authenticated;

-- ---------- Políticas ----------
drop policy if exists admins_ler_proprio on public.admins;
create policy admins_ler_proprio on public.admins for select to authenticated using (user_id = auth.uid());

drop policy if exists rules_ler on public.rules_versions;
create policy rules_ler on public.rules_versions for select to anon, authenticated using (true);
drop policy if exists rules_inserir_adm on public.rules_versions;
create policy rules_inserir_adm on public.rules_versions for insert to authenticated with check (public.is_adm());

drop policy if exists concursos_ler on public.concursos;
create policy concursos_ler on public.concursos for select to anon, authenticated using (true);
drop policy if exists concursos_inserir_adm on public.concursos;
create policy concursos_inserir_adm on public.concursos for insert to authenticated with check (public.is_adm());

drop policy if exists faixas_ler on public.concurso_faixas;
create policy faixas_ler on public.concurso_faixas for select to anon, authenticated using (true);
drop policy if exists faixas_inserir_adm on public.concurso_faixas;
create policy faixas_inserir_adm on public.concurso_faixas for insert to authenticated with check (public.is_adm());

drop policy if exists auditoria_ler_adm on public.auditoria;
create policy auditoria_ler_adm on public.auditoria for select to authenticated using (public.is_adm());

drop policy if exists cobertas_ler_adm on public.combinacoes_cobertas;
create policy cobertas_ler_adm on public.combinacoes_cobertas for select to authenticated using (public.is_adm());

drop policy if exists config_adm on public.config;
create policy config_adm on public.config for all to authenticated using (public.is_adm()) with check (public.is_adm());

drop policy if exists bolaos_adm on public.bolaos;
create policy bolaos_adm on public.bolaos for all to authenticated using (public.is_adm()) with check (public.is_adm());

drop policy if exists recibos_adm on public.recibos;
create policy recibos_adm on public.recibos for all to authenticated using (public.is_adm()) with check (public.is_adm());

drop policy if exists jogos_adm on public.jogos;
create policy jogos_adm on public.jogos for all to authenticated using (public.is_adm()) with check (public.is_adm());
