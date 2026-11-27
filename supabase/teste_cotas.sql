-- =====================================================================================================
-- TESTE de cotas, data limite e visão pública, rodado DENTRO do banco.
--
-- COMO USAR: SQL Editor → New query → cole TUDO → Run. Rode DEPOIS de 002_fase3.sql e bootstrap_adm.sql.
-- O RESULTADO APARECE COMO UM "ERRO" PROPOSITAL: "TUDO OK: ..." = passou; "FALHOU: ..." = a mensagem diz qual.
-- Em qualquer caso, tudo o que o teste cria é desfeito (rollback): NADA fica gravado.
-- =====================================================================================================
do $$
declare
  v_adm   uuid;
  v_b     uuid;
  v_rec   uuid;
  v_p1    uuid;
  v_p2    uuid;
  v_txt   text;
  v_n     int;
  v_lim   timestamptz;
begin
  select user_id into v_adm from public.admins limit 1;
  if v_adm is null then raise exception 'FALHOU: cadastre o ADM antes (supabase/bootstrap_adm.sql).'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);

  insert into public.bolaos (concurso_alvo, nome, n_cotas) values (999999, 'TESTE COTAS', 20) returning id into v_b;
  insert into public.recibos (bolao_id, ordem, k, g, total_cent, cotas_n) values (v_b, 1, 7, 1, 4200, 20) returning id into v_rec;
  insert into public.jogos (recibo_id, ordem, dezenas) values (v_rec, 1, array[1,2,3,4,5,6,7]::smallint[]);
  insert into public.participantes (nome, contato) values ('ZZ FULANO SECRETO', 'zz@contato.secreto') returning id into v_p1;
  insert into public.participantes (nome) values ('ZZ BELTRANO SECRETO') returning id into v_p2;

  -- 1) vende até N
  insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent) values (v_p1, v_b, 15, 150000);
  insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent) values (v_p2, v_b, 5, 50000);

  -- 2) a cota N+1 é recusada (seja outra pessoa, seja aumentar a quantidade)
  begin
    update public.cotas set qtd = 6 where participante_id = v_p2 and bolao_id = v_b;
    raise exception 'FALHOU: vendeu mais cotas que o bolão tem';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%Cotas demais%' then raise exception 'FALHOU: mensagem inesperada (cotas demais): %', sqlerrm; end if;
  end;

  -- 3) marcar pago e via entregue funciona
  update public.cotas set pago = true, via_entregue = true where participante_id = v_p1 and bolao_id = v_b;
  update public.cotas set pago = true where participante_id = v_p2 and bolao_id = v_b;

  -- 4) uma pessoa só tem um registro por bolão
  begin
    insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent) values (v_p1, v_b, 1, 10000);
    raise exception 'FALHOU: aceitou dois registros da mesma pessoa no mesmo bolão';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;

  -- 5) caixinha
  insert into public.caixinha_mov (bolao_id, valor_cent, motivo) values (v_b, 2600, 'teste');
  begin
    insert into public.caixinha_mov (bolao_id, valor_cent, motivo) values (v_b, 0, 'zero');
    raise exception 'FALHOU: aceitou lançamento de valor zero';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;

  -- 6) participante com cotas não pode ser apagado
  begin
    delete from public.participantes where id = v_p1;
    raise exception 'FALHOU: apagou participante que tem cotas';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;

  -- 7) data limite: depois dela, cota nova é recusada, mas marcar pago continua permitido
  select data_limite_vigente() into v_lim;
  if v_lim is not null then
    update public.rules_versions set json = jsonb_set(json, '{params,data_limite_aposta}', to_jsonb('2000-01-01T00:00:00-03:00'::text))
     where id = (select id from public.rules_versions where vigencia_inicio <= (now() at time zone 'America/Sao_Paulo')::date order by vigencia_inicio desc limit 1);
    begin
      insert into public.participantes (nome) values ('ZZ TARDE') returning id into v_p1;
      insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent) values (v_p1, v_b, 1, 10000);
      raise exception 'FALHOU: aceitou cota depois da data limite';
    exception when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      if sqlerrm not like '%data limite%' then raise exception 'FALHOU: mensagem inesperada (data limite): %', sqlerrm; end if;
    end;
    update public.cotas set via_entregue = true where participante_id = v_p2 and bolao_id = v_b;
  end if;

  -- 8) visão pública: congela o bolão e olha como o PÚBLICO (anon) enxerga
  perform public.congelar_bolao(v_b, repeat('b', 64), array[1,2,3,4,5,6,7]);
  execute 'set local role anon';
  begin
    perform 1 from public.participantes limit 1;
    raise exception 'FALHOU: o público leu a tabela participantes';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.cotas limit 1;
    raise exception 'FALHOU: o público leu a tabela cotas';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.caixinha_mov limit 1;
    raise exception 'FALHOU: o público leu a tabela caixinha_mov';
  exception when insufficient_privilege then null;
  end;
  select string_agg(t::text, ' | ') into v_txt from public.publico_boloes() t where t.concurso_alvo = 999999;
  if v_txt is null then raise exception 'FALHOU: a visão pública não mostrou o bolão congelado'; end if;
  if v_txt ilike '%SECRETO%' or v_txt ilike '%contato%' then raise exception 'FALHOU: a visão pública vazou nome ou contato: %', v_txt; end if;
  select count(*) into v_n from public.publico_boloes() t where t.concurso_alvo = 999999 and t.cotas_vendidas = 20 and t.cotas_pagas = 20 and t.arrecadado_cent = 200000;
  if v_n <> 1 then raise exception 'FALHOU: totais públicos errados: %', v_txt; end if;
  select string_agg(t::text, ' | ') into v_txt from public.publico_jogos(v_b) t;
  if v_txt is null or v_txt ilike '%SECRETO%' then raise exception 'FALHOU: jogos públicos vazios ou com nome'; end if;
  execute 'reset role';

  -- 9) rascunho não aparece para o público
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  insert into public.bolaos (concurso_alvo, nome, n_cotas) values (999999, 'TESTE RASCUNHO', 5) returning id into v_b;
  execute 'set local role anon';
  select count(*) into v_n from public.publico_boloes() t where t.nome = 'TESTE RASCUNHO';
  if v_n <> 0 then raise exception 'FALHOU: o público viu um rascunho'; end if;
  select count(*) into v_n from public.publico_jogos(v_b);
  if v_n <> 0 then raise exception 'FALHOU: o público viu jogos de rascunho'; end if;
  execute 'reset role';

  raise exception 'TUDO OK: as verificações de cotas e visão pública passaram%. Este "erro" é o desfazer proposital: nada foi gravado.',
    case when v_lim is null then ' (a data limite NÃO foi testada: não há regras gravadas no banco; grave em Regras → "Gravar as regras padrão no banco")' else ' e a data limite também' end;
end
$$;
