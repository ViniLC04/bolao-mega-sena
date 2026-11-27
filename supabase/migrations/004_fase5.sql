-- =====================================================================================================
-- Bolão da Mega da Virada — banco da Fase 5: 2 passos no ADM, foto do recibo e link pessoal do participante
--
-- COMO USAR: SQL Editor → New query → cole TUDO → Run. Rode DEPOIS de 001, 002 e 003. Pode rodar mais de uma vez.
--
-- O QUE FAZ
--   1) is_adm() passa a exigir a verificação em 2 passos (aal2) QUANDO o ADM tem um fator de 2 passos ativo.
--      Sem fator ativo, nada muda (não tranca você de fora). Depois que você ativar na tela Conta, quem tiver
--      só a senha não lê nem escreve nada, nem chamando a API direto.
--   2) Cria o armazenamento PRIVADO "recibos" (foto do recibo da Caixa): só o ADM vê, envia e apaga.
--   3) Link pessoal por participante: o público só executa duas funções que devolvem as cotas e os jogos
--      dos bolões em que AQUELA pessoa participa, com o token secreto dela. Token errado/desativado = nada.
-- =====================================================================================================

-- ---------- 1) ADM com 2 passos ----------
create or replace function public.is_adm() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid())
     and (
       coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
       or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
     )
$$;
revoke all on function public.is_adm() from public, anon, authenticated;
grant execute on function public.is_adm() to anon, authenticated, service_role; -- as políticas precisam

-- ---------- 2) Armazenamento privado das fotos de recibo ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recibos', 'recibos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists recibos_adm_ler on storage.objects;
create policy recibos_adm_ler on storage.objects for select to authenticated using (bucket_id = 'recibos' and public.is_adm());
drop policy if exists recibos_adm_enviar on storage.objects;
create policy recibos_adm_enviar on storage.objects for insert to authenticated with check (bucket_id = 'recibos' and public.is_adm());
drop policy if exists recibos_adm_trocar on storage.objects;
create policy recibos_adm_trocar on storage.objects for update to authenticated using (bucket_id = 'recibos' and public.is_adm()) with check (bucket_id = 'recibos' and public.is_adm());
drop policy if exists recibos_adm_apagar on storage.objects;
create policy recibos_adm_apagar on storage.objects for delete to authenticated using (bucket_id = 'recibos' and public.is_adm());

-- ---------- 3) Link pessoal do participante ----------
alter table public.participantes add column if not exists link_token text;
alter table public.participantes add column if not exists link_ativo boolean not null default false;
create unique index if not exists participantes_link_token_un on public.participantes (link_token) where link_token is not null;
alter table public.participantes drop constraint if exists participantes_token_forte;
alter table public.participantes add constraint participantes_token_forte check (link_token is null or link_token ~ '^[0-9a-f]{64}$');

-- Cotas e situação da pessoa dona do token, só dos bolões em que ela participa.
create or replace function public.publico_participante(p_token text) returns table (
  participante text, bolao_id uuid, bolao_nome text, concurso_alvo int, n_cotas int, status text, congelado_em timestamptz, hash text,
  qtd int, valor_devido_cent bigint, pago boolean, via_entregue boolean, custo_cent bigint, cota_cent bigint
)
language sql stable security definer set search_path = public as $$
  select p.nome, b.id, b.nome, b.concurso_alvo, b.n_cotas, b.status, b.congelado_em, b.hash,
         c.qtd, c.valor_devido_cent, c.pago, c.via_entregue,
         (select coalesce(sum(r.total_cent), 0) from public.recibos r where r.bolao_id = b.id)::bigint,
         nullif(b.regras_snapshot -> 'plano' ->> 'cotaCobradaCent', '')::bigint
  from public.participantes p
  join public.cotas c on c.participante_id = p.id
  join public.bolaos b on b.id = c.bolao_id
  where p.link_ativo and p.link_token is not null and length(coalesce(p_token, '')) = 64 and p.link_token = p_token
  order by b.criado_em desc
$$;

-- Jogos de UM bolão, só se a pessoa dona do token tem cotas nele e ele já está congelado.
create or replace function public.publico_participante_jogos(p_token text, p_bolao uuid) returns table (
  recibo_ordem smallint, k smallint, g smallint, jogo_ordem smallint, dezenas smallint[]
)
language sql stable security definer set search_path = public as $$
  select r.ordem, r.k, r.g, j.ordem, j.dezenas
  from public.participantes p
  join public.cotas c on c.participante_id = p.id and c.bolao_id = p_bolao
  join public.bolaos b on b.id = c.bolao_id and b.status = 'congelado'
  join public.recibos r on r.bolao_id = b.id
  join public.jogos j on j.recibo_id = r.id
  where p.link_ativo and p.link_token is not null and length(coalesce(p_token, '')) = 64 and p.link_token = p_token
  order by r.ordem, j.ordem
$$;

revoke all on function public.publico_participante(text)         from public, anon, authenticated;
revoke all on function public.publico_participante_jogos(text, uuid) from public, anon, authenticated;
grant execute on function public.publico_participante(text)         to anon, authenticated, service_role;
grant execute on function public.publico_participante_jogos(text, uuid) to anon, authenticated, service_role;
