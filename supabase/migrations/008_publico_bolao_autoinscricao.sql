-- Fase 8 (parte 2): a página pública do bolão passa a informar se a inscrição pelo link está liberada
-- e o máximo de cotas por pessoa (para o botão "Quero participar").
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez.

drop function if exists public.publico_bolao(text);
create function public.publico_bolao(p_token text) returns table (
  bolao_id uuid, nome text, concurso_alvo int, n_cotas int, cota_cent bigint, status text, congelado_em timestamptz, hash text,
  jogos int, custo_cent bigint,
  cotas_vendidas int, cotas_pagas int, previsto_cent bigint, arrecadado_cent bigint, vias_entregues int,
  inscricoes_ate timestamptz, autoinscricao boolean, max_cotas_pessoa int
)
language sql stable security definer set search_path = public as $$
  select b.id, b.nome, b.concurso_alvo, b.n_cotas,
         coalesce(nullif(b.regras_snapshot -> 'plano' ->> 'cotaCobradaCent', '')::bigint, b.cota_base_cent),
         b.status, b.congelado_em, b.hash,
         (select count(*) from public.jogos j join public.recibos r on r.id = j.recibo_id where r.bolao_id = b.id)::int,
         (select coalesce(sum(r.total_cent), 0) from public.recibos r where r.bolao_id = b.id)::bigint,
         coalesce(c.vendidas, 0)::int, coalesce(c.pagas, 0)::int,
         coalesce(c.previsto, 0)::bigint, coalesce(c.arrecadado, 0)::bigint, coalesce(c.vias, 0)::int,
         b.inscricoes_ate,
         (l.autoinscricao and b.status = 'aberto' and (b.inscricoes_ate is null or now() <= b.inscricoes_ate)),
         l.max_cotas_pessoa
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

revoke all on function public.publico_bolao(text) from public, anon, authenticated;
grant execute on function public.publico_bolao(text) to anon, authenticated, service_role;
