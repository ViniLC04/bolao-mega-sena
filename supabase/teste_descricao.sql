-- =====================================================================================================
-- TESTE da descrição do bolão (Fase 15), rodado DENTRO do banco. Rode DEPOIS de 012_descricao_bolao.sql.
-- COMO USAR: SQL Editor → New query → cole TUDO → Run.
-- O RESULTADO APARECE COMO UM "ERRO": "TUDO OK: ..." = passou (nada fica gravado); "FALHOU: ..." = falhou.
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

  insert into public.bolaos (concurso_alvo, nome, n_cotas) values (999999, 'TESTE DESCRICAO', 20) returning id into v_b;
  update public.bolaos set status = 'congelado', congelado_em = now(), hash = repeat('c', 64) where id = v_b;

  -- 1) descrição longa demais é recusada
  v_res := public.definir_descricao_bolao(v_b, repeat('x', 501));
  if (v_res ->> 'ok') <> 'false' then raise exception 'FALHOU: aceitou descrição com mais de 500 caracteres'; end if;

  -- 2) definir a descrição de bolão congelado funciona e o hash não muda
  v_res := public.definir_descricao_bolao(v_b, '  Bolão da família, cota fixa.  ');
  if (v_res ->> 'ok') <> 'true' then raise exception 'FALHOU: não gravou a descrição (%)', v_res; end if;
  if (select descricao from public.bolaos where id = v_b) <> 'Bolão da família, cota fixa.' then raise exception 'FALHOU: descrição não ficou limpa'; end if;
  if (select hash from public.bolaos where id = v_b) <> repeat('c', 64) then raise exception 'FALHOU: o hash mudou'; end if;

  -- 3) auditoria registrou
  select count(*) into v_n from public.auditoria
   where acao = 'DESCRICAO' and registro = v_b::text and detalhe ->> 'para' = 'Bolão da família, cota fixa.';
  if v_n <> 1 then raise exception 'FALHOU: auditoria não registrou (%)', v_n; end if;

  -- 4) outro campo de bolão congelado continua bloqueado
  begin
    update public.bolaos set n_cotas = 30 where id = v_b;
    raise exception 'FALHOU: alterou outro campo de bolão congelado';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%congelado%' then raise exception 'FALHOU: mensagem inesperada: %', sqlerrm; end if;
  end;

  -- 5) quem não é o ADM não altera
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  begin
    perform public.definir_descricao_bolao(v_b, 'Invasor');
    raise exception 'FALHOU: um usuário comum alterou a descrição';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%Acesso negado%' then raise exception 'FALHOU: mensagem inesperada (acesso): %', sqlerrm; end if;
  end;

  raise exception 'TUDO OK: 5 verificações passaram (descrição, hash intacto, auditoria, bloqueio e acesso). Este "erro" é o desfazer proposital: nada foi gravado.';
end $$;
