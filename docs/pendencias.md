# Pendências e premissas (SPEC seção 15)

Tudo aqui está implementado como **parâmetro editável** em `rules.json`. Não inventar valores.

## Pendentes
| # | Pendência | Onde é parâmetro | Status |
|---|---|---|---|
| 1 | Arredondamento real da Caixa para a cota (premissa: para cima, excesso na caixinha) | `arredondamento_cota` | aberto |
| 2 | Isenção de IR em prêmios pequenos | `ir_valor_isento` (padrão 0) | aberto |
| 3 | Máximo de cotas por quantidade de dezenas (usar total ÷ R$ 7, ≤ 100) | `bolao_cota_minima`, `bolao_cotas_max` | aberto |
| 4 | Horário final das apostas (31/12/2026 22h, a confirmar no app da Caixa) | `data_limite_aposta` | aberto |
| 5 | CORS/IP da Caixa a partir do navegador | — | **Fase 0, teste 1** |
| 6 | Política de senha do Supabase | — | **Fase 0, teste 3** |
| 7 | Reconciliação da regra de rateio com o texto da Caixa (SPEC 8.4) | — | aberto (ver `docs/rateio.md` quando existir) |
| 8 | API comunitária de reserva (resultadomega, guidi) | — | **Fase 0, teste 1** |

## Premissas
- Uso oficial da Caixa com 1 recibo por cota; sem tarifa de 35%.
- "Máx. N iguais" vale entre todos os jogos do concurso.
- Um único ADM.
- Arredondamento para cima (excesso vai para a caixinha).
