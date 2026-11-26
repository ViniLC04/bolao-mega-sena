-- TESTE 3 da Fase 0 (SPEC 9.3 / seção 11): o público consegue ler NOMES?
-- Cole TUDO isto no "SQL Editor" do Supabase e clique em Run.
-- Usa só dados FICTÍCIOS e uma tabela de teste. Para limpar depois, rode o bloco "LIMPEZA" no fim.

-- 1) Tabela de teste com nomes fictícios
create table if not exists public.participantes_teste (
  id bigint generated always as identity primary key,
  nome text not null,
  cotas int not null,
  pago boolean not null default false
);

-- 2) Row Level Security LIGADA e sem nenhuma política para o público (anon)
alter table public.participantes_teste enable row level security;
alter table public.participantes_teste force row level security;

-- 3) Por garantia, tira também a permissão de tabela do público
revoke all on table public.participantes_teste from anon;
revoke all on table public.participantes_teste from authenticated;

-- 4) Dados fictícios
insert into public.participantes_teste (nome, cotas, pago) values
  ('Fulano de Teste', 2, true),
  ('Beltrana de Teste', 1, true),
  ('Ciclano de Teste', 3, false);

-- 5) Função pública que devolve SÓ totais (sem nomes). security definer = roda com permissão do dono.
create or replace function public.resumo_publico_teste()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'total_cotas', coalesce(sum(cotas), 0),
    'cotas_pagas', coalesce(sum(cotas) filter (where pago), 0),
    'participantes', count(*)
  )
  from public.participantes_teste;
$$;

revoke all on function public.resumo_publico_teste() from public;
grant execute on function public.resumo_publico_teste() to anon, authenticated;

-- ============ LIMPEZA (rode só quando terminar os testes) ============
-- drop function if exists public.resumo_publico_teste();
-- drop table if exists public.participantes_teste;
