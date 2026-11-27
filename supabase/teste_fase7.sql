-- =====================================================================================================
-- TESTE do bolão ABERTO (Fase 7), rodado DENTRO do banco.
--
-- COMO USAR: SQL Editor → New query → cole TUDO → Run. Rode DEPOIS de 006_fase7.sql e bootstrap_adm.sql.
-- O RESULTADO APARECE COMO UM "ERRO" PROPOSITAL: "TUDO OK: ..." = passou; "FALHOU: ..." = a mensagem diz qual.
-- Em qualquer caso tudo é desfeito (rollback): NADA fica gravado.
-- =====================================================================================================
do $$
declare
  v_adm  uuid;
  v_a    uuid;   -- bolão aberto com 1 cota só
  v_b    uuid;   -- bolão aberto com 5 cotas
  v_p1   uuid;
  v_p2   uuid;
  v_r    jsonb;
  v_n    int;
  v_st   text;
  v_tok  text := repeat('d', 64);
begin
  select user_id into v_adm from public.admins limit 1;
  if v_adm is null then raise exception 'FALHOU: cadastre o ADM antes (supabase/bootstrap_adm.sql).'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);

  insert into public.participantes (nome) values ('ZZ ABERTO UM') returning id into v_p1;
  insert into public.participantes (nome) values ('ZZ ABERTO DOIS') returning id into v_p2;

  -- 1) bolão aberto: sem N, com valor da cota e data de inscrição no futuro
  insert into public.bolaos (concurso_alvo, nome, n_cotas, status, cota_base_cent, inscricoes_ate)
  values (999999, 'TESTE ABERTO A', null, 'aberto', 10000, now() + interval '2 days') returning id into v_a;
  insert into public.bolaos (concurso_alvo, nome, n_cotas, status, cota_base_cent, inscricoes_ate)
  values (999999, 'TESTE ABERTO B', null, 'aberto', 10000, now() + interval '2 days') returning id into v_b;

  -- só o bolão aberto pode ficar sem N
  begin
    insert into public.bolaos (concurso_alvo, nome, n_cotas, status) values (999999, 'SEM N', null, 'rascunho');
    raise exception 'FALHOU: aceitou bolão em rascunho sem N';
  exception when check_violation then null;
  end;

  -- 2) cotas sem limite enquanto aberto (aqui, muito além de 100)
  insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent) values (v_p1, v_b, 3, 30000);
  insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent) values (v_p2, v_b, 2, 20000);
  update public.cotas set qtd = 150, valor_devido_cent = 1500000 where participante_id = v_p2 and bolao_id = v_b;
  update public.cotas set qtd = 2, valor_devido_cent = 20000 where participante_id = v_p2 and bolao_id = v_b;

  -- 3) depois da data de inscrição: cota nova recusada, marcar pago continua livre
  update public.bolaos set inscricoes_ate = now() - interval '1 hour' where id = v_b;
  begin
    insert into public.participantes (nome) values ('ZZ TARDE');
    insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent)
    values ((select id from public.participantes where nome = 'ZZ TARDE'), v_b, 1, 10000);
    raise exception 'FALHOU: aceitou cota depois da data de inscrição';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%inscrições deste bolão encerraram%' then raise exception 'FALHOU: mensagem inesperada (inscrição): %', sqlerrm; end if;
  end;
  update public.cotas set qtd_paga = qtd where bolao_id = v_b; -- fechar conta só as cotas pagas (Fase 8)
  -- prorrogar: volta a aceitar
  update public.bolaos set inscricoes_ate = now() + interval '1 day' where id = v_b;

  -- 4) fechar com cotas de menos (bolão A: 1 cota só) é recusado
  update public.bolaos set inscricoes_ate = now() + interval '1 day' where id = v_a;
  insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent, qtd_paga) values (v_p1, v_a, 1, 10000, 1);
  begin
    perform public.fechar_inscricoes(v_a);
    raise exception 'FALHOU: fechou com 1 cota';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%precisa ter de%' then raise exception 'FALHOU: mensagem inesperada (fechar com 1): %', sqlerrm; end if;
  end;

  -- 5) fechar o bolão B (5 cotas): N = 5 e vira rascunho; depois disso não passa de N
  v_r := public.fechar_inscricoes(v_b);
  if (v_r ->> 'n_cotas')::int <> 5 then raise exception 'FALHOU: N deveria ser 5: %', v_r; end if;
  select status, n_cotas into v_st, v_n from public.bolaos where id = v_b;
  if v_st <> 'rascunho' or v_n <> 5 then raise exception 'FALHOU: depois de fechar: % %', v_st, v_n; end if;
  begin
    insert into public.participantes (nome) values ('ZZ ATRASADO');
    insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent)
    values ((select id from public.participantes where nome = 'ZZ ATRASADO'), v_b, 1, 10000);
    raise exception 'FALHOU: aceitou cota além de N depois de fechar';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%Cotas demais%' then raise exception 'FALHOU: mensagem inesperada (além de N): %', sqlerrm; end if;
  end;
  begin
    perform public.fechar_inscricoes(v_b);
    raise exception 'FALHOU: fechou duas vezes';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;

  -- 6) reabrir: volta a aberto sem N; com jogos salvos não reabre
  v_r := public.reabrir_inscricoes(v_b);
  select status, n_cotas into v_st, v_n from public.bolaos where id = v_b;
  if v_st <> 'aberto' or v_n is not null then raise exception 'FALHOU: depois de reabrir: % %', v_st, v_n; end if;
  perform public.fechar_inscricoes(v_b);
  insert into public.recibos (bolao_id, ordem, k, g, total_cent, cotas_n) values (v_b, 0, 6, 1, 600, 5);
  begin
    perform public.reabrir_inscricoes(v_b);
    raise exception 'FALHOU: reabriu um bolão que já tem jogos';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%jogos salvos%' then raise exception 'FALHOU: mensagem inesperada (reabrir): %', sqlerrm; end if;
  end;

  -- 7) um bolão aberto não pode ser congelado
  begin
    perform public.congelar_bolao(v_a, repeat('a', 64), array[1]);
    raise exception 'FALHOU: congelou um bolão aberto';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;

  -- 8) link público de bolão aberto: N vazio, data de inscrição, sem sobrenome
  insert into public.bolao_links (bolao_id, token, ativo) values (v_a, v_tok, true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
  select count(*) into v_n from public.publico_bolao(v_tok) t
    where t.n_cotas is null and t.status = 'aberto' and t.inscricoes_ate is not null and t.cota_cent = 10000 and t.cotas_vendidas = 1;
  if v_n <> 1 then raise exception 'FALHOU: o link público não mostrou o bolão aberto como esperado'; end if;
  -- o visitante não fecha nem reabre inscrições
  begin
    perform public.fechar_inscricoes(v_a);
    raise exception 'FALHOU: o visitante fechou inscrições';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reabrir_inscricoes(v_a);
    raise exception 'FALHOU: o visitante reabriu inscrições';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  raise exception 'TUDO OK: bolão aberto sem N, data de inscrição, fechar, reabrir e link público passaram. Este "erro" é o desfazer proposital: nada foi gravado.';
end
$$;
