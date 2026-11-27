-- =====================================================================================================
-- TESTE de registrar_concurso / confirmar_concurso / rejeitar_concurso, rodado DENTRO do banco.
--
-- COMO USAR: SQL Editor → New query → cole TUDO → Run. Rode DEPOIS de 003_fase4.sql e bootstrap_adm.sql.
-- O RESULTADO APARECE COMO UM "ERRO" PROPOSITAL: "TUDO OK: ..." = passou; "FALHOU: ..." = a mensagem diz qual.
-- Em qualquer caso tudo é desfeito (rollback): NADA fica gravado.
-- =====================================================================================================
do $$
declare
  v_adm    uuid;
  v_ult    int;
  v_dt     date;
  v_r      jsonb;
  v_n      int;
  v_texto  text;
  i        int;
begin
  select user_id into v_adm from public.admins limit 1;
  if v_adm is null then raise exception 'FALHOU: cadastre o ADM antes (supabase/bootstrap_adm.sql).'; end if;
  select max(numero) into v_ult from public.concursos;
  select data into v_dt from public.concursos where numero = v_ult;
  if v_ult is null then raise exception 'FALHOU: importe os concursos antes (tela Concursos).'; end if;

  -- ===== como VISITANTE (anon) =====
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';

  -- 1) concurso válido (o próximo) entra como "aguardando"
  v_r := public.registrar_concurso(jsonb_build_object('numero', v_ult + 1, 'data', (v_dt + 3)::text, 'dezenas', jsonb_build_array(1, 2, 3, 4, 5, 6),
          'arrecadacao_cent', 100, 'faixas', jsonb_build_array(
            jsonb_build_object('faixa', 4, 'ganhadores', 10, 'valor_cent', 5000),
            jsonb_build_object('faixa', 5, 'ganhadores', 1, 'valor_cent', 500000),
            jsonb_build_object('faixa', 6, 'ganhadores', 0, 'valor_cent', 0))));
  if (v_r ->> 'ok')::boolean is not true or v_r ->> 'status' <> 'aguardando' then raise exception 'FALHOU: concurso do visitante não entrou como aguardando: %', v_r; end if;

  -- 2) o mesmo número de novo (nunca sobrescreve)
  v_r := public.registrar_concurso(jsonb_build_object('numero', v_ult + 1, 'data', (v_dt + 3)::text, 'dezenas', jsonb_build_array(7, 8, 9, 10, 11, 12), 'faixas', '[]'::jsonb));
  if (v_r ->> 'ok')::boolean is not false or v_r ->> 'erro' not like '%Fora de sequência%' then raise exception 'FALHOU: aceitou repetir o concurso: %', v_r; end if;
  if (select dezenas from public.concursos where numero = v_ult + 1) <> array[1,2,3,4,5,6]::smallint[] then raise exception 'FALHOU: sobrescreveu o concurso'; end if;

  -- 3) pulando um número
  v_r := public.registrar_concurso(jsonb_build_object('numero', v_ult + 5, 'data', (v_dt + 9)::text, 'dezenas', jsonb_build_array(1, 2, 3, 4, 5, 6), 'faixas', '[]'::jsonb));
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: aceitou concurso fora da sequência: %', v_r; end if;

  -- 4) dezenas repetidas; dezena 61; rateio faltando; valor negativo
  v_r := public.registrar_concurso(jsonb_build_object('numero', v_ult + 2, 'data', (v_dt + 6)::text, 'dezenas', jsonb_build_array(1, 1, 3, 4, 5, 6), 'faixas', '[]'::jsonb));
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: aceitou dezenas repetidas'; end if;
  v_r := public.registrar_concurso(jsonb_build_object('numero', v_ult + 2, 'data', (v_dt + 6)::text, 'dezenas', jsonb_build_array(1, 2, 3, 4, 5, 61), 'faixas', '[]'::jsonb));
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: aceitou dezena 61'; end if;
  v_r := public.registrar_concurso(jsonb_build_object('numero', v_ult + 2, 'data', (v_dt + 6)::text, 'dezenas', jsonb_build_array(1, 2, 3, 4, 5, 6), 'faixas', '[]'::jsonb));
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: aceitou concurso sem rateio'; end if;
  v_r := public.registrar_concurso(jsonb_build_object('numero', v_ult + 2, 'data', (v_dt + 6)::text, 'dezenas', jsonb_build_array(1, 2, 3, 4, 5, 6), 'arrecadacao_cent', -5, 'faixas', jsonb_build_array(
            jsonb_build_object('faixa', 4, 'ganhadores', 10, 'valor_cent', 5000), jsonb_build_object('faixa', 5, 'ganhadores', 1, 'valor_cent', 500000), jsonb_build_object('faixa', 6, 'ganhadores', 0, 'valor_cent', 0))));
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: aceitou valor negativo'; end if;
  v_r := public.registrar_concurso('{"lixo": true}'::jsonb);
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: aceitou JSON qualquer'; end if;

  -- 5) visitante não confirma nem rejeita
  begin
    perform public.confirmar_concurso(v_ult + 1);
    raise exception 'FALHOU: o visitante confirmou um concurso';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.rejeitar_concurso(v_ult + 1);
    raise exception 'FALHOU: o visitante rejeitou um concurso';
  exception when insufficient_privilege then null;
  end;

  -- 6) a Viradas pública responde
  perform public.publico_viradas();
  execute 'reset role';

  -- ===== como ADM =====
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  execute 'set local role authenticated';

  -- 7) confirma o concurso do visitante; confirmar de novo é recusado
  v_r := public.confirmar_concurso(v_ult + 1);
  if v_r ->> 'status' <> 'confirmado' then raise exception 'FALHOU: não confirmou'; end if;
  begin
    perform public.confirmar_concurso(v_ult + 1);
    raise exception 'FALHOU: confirmou duas vezes';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;

  -- 8) ADM + 2ª fonte batendo → entra confirmado direto
  v_r := public.registrar_concurso(jsonb_build_object('numero', v_ult + 2, 'data', (v_dt + 6)::text, 'dezenas', jsonb_build_array(10, 20, 30, 40, 50, 60),
          'faixas', jsonb_build_array(jsonb_build_object('faixa', 4, 'ganhadores', 1, 'valor_cent', 100), jsonb_build_object('faixa', 5, 'ganhadores', 0, 'valor_cent', 0), jsonb_build_object('faixa', 6, 'ganhadores', 0, 'valor_cent', 0))), 'Caixa (navegador do ADM)', true);
  if v_r ->> 'status' <> 'confirmado' then raise exception 'FALHOU: ADM com 2ª fonte deveria entrar confirmado: %', v_r; end if;

  -- 9) rejeitar: só aguardando e só o último
  v_r := public.registrar_concurso(jsonb_build_object('numero', v_ult + 3, 'data', (v_dt + 9)::text, 'dezenas', jsonb_build_array(2, 4, 6, 8, 10, 12),
          'faixas', jsonb_build_array(jsonb_build_object('faixa', 4, 'ganhadores', 1, 'valor_cent', 100), jsonb_build_object('faixa', 5, 'ganhadores', 0, 'valor_cent', 0), jsonb_build_object('faixa', 6, 'ganhadores', 0, 'valor_cent', 0))));
  -- registrado pelo ADM sem a 2ª fonte batendo: tem de ficar aguardando
  if v_r ->> 'status' <> 'aguardando' then raise exception 'FALHOU: ADM sem 2ª fonte deveria entrar aguardando: %', v_r; end if;
  begin
    perform public.rejeitar_concurso(v_ult + 2);
    raise exception 'FALHOU: rejeitou concurso já confirmado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  perform public.rejeitar_concurso(v_ult + 3);
  if exists (select 1 from public.concursos where numero = v_ult + 3) or exists (select 1 from public.concurso_faixas where concurso = v_ult + 3) then
    raise exception 'FALHOU: o concurso rejeitado continua no banco';
  end if;
  execute 'reset role';

  -- 10) limite de tentativas recusadas por minuto
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
  for i in 1..25 loop
    v_r := public.registrar_concurso('{"lixo": true}'::jsonb);
  end loop;
  v_r := public.registrar_concurso(jsonb_build_object('numero', v_ult + 3, 'data', (v_dt + 9)::text, 'dezenas', jsonb_build_array(2, 4, 6, 8, 10, 12),
          'faixas', jsonb_build_array(jsonb_build_object('faixa', 4, 'ganhadores', 1, 'valor_cent', 100), jsonb_build_object('faixa', 5, 'ganhadores', 0, 'valor_cent', 0), jsonb_build_object('faixa', 6, 'ganhadores', 0, 'valor_cent', 0))));
  if (v_r ->> 'ok')::boolean is not false or v_r ->> 'erro' not like '%Muitas atualizações%' then raise exception 'FALHOU: não limitou tentativas seguidas: %', v_r; end if;
  execute 'reset role';

  raise exception 'TUDO OK: registrar, confirmar, rejeitar e os limites passaram. Este "erro" é o desfazer proposital: nada foi gravado.';
end
$$;
