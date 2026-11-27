-- =====================================================================================================
-- Bolão da Mega da Virada — Fase 9: conta do apostador (e-mail + senha) com histórico de cotas e bolões
--
-- COMO USAR: SQL Editor → New query → cole TUDO → Run. Rode DEPOIS da 008. Pode rodar mais de uma vez.
--
-- O QUE FAZ
--   1) participantes.user_id: a quem (qual conta) pertence a participação. Uma conta pode ter várias.
--   2) vincular_minha_conta(token): quem está logado prova que tem o link pessoal secreto e a participação
--      passa a ser dele. Um link só pode ficar com UMA conta (a primeira que vincula).
--   3) minhas_participacoes(): as participações da conta logada (com o token, para reaproveitar PIX,
--      comprovante e aumentar cotas, que já validam por token).
--   Uma conta nova NÃO é ADM e não lê nada além disso: todas as políticas das tabelas exigem is_adm().
-- =====================================================================================================

alter table public.participantes add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists participantes_user_id_idx on public.participantes (user_id) where user_id is not null;

create or replace function public.vincular_minha_conta(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_p   public.participantes%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'erro', 'Entre na sua conta de apostador primeiro.');
  end if;
  select * into v_p from public.participantes
   where length(coalesce(p_token, '')) = 64 and link_token = p_token and link_ativo for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Este link não é válido ou foi desligado.');
  end if;
  if v_p.user_id is not null and v_p.user_id <> v_uid then
    return jsonb_build_object('ok', false, 'erro', 'Este link já está ligado a outra conta. Fale com o organizador.');
  end if;
  if v_p.user_id is null then
    update public.participantes set user_id = v_uid where id = v_p.id;
  end if;
  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'erro', 'Não consegui vincular agora. Tente de novo.');
end;
$$;

drop function if exists public.minhas_participacoes();
create function public.minhas_participacoes() returns table (
  participante text, bolao_id uuid, bolao_nome text, concurso_alvo int, n_cotas int, status text, congelado_em timestamptz, hash text,
  qtd int, valor_devido_cent bigint, pago boolean, via_entregue boolean, custo_cent bigint, cota_cent bigint,
  inscricoes_ate timestamptz, qtd_paga int, aumentar_liberado boolean, max_cotas_pessoa int, link_token text
)
language sql stable security definer set search_path = public as $$
  select p.nome, b.id, b.nome, b.concurso_alvo, b.n_cotas, b.status, b.congelado_em, b.hash,
         c.qtd, c.valor_devido_cent, c.pago, c.via_entregue,
         (select coalesce(sum(r.total_cent), 0) from public.recibos r where r.bolao_id = b.id)::bigint,
         coalesce(nullif(b.regras_snapshot -> 'plano' ->> 'cotaCobradaCent', '')::bigint, b.cota_base_cent),
         b.inscricoes_ate, c.qtd_paga,
         (coalesce(l.autoinscricao, false) and b.status = 'aberto'
            and (b.inscricoes_ate is null or now() <= b.inscricoes_ate)),
         coalesce(l.max_cotas_pessoa, 10),
         p.link_token
  from public.participantes p
  join public.cotas c on c.participante_id = p.id
  join public.bolaos b on b.id = c.bolao_id
  left join public.bolao_links l on l.bolao_id = b.id and l.ativo
  where auth.uid() is not null and p.user_id = auth.uid() and p.link_ativo and p.link_token is not null
  order by b.criado_em desc
$$;

revoke all on function public.vincular_minha_conta(text) from public, anon, authenticated;
revoke all on function public.minhas_participacoes()     from public, anon, authenticated;
grant execute on function public.vincular_minha_conta(text) to authenticated, service_role;
grant execute on function public.minhas_participacoes()     to authenticated, service_role;
