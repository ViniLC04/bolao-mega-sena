# Pendências e premissas (SPEC seção 15)

Tudo aqui está implementado como **parâmetro editável** em `rules.json`. Não inventar valores.

## Fase 8 (autoatendimento) — limites conhecidos
- O app não prova a identidade de quem se inscreve (sem login): vale o link pessoal secreto + confirmação manual do PIX pelo ADM.
- Confirmação automática do PIX exige conta PJ/provedor pago: fora do escopo. O ADM confere no banco.
- Cota com pagamento parcial (aumento depois de pagar): a diferença é cobrada pelo mesmo PIX com o valor pendente.

## Fase 9 (conta do apostador) — limites conhecidos
- Sem confirmação de e-mail (exigiria serviço de envio): quem criar a conta primeiro "ocupa" aquele e-mail. A conta não vê nada sem o link pessoal secreto.
- Sem "esqueci a senha" por e-mail: o ADM redefine pelo painel do Supabase.

## Fase 10 (bolões listados) — limites conhecidos
- Como a conta não tem confirmação de e-mail, qualquer pessoa pode criar conta e ver primeiro nome + cotas dos bolões listados. O ADM decide bolão a bolão.

## Fase 11 (perfil na conta) — limites conhecidos
- Nome e WhatsApp do perfil ficam em `user_metadata`, que a própria pessoa pode editar (igual a digitar na inscrição); o ADM confere os dados na lista de Participantes.

## Pendentes
| # | Pendência | Onde é parâmetro | Status |
|---|---|---|---|
| 1 | Arredondamento real da Caixa para a cota (premissa: para cima, excesso na caixinha) | `arredondamento_cota` | aberto |
| 2 | Isenção de IR em prêmios pequenos | `ir_valor_isento` (padrão 0) | aberto |
| 3 | Máximo de cotas por quantidade de dezenas (usar total ÷ R$ 7, ≤ 100) | `bolao_cota_minima`, `bolao_cotas_max` | aberto |
| 4 | Horário final das apostas (31/12/2026 22h, a confirmar no app da Caixa) | `data_limite_aposta` | aberto |
| 5 | CORS/IP da Caixa a partir do navegador | — | **resolvido para o Brasil** (CORS livre); **visitante no exterior não testado**, ver `docs/fase0-relatorio.md` |
| 6 | Política de senha do Supabase | — | **resolvido (Fase 0, teste 3)**: servidor exige maiúscula, minúscula, número e símbolo; mínimo 8 |
| 7 | Reconciliação da regra de rateio com o texto da Caixa (SPEC 8.4) | — | aberto (ver `docs/rateio.md` quando existir) |
| 8 | API comunitária de reserva (resultadomega, guidi) | — | **resolvido**: resultadomega funciona no navegador (CORS livre); guidi descartada (sem CORS). resultadomega é projeto novo de uma pessoa: manter marcada "não oficial" |
| 9 | Lista oficial de Viradas para o filtro "só Viradas" (a planilha tem sorteios em 31/12 desde 1998 e a coluna "Acumulado Virada" não identifica Virada) | lista editável de concursos-Virada | aberto (achado no teste 4) |

## Correções de vetores do SPEC (achadas na Fase 1; SPEC já corrigido)
| # | O que o SPEC dizia | O que é | Como ficou |
|---|---|---|---|
| 10 | N=7: cota mínima R$ 7,71 | R$ 7,72 pela regra "arredonda para cima" (e N=9, R$ 9,34, só fecha com "para cima") | teste e SPEC corrigidos; se a Caixa arredondar diferente, mudar `arredondamento_cota` em `rules.json` |
| 11 | "A partir de N=9 todos os totais são múltiplos de R$ 42" | não vale com 13 ou 20 dezenas (só se o nº de jogos for múltiplo de 7) | SPEC e teste corrigidos |
| 12 | N=64: cota 7,88 sem asterisco | 504/64 = 7,875 → tem centavo quebrado | asterisco acrescentado; o motor avisa (`avisoCentavos`) |

