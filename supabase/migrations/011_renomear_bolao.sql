-- Fase 14: o ADM pode mudar SÓ o título do bolão, até depois de congelado (jogos, recibos e hash continuam imutáveis).
-- Cada troca fica registrada na tabela de auditoria (de → para).
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez.

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
    -- Exceção 1: anexar/trocar a foto do recibo depois de congelar (Fase 3).
    if tg_table_name = 'recibos' and tg_op = 'UPDATE'
       and (to_jsonb(new) - 'foto_path') = (to_jsonb(old) - 'foto_path') then
      return new;
    end if;
    -- Exceção 2 (Fase 14): mudar só o título do bolão. Qualquer outro campo continua bloqueado.
    if tg_table_name = 'bolaos' and tg_op = 'UPDATE'
       and (to_jsonb(new) - 'nome') = (to_jsonb(old) - 'nome') then
      return new;
    end if;
    raise exception 'Este bolão está congelado: jogos, recibos e dados do bolão não podem mais ser alterados, incluídos ou apagados.'
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.renomear_bolao(p_bolao uuid, p_nome text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_novo text := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  v_velho text;
begin
  if not public.is_adm() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if char_length(v_novo) < 3 or char_length(v_novo) > 80 then
    return jsonb_build_object('ok', false, 'erro', 'O título deve ter de 3 a 80 caracteres.');
  end if;
  select nome into v_velho from public.bolaos where id = p_bolao;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Bolão não encontrado.');
  end if;
  if v_velho = v_novo then
    return jsonb_build_object('ok', true, 'nome', v_novo);
  end if;
  update public.bolaos set nome = v_novo where id = p_bolao;
  insert into public.auditoria (usuario, acao, tabela, registro, detalhe)
  values (auth.uid(), 'RENOMEAR', 'bolaos', p_bolao::text, jsonb_build_object('de', v_velho, 'para', v_novo));
  return jsonb_build_object('ok', true, 'nome', v_novo);
end;
$$;

revoke all on function public.renomear_bolao(uuid, text) from public, anon, authenticated;
grant execute on function public.renomear_bolao(uuid, text) to authenticated, service_role;
