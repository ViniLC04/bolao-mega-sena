-- =====================================================================================================
-- TESTE da Fase 5 (2 passos no ADM e link pessoal do participante), rodado DENTRO do banco.
--
-- COMO USAR: SQL Editor → New query → cole TUDO → Run. Rode DEPOIS de 004_fase5.sql e bootstrap_adm.sql.
-- O RESULTADO APARECE COMO UM "ERRO" PROPOSITAL: "TUDO OK: ..." = passou; "FALHOU: ..." = a mensagem diz qual.
-- Em qualquer caso tudo é desfeito (rollback): NADA fica gravado (inclusive o fator de 2 passos de mentira).
-- =====================================================================================================
do $$
declare
  v_adm   uuid;
  v_b1    uuid;
  v_b2    uuid;
  v_b3    uuid;
  v_r1    uuid;
  v_r2    uuid;
  v_r3    uuid;
  v_p1    uuid;
  v_p2    uuid;
  v_ta    text := repeat('a', 64);
  v_tb    text := repeat('b', 64);
  v_txt   text;
  v_n     int;
  v_tinha boolean;
begin
  select user_id into v_adm from public.admins limit 1;
  if v_adm is null then raise exception 'FALHOU: cadastre o ADM antes (supabase/bootstrap_adm.sql).'; end if;
  select exists (select 1 from auth.mfa_factors where user_id = v_adm and status = 'verified') into v_tinha;

  -- ===== como ADM (sem exigir 2 passos aqui: este teste mexe nos fatores de mentira só depois) =====
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);

  insert into public.participantes (nome, contato, link_token, link_ativo) values ('ZZ PESSOA UM', 'um@contato.secreto', v_ta, true) returning id into v_p1;
  insert into public.participantes (nome, contato, link_token, link_ativo) values ('ZZ PESSOA DOIS', 'dois@contato.secreto', v_tb, true) returning id into v_p2;

  -- Bolão 1 (congelado) só com a pessoa 1; bolão 2 (congelado) só com a pessoa 2; bolão 3 (rascunho) com a pessoa 1.
  insert into public.bolaos (concurso_alvo, nome, n_cotas) values (999999, 'TESTE LINK BOLAO UM', 10) returning id into v_b1;
  insert into public.recibos (bolao_id, ordem, k, g, total_cent, cotas_n) values (v_b1, 1, 6, 1, 600, 10) returning id into v_r1;
  insert into public.jogos (recibo_id, ordem, dezenas) values (v_r1, 1, array[1,2,3,4,5,6]::smallint[]);
  insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent) values (v_p1, v_b1, 2, 120);
  perform public.congelar_bolao(v_b1, repeat('c', 64), array[1]);

  insert into public.bolaos (concurso_alvo, nome, n_cotas) values (999999, 'TESTE LINK BOLAO DOIS', 10) returning id into v_b2;
  insert into public.recibos (bolao_id, ordem, k, g, total_cent, cotas_n) values (v_b2, 1, 6, 1, 600, 10) returning id into v_r2;
  insert into public.jogos (recibo_id, ordem, dezenas) values (v_r2, 1, array[7,8,9,10,11,12]::smallint[]);
  insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent) values (v_p2, v_b2, 3, 180);
  perform public.congelar_bolao(v_b2, repeat('d', 64), array[2]);

  insert into public.bolaos (concurso_alvo, nome, n_cotas) values (999999, 'TESTE LINK RASCUNHO', 10) returning id into v_b3;
  insert into public.recibos (bolao_id, ordem, k, g, total_cent, cotas_n) values (v_b3, 1, 6, 1, 600, 10) returning id into v_r3;
  insert into public.jogos (recibo_id, ordem, dezenas) values (v_r3, 1, array[20,21,22,23,24,25]::smallint[]);
  insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent) values (v_p1, v_b3, 1, 60);

  -- ===== como VISITANTE (anon) com o link da pessoa 1 =====
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';

  select string_agg(t::text, ' | ') into v_txt from public.publico_participante(v_ta) t;
  if v_txt is null or v_txt not like '%TESTE LINK BOLAO UM%' then raise exception 'FALHOU: o link da pessoa 1 não mostrou o bolão dela: %', v_txt; end if;
  if v_txt like '%BOLAO DOIS%' or v_txt ilike '%PESSOA DOIS%' or v_txt ilike '%contato.secreto%' then raise exception 'FALHOU: o link da pessoa 1 mostrou dado de outra pessoa ou contato: %', v_txt; end if;
  select count(*) into v_n from public.publico_participante(v_ta);
  if v_n <> 2 then raise exception 'FALHOU: a pessoa 1 deveria ver 2 bolões (o congelado e o rascunho dela), viu %', v_n; end if;

  -- jogos: só do bolão em que participa e só se congelado
  select count(*) into v_n from public.publico_participante_jogos(v_ta, v_b1);
  if v_n <> 1 then raise exception 'FALHOU: a pessoa 1 deveria ver 1 jogo do bolão congelado dela, viu %', v_n; end if;
  select count(*) into v_n from public.publico_participante_jogos(v_ta, v_b2);
  if v_n <> 0 then raise exception 'FALHOU: a pessoa 1 viu jogos de um bolão em que não participa'; end if;
  select count(*) into v_n from public.publico_participante_jogos(v_ta, v_b3);
  if v_n <> 0 then raise exception 'FALHOU: a pessoa 1 viu jogos de um bolão ainda em rascunho'; end if;

  -- token errado, vazio, curto, nulo
  select count(*) into v_n from public.publico_participante(repeat('e', 64));
  if v_n <> 0 then raise exception 'FALHOU: token errado devolveu dados'; end if;
  select count(*) into v_n from public.publico_participante('') ;
  if v_n <> 0 then raise exception 'FALHOU: token vazio devolveu dados'; end if;
  select count(*) into v_n from public.publico_participante(null);
  if v_n <> 0 then raise exception 'FALHOU: token nulo devolveu dados'; end if;
  select count(*) into v_n from public.publico_participante('a');
  if v_n <> 0 then raise exception 'FALHOU: token curto devolveu dados'; end if;
  begin
    perform 1 from public.participantes limit 1;
    raise exception 'FALHOU: o público leu a tabela participantes';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  -- token desativado
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  update public.participantes set link_ativo = false where id = v_p1;
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into v_n from public.publico_participante(v_ta);
  if v_n <> 0 then raise exception 'FALHOU: link desativado ainda mostra dados'; end if;
  execute 'reset role';

  -- token fraco é recusado pela tabela
  begin
    update public.participantes set link_token = 'curto' where id = v_p2;
    raise exception 'FALHOU: aceitou token fraco';
  exception when check_violation then null;
  end;

  -- ===== 2 passos: com fator ativo, só aal2 vale como ADM =====
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  execute 'set local role authenticated';
  if v_tinha is false and public.is_adm() is not true then
    raise exception 'FALHOU: sem fator de 2 passos, a senha sozinha deveria bastar (para não trancar você de fora)';
  end if;
  execute 'reset role';

  insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
  values (gen_random_uuid(), v_adm, 'totp', 'verified', now(), now());

  execute 'set local role authenticated';
  if public.is_adm() is true then raise exception 'FALHOU: com fator ativo, a sessão só com senha (aal1) ainda é tratada como ADM'; end if;
  begin
    perform 1 from public.participantes limit 1; -- RLS devolve 0 linhas (não dá erro)
    select count(*) into v_n from public.participantes;
    if v_n <> 0 then raise exception 'FALHOU: sessão aal1 leu participantes (%)', v_n; end if;
  end;
  begin
    insert into public.participantes (nome) values ('ZZ INVASOR AAL1');
    raise exception 'FALHOU: sessão aal1 gravou participante';
  exception when insufficient_privilege or others then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
  if public.is_adm() is not true then raise exception 'FALHOU: com os 2 passos (aal2) o ADM deixou de ser ADM'; end if;
  select count(*) into v_n from public.participantes where id = v_p2;
  if v_n <> 1 then raise exception 'FALHOU: sessão aal2 não leu participantes'; end if;
  execute 'reset role';

  raise exception 'TUDO OK: 2 passos e link pessoal passaram. Este "erro" é o desfazer proposital: nada foi gravado.';
end
$$;