## Premissas adotadas na Fase 1 (simulador)
| # | Premissa | Onde mudar |
|---|---|---|
| 13 | Modo "inverso": para cada N de 2 a 100, o melhor gasto ≤ orçamento; destaca o maior N viável (o SPEC era vago) | `simularInverso` em `src/engine/simulador.ts` |
| 14 | Perfis do modo "por valor" (entre as composições de gasto máximo): *menos recibos* = menos recibos, depois menos jogos; *mais dezenas* = maiores k primeiro; *mais jogos* = mais jogos no total | `comparar` em `src/engine/simulador.ts` |
| 15 | "Sobra" dos vetores do SPEC = orçamento − gasto (R$ 24 / R$ 26). Em **cota fixa** ela vai para a caixinha; em **cota-teto** cobra-se `gasto/N` arredondado e a caixinha é só o arredondamento | campos `sobraOrcamentoCent` e `caixinhaCent` |
| 16 | IR: alíquota sobre o que passa de `ir_valor_isento` (padrão 0), arredondada para o centavo mais próximo (meio centavo sobe). Reproduz o vetor R$ 24.946,64 → R$ 17.462,65 | `impostoDeRenda` em `src/engine/acertos.ts`; `ir_valor_isento` em `rules.json` |
| 17 | Prêmio por cota = líquido do recibo ÷ N **para baixo**; o resto fica na caixinha (o SPEC não dizia) | `conferirRecibo` em `src/engine/acertos.ts` |
| 18 | O IR é calculado **por recibo** (valor bruto do recibo inteiro). Se a Caixa reter por ganhador/aposta, o líquido pode diferir em centavos | `conferirRecibo` |
| 19 | Estimativas antes do sorteio (quadra pela fórmula, quina = 70% da quadra, SPEC 8.4) **não** entram no motor ainda: dependem da reconciliação do rateio (pendência 7) e são da Fase 4 | — |

## Premissas adotadas na Fase 2 (gerador)
| # | Premissa | Onde mudar |
|---|---|---|
| 20 | Pares, soma e linhas do volante valem para as k dezenas do jogo (valores absolutos). A sugestão de soma é o P10–P90 da soma dos sorteios de 6 dezenas escalado por k/6 (aproximação) | `verificar` em `src/engine/gerador.ts` e `sugestaoSoma` em `src/engine/historico.ts` |
| 21 | "Quinas/quadras que o jogo já fez" = nº de concursos do período com ≥ 5 (≥ 4) acertos | `contarFaixasHistorico` em `src/engine/historico.ts` |
| 22 | "Obrigatórios em ≥ M jogos" = cada dezena obrigatória aparece em pelo menos M jogos do bolão | `gerarInterno` em `src/engine/gerador.ts` |
| 23 | Escopo padrão do "máx. de números iguais" = todo o concurso. Nunca se repete combinação de 6 dezenas, com ou sem premissas | `gerarJogos` |
| 24 | Dezena "obrigatória" fora das "mais frequentes (restringir)" é permitida: a obrigatoriedade vence a restrição | `verificar` |

