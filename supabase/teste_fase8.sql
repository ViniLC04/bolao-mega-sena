-- =====================================================================================================
-- TESTE do autoatendimento pelo link do bolão (Fase 8), rodado DENTRO do banco.
--
-- COMO USAR: SQL Editor → New query → cole TUDO → Run. Rode DEPOIS de 007_fase8.sql e bootstrap_adm.sql.
-- O RESULTADO APARECE COMO UM "ERRO" PROPOSITAL: "TUDO OK: ..." = passou; "FALHOU: ..." = a mensagem diz qual.
-- Em qualquer caso tudo é desfeito (rollback): NADA fica gravado.
-- =====================================================================================================
do $$
declare
  v_adm   uuid;
  v_b     uuid;
  v_tok   text := repeat('7', 64);
  v_r     jsonb;
  v_tp    text;   -- token pessoal da Maria
  v_tp2   text;
  v_n     int;
  v_txt   text;
  v_cota  uuid;
begin
  select user_id into v_adm from public.admins limit 1;
  if v_adm is null then raise exception 'FALHOU: cadastre o ADM antes (supabase/bootstrap_adm.sql).'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);

  -- bolão aberto com inscrição pelo link ligada (limite de 10 por pessoa) e PIX do organizador cadastrado
  insert into public.bolaos (concurso_alvo, nome, n_cotas, status, cota_base_cent, inscricoes_ate)
  values (999999, 'TESTE AUTOATENDIMENTO', null, 'aberto', 10000, now() + interval '3 days') returning id into v_b;
  insert into public.bolao_links (bolao_id, token, ativo, autoinscricao, max_cotas_pessoa) values (v_b, v_tok, true, true, 10);
  insert into public.config (chave, valor) values ('recebimento', jsonb_build_object('tipo', 'email', 'chave', 'pix@teste.com', 'nome', 'Organizador Teste', 'cidade', 'Sao Paulo', 'whatsapp', '11999990000'))
    on conflict (chave) do update set valor = excluded.valor;

  -- ===== como VISITANTE (anon) =====
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';

  -- 1) inscrição válida
  v_r := public.inscrever_no_bolao(v_tok, 'Maria da Silva Souza', '(11) 98888-7777', 2);
  if (v_r ->> 'ok')::boolean is not true then raise exception 'FALHOU: inscrição válida recusada: %', v_r; end if;
  v_tp := v_r ->> 'token';
  if length(v_tp) <> 64 or (v_r ->> 'valor_cent')::int <> 20000 then raise exception 'FALHOU: retorno da inscrição errado: %', v_r; end if;

  -- 2) recusas: WhatsApp repetido (mesmo escrito de outro jeito), nome só com um nome, cotas demais ou de menos, WhatsApp ruim,
  --    link errado, nome com número
  v_r := public.inscrever_no_bolao(v_tok, 'Outra Pessoa Qualquer', '11 98888 7777', 1);
  if (v_r ->> 'ok')::boolean is not false or v_r ->> 'erro' not like '%já está inscrito%' then raise exception 'FALHOU: aceitou WhatsApp repetido: %', v_r; end if;
  v_r := public.inscrever_no_bolao(v_tok, 'Joao', '(11) 97777-6666', 1);
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: aceitou nome sem sobrenome'; end if;
  v_r := public.inscrever_no_bolao(v_tok, 'João Pedro Lima', '(11) 97777-6666', 11);
  if (v_r ->> 'ok')::boolean is not false or v_r ->> 'erro' not like '%de 1 a 10%' then raise exception 'FALHOU: aceitou mais de 10 cotas: %', v_r; end if;
  v_r := public.inscrever_no_bolao(v_tok, 'João Pedro Lima', '(11) 97777-6666', 0);
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: aceitou 0 cota'; end if;
  v_r := public.inscrever_no_bolao(v_tok, 'João Pedro Lima', '123', 1);
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: aceitou WhatsApp inválido'; end if;
  v_r := public.inscrever_no_bolao(v_tok, 'João 2 Lima', '(11) 97777-6666', 1);
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: aceitou nome com número'; end if;
  v_r := public.inscrever_no_bolao(repeat('0', 64), 'João Pedro Lima', '(11) 97777-6666', 1);
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: aceitou link errado'; end if;

  -- 3) aumentar: só para cima, só a própria pessoa, até 10
  v_r := public.aumentar_minhas_cotas(v_tp, (select bolao_id from public.publico_participante(v_tp) limit 1), 3);
  if (v_r ->> 'ok')::boolean is not true or (v_r ->> 'a_pagar_cent')::int <> 30000 then raise exception 'FALHOU: aumentar para 3: %', v_r; end if;
  v_r := public.aumentar_minhas_cotas(v_tp, (select bolao_id from public.publico_participante(v_tp) limit 1), 3);
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: aceitou "aumentar" para a mesma quantidade'; end if;
  v_r := public.aumentar_minhas_cotas(v_tp, (select bolao_id from public.publico_participante(v_tp) limit 1), 2);
  if (v_r ->> 'ok')::boolean is not false or v_r ->> 'erro' not like '%Só dá para aumentar%' then raise exception 'FALHOU: aceitou diminuir: %', v_r; end if;
  v_r := public.aumentar_minhas_cotas(v_tp, (select bolao_id from public.publico_participante(v_tp) limit 1), 11);
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: aceitou passar de 10'; end if;
  v_r := public.aumentar_minhas_cotas(repeat('1', 64), (select bolao_id from public.publico_participante(v_tp) limit 1), 5);
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: outro token aumentou as cotas da Maria'; end if;
  select qtd into v_n from public.publico_participante(v_tp) limit 1;
  if v_n <> 3 then raise exception 'FALHOU: a Maria deveria ter 3 cotas, tem %', v_n; end if;

  -- 4) PIX: aparece com o link pessoal (há pagamento pendente); com token errado, nada
  select count(*) into v_n from public.publico_recebimento(v_tp) t where t.chave = 'pix@teste.com' and t.whatsapp = '11999990000';
  if v_n <> 1 then raise exception 'FALHOU: a Maria não viu o PIX'; end if;
  select count(*) into v_n from public.publico_recebimento(repeat('2', 64));
  if v_n <> 0 then raise exception 'FALHOU: token errado viu o PIX'; end if;

  -- 5) pendente não aparece na lista pública do bolão; o resumo mostra reservadas × pagas
  select count(*) into v_n from public.publico_bolao_participantes(v_tok);
  if v_n <> 0 then raise exception 'FALHOU: inscrito sem pagar apareceu na lista pública (%)', v_n; end if;
  select count(*) into v_n from public.publico_bolao(v_tok) t where t.cotas_vendidas = 3 and t.cotas_pagas = 0 and t.arrecadado_cent = 0;
  if v_n <> 1 then raise exception 'FALHOU: resumo público com pendente errado'; end if;

  -- 6) o visitante não lê tabelas nem confirma pagamento
  begin
    perform 1 from public.cotas limit 1;
    raise exception 'FALHOU: o público leu cotas';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.comprovantes limit 1;
    raise exception 'FALHOU: o público leu comprovantes';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.fechar_inscricoes(gen_random_uuid(), true);
    raise exception 'FALHOU: o visitante fechou inscrições';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  -- ===== o ADM confirma o pagamento de 2 das 3 cotas =====
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  update public.cotas set qtd_paga = 2 where bolao_id = v_b;

  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  -- agora a Maria aparece (só o primeiro nome) e o resumo mostra 2 pagas / R$ 200,00
  select string_agg(t.nome || '=' || t.qtd, ' | ') into v_txt from public.publico_bolao_participantes(v_tok) t;
  if v_txt is distinct from 'Maria=3' then raise exception 'FALHOU: lista pública depois de pagar: %', v_txt; end if;
  select count(*) into v_n from public.publico_bolao(v_tok) t where t.cotas_vendidas = 3 and t.cotas_pagas = 2 and t.arrecadado_cent = 20000 and t.previsto_cent = 30000;
  if v_n <> 1 then raise exception 'FALHOU: resumo depois de pagar parcial errado'; end if;
  -- ainda falta 1 cota paga: o PIX continua disponível; depois de tudo pago, some
  select count(*) into v_n from public.publico_recebimento(v_tp);
  if v_n <> 1 then raise exception 'FALHOU: PIX deveria continuar (falta 1 cota)'; end if;
  execute 'reset role';

  -- ===== comprovante: o arquivo vai para o armazenamento (simulado aqui) e o registro só com token e caminho certos =====
  select id into v_cota from public.cotas where bolao_id = v_b limit 1;
  insert into storage.objects (bucket_id, name) values ('comprovantes', v_tp || '/teste.jpg');
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  v_r := public.enviar_comprovante(v_tp, v_b, v_tp || '/teste.jpg', 'teste.jpg');
  if (v_r ->> 'ok')::boolean is not true then raise exception 'FALHOU: comprovante válido recusado: %', v_r; end if;
  v_r := public.enviar_comprovante(v_tp, v_b, repeat('9', 64) || '/outro.jpg', 'x.jpg');
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: aceitou comprovante em pasta de outro token'; end if;
  v_r := public.enviar_comprovante(repeat('3', 64), v_b, v_tp || '/teste.jpg', 'x.jpg');
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: token errado registrou comprovante'; end if;
  execute 'reset role';
  select count(*) into v_n from public.comprovantes where cota_id = v_cota;
  if v_n <> 1 then raise exception 'FALHOU: deveria haver 1 comprovante, há %', v_n; end if;

  -- ===== fechar: com pendência exige confirmação; descartando, N = só as pagas =====
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  begin
    perform public.fechar_inscricoes(v_b);
    raise exception 'FALHOU: fechou com cota pendente sem o ADM aceitar descartar';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlerrm not like '%sem pagamento confirmado%' then raise exception 'FALHOU: mensagem inesperada (pendência): %', sqlerrm; end if;
  end;
  -- (2 cotas pagas é abaixo do mínimo de cotas das regras: acrescenta 3 pessoas pagas do ADM para poder fechar)
  insert into public.participantes (nome) values ('ZZ A'), ('ZZ B'), ('ZZ C');
  insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent, qtd_paga)
    select id, v_b, 1, 10000, 1 from public.participantes where nome in ('ZZ A', 'ZZ B', 'ZZ C');
  v_r := public.fechar_inscricoes(v_b, true);
  if (v_r ->> 'n_cotas')::int <> 5 or (v_r ->> 'descartadas')::int <> 1 then raise exception 'FALHOU: fechamento: %', v_r; end if;
  select qtd into v_n from public.cotas where id = v_cota;
  if v_n <> 2 then raise exception 'FALHOU: a cota da Maria deveria ficar com 2 (as pagas), ficou %', v_n; end if;
  if (select sum(qtd) from public.cotas where bolao_id = v_b) <> 5 then raise exception 'FALHOU: soma das cotas depois de fechar'; end if;

  -- ===== depois de fechado, a Maria não consegue mais aumentar =====
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  v_r := public.aumentar_minhas_cotas(v_tp, v_b, 4);
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: aumentou cotas depois de fechado'; end if;
  v_r := public.inscrever_no_bolao(v_tok, 'Pedro Alves Costa', '(11) 96666-5555', 1);
  if (v_r ->> 'ok')::boolean is not false then raise exception 'FALHOU: inscreveu depois de fechado'; end if;
  execute 'reset role';

  -- ===== autoinscrição desligada e prazo vencido recusam =====
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform public.reabrir_inscricoes(v_b);
  update public.bolao_links set autoinscricao = false where bolao_id = v_b;
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  v_r := public.inscrever_no_bolao(v_tok, 'Pedro Alves Costa', '(11) 96666-5555', 1);
  if (v_r ->> 'ok')::boolean is not false or v_r ->> 'erro' not like '%desligadas%' then raise exception 'FALHOU: inscreveu com a inscrição desligada: %', v_r; end if;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  update public.bolao_links set autoinscricao = true where bolao_id = v_b;
  update public.bolaos set inscricoes_ate = now() - interval '1 hour' where id = v_b;
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  v_r := public.inscrever_no_bolao(v_tok, 'Pedro Alves Costa', '(11) 96666-5555', 1);
  if (v_r ->> 'ok')::boolean is not false or v_r ->> 'erro' not like '%terminaram%' then raise exception 'FALHOU: inscreveu depois do prazo: %', v_r; end if;
  execute 'reset role';

  raise exception 'TUDO OK: inscrição pelo link, aumentar sem diminuir, PIX, comprovante, pendências e fechamento passaram. Este "erro" é o desfazer proposital: nada foi gravado.';
end
$$;
