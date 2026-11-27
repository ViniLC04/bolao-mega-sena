-- =====================================================================================================
-- TESTE do link público por bolão (Fase 6), rodado DENTRO do banco.
--
-- COMO USAR: SQL Editor → New query → cole TUDO → Run. Rode DEPOIS de 005_fase6.sql e bootstrap_adm.sql.
-- O RESULTADO APARECE COMO UM "ERRO" PROPOSITAL: "TUDO OK: ..." = passou; "FALHOU: ..." = a mensagem diz qual.
-- Em qualquer caso tudo é desfeito (rollback): NADA fica gravado.
-- =====================================================================================================
do $$
declare
  v_adm  uuid;
  v_b1   uuid;
  v_b2   uuid;
  v_r1   uuid;
  v_p1   uuid;
  v_p2   uuid;
  v_p3   uuid;
  v_tok  text := repeat('f', 64);
  v_tok2 text := repeat('e', 64);
  v_txt  text;
  v_n    int;
begin
  select user_id into v_adm from public.admins limit 1;
  if v_adm is null then raise exception 'FALHOU: cadastre o ADM antes (supabase/bootstrap_adm.sql).'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);

  insert into public.participantes (nome, contato) values ('Maria da Silva Souza', 'maria@contato.secreto') returning id into v_p1;
  insert into public.participantes (nome, contato) values ('Maria Oliveira', 'maria2@contato.secreto') returning id into v_p2;
  insert into public.participantes (nome, contato) values ('  João Pedro Lima', '1199999@contato.secreto') returning id into v_p3;

  insert into public.bolaos (concurso_alvo, nome, n_cotas) values (999999, 'TESTE LINK BOLAO', 10) returning id into v_b1;
  insert into public.recibos (bolao_id, ordem, k, g, total_cent, cotas_n) values (v_b1, 1, 6, 1, 600, 10) returning id into v_r1;
  insert into public.jogos (recibo_id, ordem, dezenas) values (v_r1, 1, array[1,2,3,4,5,6]::smallint[]);
  -- horários diferentes, como na vida real (dentro de uma transação o now() é sempre igual): define quem é "Maria (1)"
  insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent, pago, criado_em) values (v_p1, v_b1, 4, 400, true, now() - interval '3 minutes');
  insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent, pago, criado_em) values (v_p2, v_b1, 2, 200, false, now() - interval '2 minutes');
  insert into public.cotas (participante_id, bolao_id, qtd, valor_devido_cent, pago, criado_em) values (v_p3, v_b1, 3, 300, true, now() - interval '1 minute');
  insert into public.bolao_links (bolao_id, token, ativo) values (v_b1, v_tok, true);

  -- segundo bolão (em rascunho), com link ligado e outra pessoa: não pode vazar para o link do primeiro
  insert into public.bolaos (concurso_alvo, nome, n_cotas) values (999999, 'TESTE LINK BOLAO DOIS', 10) returning id into v_b2;
  insert into public.bolao_links (bolao_id, token, ativo) values (v_b2, v_tok2, true);

  -- ===== como VISITANTE (anon) =====
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';

  -- 1) só primeiros nomes e cotas; homônimos numerados
  select string_agg(t.nome || '=' || t.qtd, ' | ' order by t.qtd desc, t.nome) into v_txt from public.publico_bolao_participantes(v_tok) t;
  if v_txt is distinct from 'Maria (1)=4 | João=3 | Maria (2)=2' then raise exception 'FALHOU: lista de participantes inesperada: %', v_txt; end if;
  select string_agg(t::text, ' | ') into v_txt from public.publico_bolao_participantes(v_tok) t;
  if v_txt ~* '(silva|souza|oliveira|pedro|lima|contato|secreto|@)' then raise exception 'FALHOU: vazou sobrenome ou contato: %', v_txt; end if;

  -- 2) resumo: só totais (nada de nome nem quem pagou por pessoa)
  select string_agg(t::text, ' | ') into v_txt from public.publico_bolao(v_tok) t;
  if v_txt is null then raise exception 'FALHOU: o resumo do bolão não apareceu'; end if;
  if v_txt ~* '(maria|joão|silva|oliveira|contato)' then raise exception 'FALHOU: o resumo tem nome: %', v_txt; end if;
  select count(*) into v_n from public.publico_bolao(v_tok) t
    where t.cotas_vendidas = 9 and t.cotas_pagas = 7 and t.previsto_cent = 900 and t.arrecadado_cent = 700 and t.status = 'rascunho';
  if v_n <> 1 then raise exception 'FALHOU: totais do resumo errados: %', v_txt; end if;

  -- 3) bolão em rascunho: sem jogos
  select count(*) into v_n from public.publico_bolao_jogos(v_tok);
  if v_n <> 0 then raise exception 'FALHOU: o link mostrou jogos de bolão em rascunho'; end if;

  -- 4) o link do bolão 2 não mostra ninguém do bolão 1 (e vice-versa)
  select count(*) into v_n from public.publico_bolao_participantes(v_tok2);
  if v_n <> 0 then raise exception 'FALHOU: o link do bolão 2 mostrou gente do bolão 1'; end if;

  -- 5) token errado, curto, vazio, nulo
  select count(*) into v_n from public.publico_bolao(repeat('a', 64));
  if v_n <> 0 then raise exception 'FALHOU: token errado devolveu o resumo'; end if;
  select count(*) into v_n from public.publico_bolao_participantes('abc');
  if v_n <> 0 then raise exception 'FALHOU: token curto devolveu participantes'; end if;
  select count(*) into v_n from public.publico_bolao_participantes('');
  if v_n <> 0 then raise exception 'FALHOU: token vazio devolveu participantes'; end if;
  select count(*) into v_n from public.publico_bolao_participantes(null);
  if v_n <> 0 then raise exception 'FALHOU: token nulo devolveu participantes'; end if;

  -- 6) o público não lê a tabela dos links
  begin
    perform 1 from public.bolao_links limit 1;
    raise exception 'FALHOU: o público leu a tabela bolao_links';
  exception when insufficient_privilege then null;
  end;

  -- 7) a lista geral continua sem nomes
  select string_agg(t::text, ' | ') into v_txt from public.publico_boloes() t;
  if coalesce(v_txt, '') ~* '(maria|joão|silva|oliveira)' then raise exception 'FALHOU: publico_boloes() tem nome: %', v_txt; end if;
  execute 'reset role';

  -- ===== congela o bolão 1: agora os jogos aparecem =====
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', v_adm::text, true);
  perform public.congelar_bolao(v_b1, repeat('9', 64), array[7]);
  -- o link continua funcionando depois de congelado, e dá para desligar (a tabela do link não é congelada)
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into v_n from public.publico_bolao_jogos(v_tok);
  if v_n <> 1 then raise exception 'FALHOU: depois de congelado, o link deveria mostrar o jogo (viu %)', v_n; end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  update public.bolao_links set ativo = false, atualizado_em = now() where bolao_id = v_b1;
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into v_n from public.publico_bolao(v_tok);
  if v_n <> 0 then raise exception 'FALHOU: link desligado ainda mostra o resumo'; end if;
  select count(*) into v_n from public.publico_bolao_participantes(v_tok);
  if v_n <> 0 then raise exception 'FALHOU: link desligado ainda mostra os participantes'; end if;
  select count(*) into v_n from public.publico_bolao_jogos(v_tok);
  if v_n <> 0 then raise exception 'FALHOU: link desligado ainda mostra os jogos'; end if;
  execute 'reset role';

  -- token fraco é recusado
  begin
    insert into public.bolao_links (bolao_id, token) values (v_b2, 'curto') on conflict (bolao_id) do update set token = excluded.token;
    raise exception 'FALHOU: aceitou token fraco';
  exception when check_violation then null;
  end;

  raise exception 'TUDO OK: o link público do bolão mostra só primeiros nomes e cotas, e respeita token, desligar e congelar. Este "erro" é o desfazer proposital: nada foi gravado.';
end
$$;
