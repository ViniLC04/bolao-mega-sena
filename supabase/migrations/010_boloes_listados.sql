-- Fase 10: bolões "listados" para apostadores com conta (sem precisar do link).
-- O ADM marca o bolão como listado; quem está logado vê a lista e abre a página do bolão
-- (a mesma do link secreto: só primeiro nome + cotas). Cole no SQL Editor e clique em Run. Pode rodar mais de uma vez.

alter table public.bolao_links add column if not exists listado boolean not null default false;

create or replace function public.boloes_listados() returns table (
  bolao_id uuid, nome text, concurso_alvo int, n_cotas int, cota_cent bigint,
  cotas_vendidas int, inscricoes_ate timestamptz, inscricao_aberta boolean, token text
)
language sql stable security definer set search_path = public as $$
  select b.id, b.nome, b.concurso_alvo, b.n_cotas,
         coalesce(nullif(b.regras_snapshot -> 'plano' ->> 'cotaCobradaCent', '')::bigint, b.cota_base_cent),
         coalesce((select sum(c.qtd) from public.cotas c where c.bolao_id = b.id), 0)::int,
         b.inscricoes_ate,
         (l.autoinscricao and (b.inscricoes_ate is null or now() <= b.inscricoes_ate)),
         l.token
  from public.bolao_links l
  join public.bolaos b on b.id = l.bolao_id
  where auth.uid() is not null and l.ativo and l.listado and b.status = 'aberto'
  order by b.criado_em desc
$$;

revoke all on function public.boloes_listados() from public, anon, authenticated;
grant execute on function public.boloes_listados() to authenticated, service_role;
