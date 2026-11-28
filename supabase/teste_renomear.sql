-- =====================================================================================================
-- TESTE de renomear_bolao (Fase 14), rodado DENTRO do banco. Rode DEPOIS de 011_renomear_bolao.sql.
-- COMO USAR: SQL Editor → New query → cole TUDO → Run.
-- O RESULTADO APARECE COMO UM "ERRO": "TUDO OK: ..." = passou (e nada fica gravado); "FALHOU: ..." = falhou.
-- =====================================================================================================
do $$
declare
  v_adm  uuid;
  v_b    uuid;
  v_res  jsonb;
  v_n    int;
begin
  select user_id into v_adm from public.admins limit 1;
  if v_adm is null then
    raise exception 'FALHOU: cadastre o ADM antes (supabase/bootstrap_adm.sql).';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);

  -- bolão de teste, já congelado
  insert into public.bolaos (concurso_alvo, nome, n_cotas) values (999999, 'TESTE RENOMEAR', 20) returning id into v_b;
  update public.bolaos set status = 'congelado', congelado_em = now(), hash = repeat('b', 64) where id = v_b;

  -- 1) título curto demais é recusado
  v_res := public.renomear_bolao(v_b, 'ab');
  if (v_res ->> 'ok') <> 'false' then raise exception 'FALHOU: aceitou título curto'; end if;

  -- 2) renomear bolão congelado funciona e o hash não muda
  v_res := public.renomear_bolao(v_b, '  Novo   título do bolão ');
  if (v_res ->> 'ok') <> 'true' then raise exception 'FALHOU: não renomeou (%)', v_res; end if;
  if (select nome from public.bolaos where id = v_b) <> 'Novo título do bolão' then raise exception 'FALHOU: nome não ficou limpo'; end if;
  if (select hash from public.bolaos where id = v_b) <> repeat('b', 64) then raise exception 'FALHOU: o hash mudou'; end if;

  -- 3) ficou registrado na auditoria (de → para)
  select count(*) into v_n from public.auditoria
   where acao = 'RENOMEAR' and registro = v_b::text and detalhe ->> 'de' = 'TESTE RENOMEAR' and detalhe ->> 'para' = 'Novo título do bolão';
  if v_n <> 1 then raise exception 'FALHOU: auditoria não registrou a troca (%)', v_n; end if;

  -- 4) mudar outro campo do bolão congelado continua bloqueado
  begin
    update public.bolaos set n_cotas = 30 where id = v_b;
    raise exception 'FALHOU: alterou outro campo de bolão congelado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%congelado%' then raise exception 'FALHOU: mensagem inesperada: %', sqlerrm; end if;
  end;

  -- 5) apagar bolão congelado continua bloqueado
  begin
    delete from public.bolaos where id = v_b;
    raise exception 'FALHOU: apagou bolão congelado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%congelado%' then raise exception 'FALHOU: mensagem inesperada (apagar): %', sqlerrm; end if;
  end;

  -- 6) quem não é o ADM não renomeia
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  begin
    perform public.renomear_bolao(v_b, 'Invasor');
    raise exception 'FALHOU: um usuário comum renomeou';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%Acesso negado%' then raise exception 'FALHOU: mensagem inesperada (acesso): %', sqlerrm; end if;
  end;

  raise exception 'TUDO OK: 6 verificações passaram (renomear, hash intacto, auditoria, bloqueios e acesso). Este "erro" é o desfazer proposital: nada foi gravado.';
end $$;
