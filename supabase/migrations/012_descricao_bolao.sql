-- Fase 15: descrição do bolão (a "premissa"), editável pelo ADM até depois de congelado, com auditoria.
-- A descrição aparece na página do link do bolão e na lista "Bolões disponíveis" da conta do apostador.
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez. Rode DEPOIS da 011.

alter table public.bolaos add column if not exists descricao text;
alter table public.bolaos drop constraint if exists bolaos_descricao_tamanho;
alter table public.bolaos add constraint bolaos_descricao_tamanho check (descricao is null or char_length(descricao) <= 500);

-- Bolão congelado: continua valendo só a exceção "mudar nome e/ou descrição" (nenhum outro campo).
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
    if tg_table_name = 'recibos' and tg_op = 'UPDATE'
       and (to_jsonb(new) - 'foto_path') = (to_jsonb(old) - 'foto_path') then
      return new;
    end if;
    if tg_table_name = 'bolaos' and tg_op = 'UPDATE'
       and (to_jsonb(new) - 'nome' - 'descricao') = (to_jsonb(old) - 'nome' - 'descricao') then
      return new;
    end if;
    raise exception 'Este bolão está congelado: jogos, recibos e dados do bolão não podem mais ser alterados, incluídos ou apagados.'
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.definir_descricao_bolao(p_bolao uuid, p_descricao text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_novo  text := nullif(btrim(coalesce(p_descricao, '')), '');
  v_velho text;
begin
  if not public.is_adm() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if v_novo is not null and char_length(v_novo) > 500 then
    return jsonb_build_object('ok', false, 'erro', 'A descrição pode ter no máximo 500 caracteres.');
  end if;
  select descricao into v_velho from public.bolaos where id = p_bolao;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Bolão não encontrado.');
  end if;
  if v_velho is not distinct from v_novo then
    return jsonb_build_object('ok', true);
  end if;
  update public.bolaos set descricao = v_novo where id = p_bolao;
  insert into public.auditoria (usuario, acao, tabela, registro, detalhe)
  values (auth.uid(), 'DESCRICAO', 'bolaos', p_bolao::text, jsonb_build_object('de', v_velho, 'para', v_novo));
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.definir_descricao_bolao(uuid, text) from public, anon, authenticated;
grant execute on function public.definir_descricao_bolao(uuid, text) to authenticated, service_role;

-- Página do link do bolão: agora com a descrição
drop function if exists public.publico_bolao(text);
create function public.publico_bolao(p_token text) returns table (
  bolao_id uuid, nome text, concurso_alvo int, n_cotas int, cota_cent bigint, status text, congelado_em timestamptz, hash text,
  jogos int, custo_cent bigint,
  cotas_vendidas int, cotas_pagas int, previsto_cent bigint, arrecadado_cent bigint, vias_entregues int,
  inscricoes_ate timestamptz, autoinscricao boolean, max_cotas_pessoa int, descricao text
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
         l.max_cotas_pessoa,
         b.descricao
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

-- Lista de bolões da conta do apostador: agora com a descrição
drop function if exists public.boloes_listados();
create function public.boloes_listados() returns table (
  bolao_id uuid, nome text, concurso_alvo int, n_cotas int, cota_cent bigint,
  cotas_vendidas int, inscricoes_ate timestamptz, inscricao_aberta boolean, token text, descricao text
)
language sql stable security definer set search_path = public as $$
  select b.id, b.nome, b.concurso_alvo, b.n_cotas,
         coalesce(nullif(b.regras_snapshot -> 'plano' ->> 'cotaCobradaCent', '')::bigint, b.cota_base_cent),
         coalesce((select sum(c.qtd) from public.cotas c where c.bolao_id = b.id), 0)::int,
         b.inscricoes_ate,
         (l.autoinscricao and (b.inscricoes_ate is null or now() <= b.inscricoes_ate)),
         l.token,
         b.descricao
  from public.bolao_links l
  join public.bolaos b on b.id = l.bolao_id
  where auth.uid() is not null and l.ativo and l.listado and b.status = 'aberto'
  order by b.criado_em desc
$$;

revoke all on function public.boloes_listados() from public, anon, authenticated;
grant execute on function public.boloes_listados() to authenticated, service_role;
