# Pendências e premissas (SPEC seção 15)

Tudo aqui está implementado como **parâmetro editável** em `rules.json`. Não inventar valores.

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

## Premissas
- Uso oficial da Caixa com 1 recibo por cota; sem tarifa de 35%.
- "Máx. N iguais" vale entre todos os jogos do concurso.
- Um único ADM.
- Arredondamento para cima (excesso vai para a caixinha).
