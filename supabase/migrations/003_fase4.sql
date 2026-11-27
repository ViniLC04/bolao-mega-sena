-- =====================================================================================================
-- Bolão da Mega da Virada — banco da Fase 4: atualizar concursos, confirmação pelo ADM e Viradas públicas
--
-- COMO USAR: SQL Editor → New query → cole TUDO → Run. Rode DEPOIS de 001 e 002. Pode rodar mais de uma vez.
--
-- REGRAS (SPEC 9.2): qualquer visitante pode ENVIAR um concurso novo (o navegador dele consulta a Caixa), mas o
-- servidor só aceita:  o PRÓXIMO da sequência · 6 dezenas distintas de 1 a 60 · valores ≥ 0 · NUNCA sobrescreve ·
-- no máximo 5 concursos novos por minuto (e 20 tentativas recusadas por minuto).
-- O concurso de visitante entra como "aguardando" (confirmação pelo ADM). Só o ADM logado, com as duas fontes
-- batendo, grava "confirmado" direto. O ADM também pode confirmar ou REJEITAR um concurso ainda aguardando.
-- =====================================================================================================

-- Registro das atualizações (sem identificar o visitante). Só o ADM lê.
create table if not exists public.fontes_log (
  id        bigint generated always as identity primary key,
  quando    timestamptz not null default now(),
  origem    text not null,
  concurso  int,
  resultado text not null
);
alter table public.fontes_log enable row level security;
alter table public.fontes_log force row level security;
drop policy if exists fontes_log_adm on public.fontes_log;
create policy fontes_log_adm on public.fontes_log for select to authenticated using (public.is_adm());
revoke all on public.fontes_log from anon, authenticated;
grant select on public.fontes_log to authenticated;
grant all on public.fontes_log to service_role;

-- A auditoria também guarda o número do concurso como "registro".
create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  reg   record;
  v_det jsonb;
begin
  if tg_op = 'DELETE' then reg := old; else reg := new; end if;
  v_det := to_jsonb(reg) - 'regras_snapshot';
  insert into public.auditoria (usuario, acao, tabela, registro, detalhe)
  values (auth.uid(), tg_op, tg_table_name, coalesce(v_det ->> 'id', v_det ->> 'chave', v_det ->> 'user_id', v_det ->> 'numero'), v_det);
  return null;
end;
$$;
revoke all on function public.auditar() from public, anon, authenticated;

drop trigger if exists t_audit_concursos on public.concursos;
create trigger t_audit_concursos after insert or update or delete on public.concursos
  for each row execute function public.auditar();

