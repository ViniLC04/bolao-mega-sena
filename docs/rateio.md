# Rateio da Mega-Sena: o que o app faz e o que ficou em aberto

## Regra do app
- **Valor de prêmio vem sempre do rateio oficial da Caixa** (tabela `concurso_faixas`: ganhadores e valor por ganhador de cada faixa).
- O app **nunca** calcula o valor de uma faixa por fórmula. Antes do rateio oficial estar no banco, a conferência diz "aguardando rateio oficial" e não afirma valor.
- Conferência de um bolão: para cada jogo de *k* dezenas com *h* acertos, decompõe em apostas simples (`sena = C(h,6)·C(k−h,0)`, `quina = C(h,5)·C(k−h,1)`, `quadra = C(h,4)·C(k−h,2)`), soma com os valores oficiais, tira o IR e divide por N (para baixo; o resto vai para a caixinha). Código: `src/engine/acertos.ts` e `src/engine/conferencia.ts`.

## Verificado com dados oficiais
- Concurso 2955 (Virada 2025): jogo de 7 dezenas com 5 acertos = R$ 24.946,64 bruto e R$ 17.462,65 líquido (teste `tests/conferencia-estatisticas.test.ts`).
- Concurso 3086: quadra R$ 811,98 e quina R$ 32.785,73 conferem com o banco.

## Em aberto (SPEC 8.4, não tente "consertar" com fórmula)
- A regra publicada pela Caixa **não reconcilia** com os valores pagos: a quina da Virada paga sempre 70% da quadra em 2009–2025 (mas não em todos os concursos) e a sena da Virada 2025 pagou menos que 90% do prêmio bruto. O texto da regra não explica.
- Por isso **não há estimativa de prêmio** antes do sorteio nesta fase. Quando houver, será rotulada **"estimativa calibrada"** (quadra pela fórmula empírica, quina = 70% da quadra, sena = estimativa divulgada pela Caixa).
- IR: alíquota e isenção estão em `rules.json` (editáveis); o arredondamento (centavo mais próximo) e a isenção para prêmios pequenos ainda precisam ser confirmados com o rateio real (ver `docs/pendencias.md`).
