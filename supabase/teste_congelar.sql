-- =====================================================================================================
-- TESTE da função congelar_bolao e da imutabilidade, rodado DENTRO do banco.
--
-- COMO USAR: SQL Editor → New query → cole TUDO → Run. Rode DEPOIS de 001_fase2.sql e bootstrap_adm.sql.
--
-- O RESULTADO APARECE COMO UM "ERRO" AMARELO/VERMELHO. ISSO É PROPOSITAL:
--   * "TUDO OK: ..."  = todas as verificações passaram. O erro desfaz (rollback) tudo o que o teste criou:
--                       NADA fica gravado no banco.
--   * "FALHOU: ..."   = alguma verificação falhou; a mensagem diz qual. Também não deixa nada gravado.
-- =====================================================================================================
do $$
declare
  v_adm    uuid;
  v_b1     uuid;
  v_b2     uuid;
  v_rec    uuid;
  v_res    jsonb;
  v_n      int;
  v_hash   text := repeat('a', 64);
begin
  select user_id into v_adm from public.admins limit 1;
  if v_adm is null then
    raise exception 'FALHOU: cadastre o ADM antes (supabase/bootstrap_adm.sql).';
  end if;

  -- Passa a "ser" o ADM só dentro desta transação (é assim que auth.uid() enxerga o usuário logado).
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);

  -- Bolão de teste no concurso fictício 999999, com um recibo e um jogo de 7 dezenas.
  insert into public.bolaos (concurso_alvo, nome, n_cotas) values (999999, 'TESTE CONGELAR 1', 20) returning id into v_b1;
  insert into public.recibos (bolao_id, ordem, k, g, total_cent, cotas_n) values (v_b1, 1, 7, 1, 4200, 20) returning id into v_rec;
  insert into public.jogos (recibo_id, ordem, dezenas) values (v_rec, 1, array[1,2,3,4,5,6,7]::smallint[]);

  -- 1) combinações repetidas dentro do próprio bolão são recusadas
  begin
    perform public.congelar_bolao(v_b1, v_hash, array[1,1,2]);
    raise exception 'FALHOU: aceitou combinações repetidas';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%repetida%' then raise exception 'FALHOU: mensagem inesperada (repetidas): %', sqlerrm; end if;
  end;

  -- 2) hash inválido
  begin
    perform public.congelar_bolao(v_b1, 'xyz', array[1,2,3]);
    raise exception 'FALHOU: aceitou hash inválido';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%Hash inválido%' then raise exception 'FALHOU: mensagem inesperada (hash): %', sqlerrm; end if;
  end;

  -- 3) combinação fora do intervalo
  begin
    perform public.congelar_bolao(v_b1, v_hash, array[50063860]);
    raise exception 'FALHOU: aceitou combinação fora do intervalo';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%fora do intervalo%' then raise exception 'FALHOU: mensagem inesperada (intervalo): %', sqlerrm; end if;
  end;

  -- 4) quem não é o ADM não congela
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  begin
    perform public.congelar_bolao(v_b1, v_hash, array[1,2,3]);
    raise exception 'FALHOU: um usuário comum conseguiu congelar';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%Acesso negado%' then raise exception 'FALHOU: mensagem inesperada (acesso): %', sqlerrm; end if;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);

  -- 5) congelar de verdade
  v_res := public.congelar_bolao(v_b1, v_hash, array[10,11,12]);
  if (v_res ->> 'combinacoes')::int <> 3 then raise exception 'FALHOU: devolveu % combinações (esperado 3)', v_res ->> 'combinacoes'; end if;
  if not exists (select 1 from public.bolaos where id = v_b1 and status = 'congelado' and hash = v_hash and congelado_em is not null) then
    raise exception 'FALHOU: o bolão não ficou congelado com hash e data';
  end if;
  select count(*) into v_n from public.combinacoes_cobertas where concurso = 999999 and bolao_id = v_b1;
  if v_n <> 3 then raise exception 'FALHOU: gravou % combinações cobertas (esperado 3)', v_n; end if;
  if not exists (select 1 from public.auditoria where acao = 'CONGELAR' and registro = v_b1::text) then
    raise exception 'FALHOU: o congelamento não foi para a auditoria';
  end if;

  -- 6) não congela duas vezes
  begin
    perform public.congelar_bolao(v_b1, v_hash, array[20,21]);
    raise exception 'FALHOU: congelou duas vezes';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%já está congelado%' then raise exception 'FALHOU: mensagem inesperada (duas vezes): %', sqlerrm; end if;
  end;

  -- 7) imutabilidade: nada muda depois de congelado
  begin
    update public.bolaos set nome = 'MUDEI' where id = v_b1;
    raise exception 'FALHOU: alterou um bolão congelado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%congelado%' then raise exception 'FALHOU: mensagem inesperada (bolão): %', sqlerrm; end if;
  end;
  begin
    update public.jogos set travado = true where recibo_id = v_rec;
    raise exception 'FALHOU: alterou jogo de bolão congelado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%congelado%' then raise exception 'FALHOU: mensagem inesperada (jogo): %', sqlerrm; end if;
  end;
  begin
    insert into public.jogos (recibo_id, ordem, dezenas) values (v_rec, 2, array[10,20,30,40,50,60]::smallint[]);
    raise exception 'FALHOU: incluiu jogo em bolão congelado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%congelado%' then raise exception 'FALHOU: mensagem inesperada (incluir): %', sqlerrm; end if;
  end;
  begin
    delete from public.recibos where id = v_rec;
    raise exception 'FALHOU: apagou recibo de bolão congelado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%congelado%' then raise exception 'FALHOU: mensagem inesperada (apagar): %', sqlerrm; end if;
  end;
  begin
    update public.recibos set total_cent = 1 where id = v_rec;
    raise exception 'FALHOU: alterou o valor do recibo congelado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%congelado%' then raise exception 'FALHOU: mensagem inesperada (valor): %', sqlerrm; end if;
  end;
  -- Única exceção permitida: a foto do recibo.
  update public.recibos set foto_path = 'recibos/teste.jpg' where id = v_rec;

  -- 8) o 2º bolão do mesmo concurso NÃO pode repetir combinação do 1º (a 12 já está coberta)
  insert into public.bolaos (concurso_alvo, nome, n_cotas) values (999999, 'TESTE CONGELAR 2', 20) returning id into v_b2;
  begin
    perform public.congelar_bolao(v_b2, v_hash, array[12,13]);
    raise exception 'FALHOU: aceitou combinação já coberta por outro bolão';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%já estão cobertas%' then raise exception 'FALHOU: mensagem inesperada (cruzamento): %', sqlerrm; end if;
  end;
  if exists (select 1 from public.combinacoes_cobertas where bolao_id = v_b2) then
    raise exception 'FALHOU: o congelamento recusado deixou combinações gravadas';
  end if;
  if (select status from public.bolaos where id = v_b2) <> 'rascunho' then
    raise exception 'FALHOU: o congelamento recusado mudou o status do 2º bolão';
  end if;

  -- 9) com combinações novas, o 2º bolão congela
  v_res := public.congelar_bolao(v_b2, repeat('b', 64), array[13,14]);
  if (v_res ->> 'combinacoes')::int <> 2 then raise exception 'FALHOU: 2º bolão devolveu % combinações', v_res ->> 'combinacoes'; end if;

  -- Tudo certo. O erro abaixo desfaz o teste inteiro (nada fica gravado).
  raise exception 'TUDO OK: 9 verificações passaram (congelar, recusas, imutabilidade e cruzamento). Este "erro" é o desfazer proposital: nada foi gravado.';
end
$$;