-- ---------- Registrar um concurso novo ----------
-- p_dados (jsonb): numero, data (aaaa-mm-dd), dezenas[6], ordem_sorteio[6]|null, arrecadacao_cent,
--   estimativa_prox_cent, acumulado_virada_cent, acumulado_prox_cent, acumulado_sena_cent, cidades, observacao,
--   faixas: [{faixa: 4|5|6, ganhadores, valor_cent}, ...]
create or replace function public.registrar_concurso(p_dados jsonb, p_origem text default 'Caixa (navegador)', p_segunda_fonte_ok boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ultimo     int;
  v_ultima_dt  date;
  v_numero     int;
  v_data       date;
  v_dezenas    smallint[];
  v_ordem      smallint[];
  v_status     text;
  v_faixa      jsonb;
  v_faixas_n   int := 0;
  v_vistas     int[] := '{}';
  v_recusados  int;
  v_novos      int;
  v_origem     text := left(coalesce(nullif(btrim(p_origem), ''), 'Caixa (navegador)'), 80);
begin
  -- limites de uso
  select count(*) into v_novos from public.fontes_log where quando > now() - interval '1 minute' and resultado = 'ok';
  select count(*) into v_recusados from public.fontes_log where quando > now() - interval '1 minute' and resultado <> 'ok';
  if v_novos >= 5 or v_recusados >= 20 then
    return jsonb_build_object('ok', false, 'erro', 'Muitas atualizações seguidas. Espere um minuto e tente de novo.');
  end if;

  begin
    select max(numero) into v_ultimo from public.concursos;
    select data into v_ultima_dt from public.concursos where numero = v_ultimo;
    v_numero := (p_dados ->> 'numero')::int;
    if v_numero is null or v_numero <> coalesce(v_ultimo, 0) + 1 then
      raise exception 'Fora de sequência: o próximo concurso deveria ser o %.', coalesce(v_ultimo, 0) + 1 using errcode = 'P0001';
    end if;

    v_data := (p_dados ->> 'data')::date;
    if v_data is null or v_data > (now() at time zone 'America/Sao_Paulo')::date + 1 or (v_ultima_dt is not null and v_data <= v_ultima_dt) then
      raise exception 'Data inválida para o concurso %.', v_numero using errcode = 'P0001';
    end if;

    select array_agg(x::smallint order by ord) into v_dezenas from jsonb_array_elements_text(p_dados -> 'dezenas') with ordinality as t(x, ord);
    if not public.dezenas_validas(v_dezenas) then
      raise exception 'As dezenas do concurso % são inválidas (precisam ser 6 distintas, de 1 a 60).', v_numero using errcode = 'P0001';
    end if;
    -- guarda as dezenas em ordem crescente (como a planilha oficial)
    select array_agg(d order by d) into v_dezenas from unnest(v_dezenas) as d;

    if p_dados -> 'ordem_sorteio' is not null and jsonb_typeof(p_dados -> 'ordem_sorteio') = 'array' then
      select array_agg(x::smallint order by ord) into v_ordem from jsonb_array_elements_text(p_dados -> 'ordem_sorteio') with ordinality as t(x, ord);
      if not public.dezenas_validas(v_ordem) or (select array_agg(d order by d) from unnest(v_ordem) as d) <> v_dezenas then
        v_ordem := null;
      end if;
    end if;

    for v_faixa in select * from jsonb_array_elements(p_dados -> 'faixas') loop
      if (v_faixa ->> 'faixa')::int not in (4, 5, 6) or (v_faixa ->> 'faixa')::int = any (v_vistas)
         or (v_faixa ->> 'ganhadores')::int < 0 or (v_faixa ->> 'valor_cent')::bigint < 0 then
        raise exception 'Rateio inválido no concurso %.', v_numero using errcode = 'P0001';
      end if;
      v_vistas := v_vistas || (v_faixa ->> 'faixa')::int;
      v_faixas_n := v_faixas_n + 1;
    end loop;
    if v_faixas_n <> 3 then
      raise exception 'O rateio do concurso % precisa ter as 3 faixas (quadra, quina e sena).', v_numero using errcode = 'P0001';
    end if;
    if coalesce((p_dados ->> 'arrecadacao_cent')::bigint, 0) < 0 or coalesce((p_dados ->> 'estimativa_prox_cent')::bigint, 0) < 0
       or coalesce((p_dados ->> 'acumulado_virada_cent')::bigint, 0) < 0 or coalesce((p_dados ->> 'acumulado_prox_cent')::bigint, 0) < 0
       or coalesce((p_dados ->> 'acumulado_sena_cent')::bigint, 0) < 0 then
      raise exception 'Há valor negativo no concurso %.', v_numero using errcode = 'P0001';
    end if;
  exception
    when sqlstate 'P0001' then
      -- devolve o motivo (em vez de dar erro) para o registro da tentativa recusada ficar gravado
      insert into public.fontes_log (origem, concurso, resultado) values (v_origem, null, 'recusado');
      return jsonb_build_object('ok', false, 'erro', sqlerrm);
    when others then
      insert into public.fontes_log (origem, concurso, resultado) values (v_origem, null, 'recusado');
      return jsonb_build_object('ok', false, 'erro', 'Os dados do concurso não estão no formato esperado.');
  end;

  -- Só o ADM logado, com as duas fontes batendo, grava direto como confirmado.
  v_status := case when p_segunda_fonte_ok and public.is_adm() then 'confirmado' else 'aguardando' end;

  insert into public.concursos (numero, data, dezenas, ordem_sorteio, arrecadacao_cent, estimativa_prox_cent, acumulado_virada_cent,
                                acumulado_prox_cent, acumulado_sena_cent, cidades, observacao, fonte, status)
  values (v_numero, v_data, v_dezenas, v_ordem,
          coalesce((p_dados ->> 'arrecadacao_cent')::bigint, 0), (p_dados ->> 'estimativa_prox_cent')::bigint,
          (p_dados ->> 'acumulado_virada_cent')::bigint, (p_dados ->> 'acumulado_prox_cent')::bigint,
          (p_dados ->> 'acumulado_sena_cent')::bigint,
          left(nullif(p_dados ->> 'cidades', ''), 2000), left(nullif(p_dados ->> 'observacao', ''), 2000), v_origem, v_status);

  insert into public.concurso_faixas (concurso, faixa, ganhadores, valor_cent)
  select v_numero, (f ->> 'faixa')::smallint, (f ->> 'ganhadores')::int, (f ->> 'valor_cent')::bigint
  from jsonb_array_elements(p_dados -> 'faixas') as f;

  insert into public.fontes_log (origem, concurso, resultado) values (v_origem, v_numero, 'ok');
  return jsonb_build_object('ok', true, 'numero', v_numero, 'status', v_status);
end;
$$;

-- ---------- Confirmar / rejeitar (só ADM) ----------
create or replace function public.confirmar_concurso(p_numero int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if not public.is_adm() then
    raise exception 'Acesso negado: só o ADM pode confirmar um concurso.' using errcode = '42501';
  end if;
  select status into v_status from public.concursos where numero = p_numero for update;
  if v_status is null then
    raise exception 'Concurso não encontrado.' using errcode = 'P0002';
  end if;
  if v_status <> 'aguardando' then
    raise exception 'Este concurso não está aguardando confirmação.' using errcode = 'P0001';
  end if;
  update public.concursos set status = 'confirmado' where numero = p_numero;
  return jsonb_build_object('numero', p_numero, 'status', 'confirmado');
end;
$$;

-- Rejeitar: apaga um concurso AINDA AGUARDANDO e só se for o último da sequência (resultado falso enviado por visitante).
create or replace function public.rejeitar_concurso(p_numero int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_ultimo int;
begin
  if not public.is_adm() then
    raise exception 'Acesso negado: só o ADM pode rejeitar um concurso.' using errcode = '42501';
  end if;
  select status into v_status from public.concursos where numero = p_numero for update;
  select max(numero) into v_ultimo from public.concursos;
  if v_status is null then
    raise exception 'Concurso não encontrado.' using errcode = 'P0002';
  end if;
  if v_status <> 'aguardando' then
    raise exception 'Só dá para rejeitar um concurso que ainda está aguardando confirmação.' using errcode = 'P0001';
  end if;
  if p_numero <> v_ultimo then
    raise exception 'Só dá para rejeitar o último concurso da lista.' using errcode = 'P0001';
  end if;
  delete from public.concursos where numero = p_numero; -- o rateio sai junto (cascata)
  return jsonb_build_object('numero', p_numero, 'rejeitado', true);
end;
$$;

-- ---------- Lista de Viradas (para o filtro das estatísticas públicas) ----------
create or replace function public.publico_viradas() returns int[]
language sql stable security definer set search_path = public as $$
  select coalesce((select array_agg(x::int order by x::int) from jsonb_array_elements_text((select valor from public.config where chave = 'viradas')) as t(x)), '{}')
$$;

-- ---------- Permissões ----------
revoke all on function public.registrar_concurso(jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.confirmar_concurso(int)                  from public, anon, authenticated;
revoke all on function public.rejeitar_concurso(int)                   from public, anon, authenticated;
revoke all on function public.publico_viradas()                        from public, anon, authenticated;
grant execute on function public.registrar_concurso(jsonb, text, boolean) to anon, authenticated;
grant execute on function public.confirmar_concurso(int)                  to authenticated;
grant execute on function public.rejeitar_concurso(int)                   to authenticated;
grant execute on function public.publico_viradas()                        to anon, authenticated;
grant execute on function public.registrar_concurso(jsonb, text, boolean), public.confirmar_concurso(int), public.rejeitar_concurso(int), public.publico_viradas() to service_role;
grant execute on function public.auditar() to service_role;
