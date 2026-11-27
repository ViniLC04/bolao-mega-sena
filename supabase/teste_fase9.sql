-- =====================================================================================================
-- TESTE da conta do apostador (Fase 9), rodado DENTRO do banco.
--
-- COMO USAR: SQL Editor → New query → cole TUDO → Run. Rode DEPOIS de 009_conta_apostador.sql e bootstrap_adm.sql.
-- O RESULTADO APARECE COMO UM "ERRO" PROPOSITAL: "TUDO OK: ..." = passou; "FALHOU: ..." = a mensagem diz qual.
-- Em qualquer caso tudo é desfeito (rollback): NADA fica gravado.
-- =====================================================================================================
do $$
declare
  v_adm  uuid;
  v_ana  uuid := gen_random_uuid();
  v_bia  uuid := gen_random_uuid();
  v_b    uuid;
  v_tok  text := repeat('9', 64);
  v_tp   text;
  v_r    jsonb;
  v_n    int;
begin
  select user_id into v_adm from public.admins limit 1;
  if v_adm is null then raise exception 'FALHOU: cadastre o ADM antes (supabase/bootstrap_adm.sql).'; end if;
  insert into auth.users (id, email) values (v_ana, 'ana-teste-fase9@example.com'), (v_bia, 'bia-teste-fase9@example.com');

  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  insert into public.bolaos (concurso_alvo, nome, n_cotas, status, cota_base_cent, inscricoes_ate)
  values (999999, 'TESTE CONTA', null, 'aberto', 10000, now() + interval '3 days') returning id into v_b;
  insert into public.bolao_links (bolao_id, token, ativo, autoinscricao, max_cotas_pessoa) values (v_b, v_tok, true, true, 10);

  -- inscrição anônima (como no site)
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
  v_r := public.inscrever_no_bolao(v_tok, 'Ana Maria Souza', '(11) 98888-1111', 2);
  if (v_r ->> 'ok')::boolean is not true then raise exception 'FALHOU: inscrição: %', v_r; end if;
  v_tp := v_r ->> 'token';
  begin
    perform public.vincular_minha_conta(v_tp);
    raise exception 'FALHOU: visitante sem login conseguiu chamar vincular_minha_conta';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.minhas_participacoes();
    raise exception 'FALHOU: visitante sem login conseguiu chamar minhas_participacoes';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  -- Ana (conta comum, não ADM) vincula
  perform set_config('request.jwt.claims', json_build_object('sub', v_ana, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('request.jwt.claim.sub', v_ana::text, true);
  execute 'set local role authenticated';
  if public.is_adm() then raise exception 'FALHOU: conta comum virou ADM'; end if;
  select count(*) into v_n from public.minhas_participacoes();
  if v_n <> 0 then raise exception 'FALHOU: conta nova já vê participações'; end if;
  v_r := public.vincular_minha_conta(repeat('0', 64));
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: vinculou token inválido'; end if;
  v_r := public.vincular_minha_conta(v_tp);
  if (v_r ->> 'ok')::boolean is not true then raise exception 'FALHOU: vínculo válido recusado: %', v_r; end if;
  v_r := public.vincular_minha_conta(v_tp);
  if (v_r ->> 'ok')::boolean is not true then raise exception 'FALHOU: vínculo repetido pela mesma conta deveria ser aceito'; end if;
  select count(*) into v_n from public.minhas_participacoes() where link_token = v_tp and qtd = 2;
  if v_n <> 1 then raise exception 'FALHOU: Ana não vê a própria participação'; end if;
  begin
    perform 1 from public.participantes limit 1;
    get diagnostics v_n = row_count;
  exception when others then v_n := 0;
  end;
  if v_n <> 0 then raise exception 'FALHOU: conta comum leu a tabela participantes'; end if;
  execute 'reset role';

  -- Bia não pega o link da Ana e não vê nada dela
  perform set_config('request.jwt.claims', json_build_object('sub', v_bia, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('request.jwt.claim.sub', v_bia::text, true);
  execute 'set local role authenticated';
  v_r := public.vincular_minha_conta(v_tp);
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: Bia roubou o link da Ana: %', v_r; end if;
  select count(*) into v_n from public.minhas_participacoes();
  if v_n <> 0 then raise exception 'FALHOU: Bia vê participações da Ana'; end if;
  execute 'reset role';

  raise exception 'TUDO OK: vínculo, bloqueio de outra conta, conta comum sem acesso a dados e sem ADM passaram (nada foi gravado).';
end
$$;