## Decisões e pendências da Fase 2 (login)
| # | Item | Status |
|---|---|---|
| 25 | Login por usuário = e-mail interno fixo `usuario@example.com`; recuperação de senha pelo painel do Supabase, não por e-mail | decidido pelo usuário em 26/11/2026 |
| 26 | "Bloqueio após tentativas erradas": limite por IP do Supabase + espera crescente na tela (`src/app/bloqueio.ts`) | **resolvido na Fase 5** com verificação em 2 passos (TOTP) exigida pelo banco; limites de tentativas no painel do Supabase em `docs/seguranca.md` |
| 27 | Chunk do app passa de 500 kB (Supabase + roteador + motor) | **parcial na Fase 5**: telas do ADM e planilha carregam só quando abertas (React.lazy); o pacote principal continua ~518 kB (150 kB comprimido): aceitável |
| 28 | `recibos.cotas_n`: gravado como o total de cotas do bolão (todas as cotas dividem todos os recibos). Se na Fase 3 cada cota for ligada a um recibo específico, ajustar | premissa adotada na Fase 2 (etapa 7) |
| 30 | Fase 3: valor devido por cota = `cotaCobradaCent` do plano gravado no bolão; pagamento é "pago ou não pago" por pessoa e bolão (sem parcial) | decidido pelo usuário em 26/11/2026 |
| 31 | Fase 3: contagens públicas de pagos e vias entregues são agregadas; com poucos participantes dá para deduzir quem pagou (é o que o SPEC pede) | premissa adotada |
| 32 | Link pessoal secreto por participante (SPEC 11) | **feito na Fase 5** (só o(s) bolão(ões) da própria pessoa) |
| 39 | Fase 5: recuperar o celular do 2 passos exige remover o fator no painel do Supabase (não há códigos de reserva) | documentado em `docs/seguranca.md` |
| 40 | Fase 5: restauração de backup é feita junto com o assistente (`docs/restaurar.md`), ainda não testada com banco vazio | aberto |
| 41 | Fase 5: projetos de teste da Fase 0 na Cloudflare (`bolao-spike-caixa` em Pages e os workers `bolao-spike-caixa` e `bolao-spike-caixa-br`) | **apagados em 27/11/2026** com o ok do usuário. O teste de visitante fora do Brasil (pendência 5) passa a exigir recriar a página de teste (`spikes/caixa.html`) |
| 33 | Data limite no servidor só vale se as regras estiverem gravadas no banco (Regras → "Gravar as regras padrão no banco"); sem isso, só a tela bloqueia | aberto: gravar as regras no banco antes de abrir as cotas |
| 34 | Fase 4: concurso enviado por visitante entra "aguardando confirmação"; só o ADM confirma (ou grava direto "confirmado" se as 2 fontes batem). Se alguém enviar resultado falso, o ADM usa "Rejeitar" (só o último concurso, só aguardando) | decidido pelo usuário em 26/11/2026 |
| 35 | Fase 4: limite do servidor = 5 concursos novos por minuto e 20 tentativas recusadas por minuto (o SPEC diz "1 atualização por minuto", mas uma atualização pode trazer vários concursos) | premissa adotada |
| 36 | Fase 4: 2ª fonte (resultadomega) confere data e dezenas de qualquer concurso (concursos.json) e o rateio só do último (ultimo.json); fonte não oficial e de um projeto novo | aberto: avaliar outra fonte de reserva |
| 37 | Fase 4: não é possível corrigir um concurso já gravado (nunca sobrescreve); só rejeitar o último aguardando | aberto: definir como corrigir erro de dado de concurso confirmado (hoje, só pelo SQL Editor) |
| 38 | Fase 4: conferência com qualquer concurso (simulação) é pública | decidido pelo usuário em 26/11/2026 |
| 42 | Fase 6: **mudança de regra de privacidade** pedida pelo organizador: o link secreto do bolão mostra primeiro nome + cotas (sem sobrenome, contato nem situação de pagamento). Quem tem o link pode repassá-lo; o ADM desliga ou renova | decidido pelo usuário em 27/11/2026 |
| 43 | Fase 6: o símbolo de Muruga é um desenho original (lança vel, pavão e lótus); a imagem de terceiros indicada não foi copiada | feito; o organizador pode pedir ajuste |
| 44 | Fase 7 (bolão aberto): o número de cotas (N) no fechamento = todas as cotas cadastradas, pagas ou não; cota fixa (a sobra do orçamento vai para a caixinha); depois de fechado não entra mais ninguém (só reabrindo, antes de salvar os jogos) | decidido pelo usuário em 27/11/2026 |
| 45 | Fase 7: a data de inscrição do bolão aberto é separada da data limite global das apostas (31/12 22h); valem as duas (a mais cedo manda) | premissa adotada |
| 29 | Cruzamento do gerador: só jogos de bolões **congelados** do mesmo concurso entram como exclusão (rascunhos não bloqueiam; o banco recusa repetição no congelamento) | premissa adotada na Fase 2 (etapa 7) |

## Premissas
- Uso oficial da Caixa com 1 recibo por cota; sem tarifa de 35%.
- "Máx. N iguais" vale entre todos os jogos do concurso.
- Um único ADM.
- Arredondamento para cima (excesso vai para a caixinha).
