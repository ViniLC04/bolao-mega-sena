# SPEC — Programa de Bolão da Mega da Virada

> Especificação consolidada (versão 1.0 — 17/11/2026). Leia `CLAUDE.md` antes. Este documento é a fonte de verdade
> do que construir. Onde algo está marcado **[PREMISSA]** ou **[PENDENTE]**, não invente: implemente como parâmetro
> editável e registre a dúvida. Valores monetários internos são sempre **inteiros em centavos**.

---

## 0. Como usar este documento

1. Construa **por fases** (seção 16). Termine, teste e faça commit de cada fase antes da seguinte.
2. Todo cálculo deve ter **teste automatizado** usando os vetores de teste deste documento (seções 4, 7, 8, 9).
3. Regras oficiais **nunca** ficam fixas no código: vivem em `rules.json` (versionado, editável pelo ADM na tela de regras).
4. O usuário **não programa**. Quando precisar de ação manual (criar conta, copiar chave, abrir link), dê instruções passo a passo em português simples.
5. Prazo duro: apostas na Caixa fecham em **31/12/2026 às 22h** (**[A CONFIRMAR]** no app da Caixa); sorteio da Virada (concurso **3100**) em **01/01/2027 às 11h**. Hoje é 17/11/2026.

---

## 1. Objetivo e escopo

Programa web (celular e computador) **só para a Mega da Virada** que substitui a planilha `bolao_2025.xlsx` do ADM e permite:

- simular e criar **bolões oficiais da Caixa** (recibos, jogos, cotas), a partir do número de cotas ou do valor por cota;
- **gerar os jogos** (aleatório ou com premissas) sem repetir combinações entre bolões;
- controlar participantes, cotas, pagamentos, caixinha e entrega das vias;
- calcular **probabilidades** por recibo e por bolão;
- manter o **banco de concursos** (direto da Caixa) e **conferir** automaticamente se o bolão ganhou e quanto, com valores oficiais;
- oferecer ao apostador uma visão pública sem nomes de ninguém.

Fora de escopo: outras loterias, apostas feitas dentro do app, pagamento online, notificações push.

---

## 2. Glossário

| Termo | Significado |
|---|---|
| Concurso | Sorteio numerado da Mega-Sena. A Virada 2026 é o concurso 3100. |
| Jogo | Uma aposta com *k* dezenas (6 a 20). Custa C(k,6) × preço da aposta simples. |
| Aposta simples | Jogo de 6 dezenas (R$ 6,00). |
| Recibo | Bolão registrado na Caixa: 1 a 10 jogos, **todos com o mesmo k**. Gera uma via por cota. |
| Bolão | Conjunto de 1 ou mais recibos do ADM para o mesmo concurso. |
| Cota | Fração do recibo. Cada participante tem 1 ou mais cotas (do bolão = a mesma quantidade em cada recibo). |
| N | Número total de cotas do bolão (cada recibo do bolão tem N cotas). |
| ADM | Organizador (login e senha). |
| Apostador | Participante com acesso público somente leitura. |
| Rateio oficial | Valor por ganhador de cada faixa, publicado pela Caixa. |

---

## 3. Regras e parâmetros (`rules.json`, versionado por data de vigência)

| Parâmetro | Valor padrão | Fonte / status |
|---|---|---|
| `preco_aposta_simples` | 600 centavos | Caixa 2026 — confirmado |
| `bolao_valor_minimo` | 1800 | Caixa Notícias (bolão Mega da Virada), conferido 16/11/2026 |
| `bolao_cota_minima` | 700 | idem |
| `bolao_cotas_min` / `bolao_cotas_max` | 2 / 100 | idem |
| `bolao_jogos_max_por_recibo` | 10 | idem (todos com a mesma quantidade de dezenas) |
| `dezenas_min` / `dezenas_max` | 6 / 20 | tabela de preços da Caixa |
| `tarifa_servico_bolao` | 0 | ADM organiza o bolão; a tarifa de até 35% é só de lotérica |
| `premio_bruto_pct` | 43,79% da arrecadação | página oficial da Caixa (print do usuário) |
| `virada_distribuicao` | sena 90% / quina 5% / quadra 5% | página oficial (print) — **NÃO reconcilia na prática, ver 8.4** |
| `comum_distribuicao` | 40/10/10 + 25% final 0-5 + 15% Virada | página oficial (print) — idem |
| `ir_aliquota` | 30% retido na fonte | confirmado (várias fontes); cada participante recebe líquido com comprovante individual |
| `ir_valor_isento` | 0 | **[PENDENTE]** — conferir se há faixa isenta para prêmios pequenos |
| `arredondamento_cota` | para cima, 2ª casa; excesso vai para a caixinha | **[PREMISSA do ADM]** — validar com a Caixa |
| `limite_recibos_simulador` | 4 | padrão prático, editável |
| `data_limite_aposta` | definida pelo ADM | campo editável (ver 11) |
| `concurso_virada` | 3100, 01/01/2027 11h | Seu Dinheiro (nov/2026) — conferir |

Total de combinações da Mega-Sena: **C(60,6) = 50.063.860**.

---

## 4. Matemática do bolão (módulo `engine/bolao`)

### 4.1 Preço
`preco(k) = C(k,6) × preco_aposta_simples`. Ex.: 6→R$6; 7→R$42; 8→R$168; 9→R$504; 10→R$1.260.

### 4.2 Totais possíveis de um recibo
`T(k,g) = preco(k) × g`, com `1 ≤ g ≤ 10`. Um recibo é válido para N cotas quando:
`2 ≤ N ≤ 100`, `T ≥ 1800` e `T / N ≥ 700 centavos`.
Fato derivado: jogos de 6 dezenas só servem até N=8 (10 jogos = R$60); a partir de N=9 os totais são múltiplos de R$ 42, **exceto** com 13 ou 20 dezenas (C(13,6) e C(20,6) não têm fator 7): aí só quando o nº de jogos é múltiplo de 7.

### 4.3 Valor mínimo para N cotas (um recibo)
`Piso(N) = max(1800, 700×N)`; `Tmin(N) = menor T(k,g) ≥ Piso(N)`; desempate: menor total, depois menor k.
`cota_minima = ceil_centavos(Tmin / N)`. Avisar quando `Tmin×100` não divide N (centavos quebrados → regra de arredondamento).

**Vetores de teste (N → total mínimo, composição, cota):**

| N | Total | Composição | Cota |
|---|---|---|---|
| 2 | R$18 | 3×6dez | 9,00 |
| 3 | R$24 | 4×6dez | 8,00 |
| 4 | R$30 | 5×6dez | 7,50 |
| 5 | R$36 | 6×6dez | 7,20 |
| 6 | R$42 | 7×6dez | 7,00 |
| 7 | R$54 | 9×6dez | 7,72* |
| 8 | R$60 | 10×6dez | 7,50 |
| 9 | R$84 | 2×7dez | 9,34* |
| 10 | R$84 | 2×7dez | 8,40 |
| 12 | R$84 | 2×7dez | 7,00 |
| 15 | R$126 | 3×7dez | 8,40 |
| 20 | R$168 | 4×7dez | 8,40 |
| 30 | R$210 | 5×7dez | 7,00 |
| 50 | R$378 | 9×7dez | 7,56 |
| 60 | R$420 | 10×7dez | 7,00 |
| 64 | R$504 | 3×8dez | 7,88* |
| 100 | R$840 | 5×8dez | 8,40 |

(* centavos não exatos. Corrigido na Fase 1: N=7 é 7,72 pela regra "para cima" — o vetor antigo dizia 7,71 —, e N=64 também tem centavo quebrado: 504/64 = 7,875.) Para N=6 o total 42 também é 1×7dez; vale o desempate por menor k.

### 4.4 Simulador (somente ADM)
Três modos, todos com a tabela "composição → gasto, sobra, cota final, jogos, apostas equivalentes (gasto/R$6), probabilidades, aviso de centavos":

1. **Por número de cotas** (4.3).
2. **Por valor**: entrada N e `cota_base` (ou arrecadação `B = N × cota_base`). Busca as combinações de até `limite_recibos_simulador` recibos, cada um válido para N (4.2), com `soma ≤ B`, maximizando o gasto. Perfis: *menos recibos*, *mais dezenas*, *mais jogos*. Modo de cobrança: **cota fixa** (sobra → caixinha) ou **cota-teto** (cobra `gasto/N` arredondado para cima).
3. **Inverso**: dado um orçamento, quantas cotas cabem respeitando 700×N por recibo e N ≤ 100. **[PREMISSA adotada na Fase 1]**: para cada N de 2 a 100, mostra o melhor gasto ≤ orçamento (com a composição e a cota) e destaca o maior N viável.

**Vetores de teste (por valor):**
- N=24, cota-base R$50 → B=R$1.200; 1 recibo: 7×8dez = R$1.176 (cota 49,00; sobra R$24).
- N=20, cota-base R$100 → B=R$2.000; gasto máximo **R$1.974** (47 × R$42), sobra R$26, cota final 98,70; 329 apostas equivalentes. Ex.: 2 recibos (7×7dez + 10×8dez), cotas 14,70 + 84,00.
- N=32, cota-base R$42 → R$1.344 sem sobra (ex.: 8×8dez).
- Cota-base R$42 fecha sem sobra de 5 a 54 cotas (conferido na Fase 1: fecha também em 2, 3 e 4 e em todos os N pares de 56 a 100); R$84 fecha para qualquer N; R$50 só fecha em N=3,6,21,42,84 (até 4 recibos, N≥9 só múltiplos de 42).
- Invariante: cada R$6 compra uma combinação, qualquer que seja k; logo a chance total depende só do gasto.

Requisito: o simulador usa programação dinâmica sobre os totais possíveis (todos múltiplos de 600 centavos), não força bruta.

---

## 5. Gerador de jogos (somente ADM)

Entrada: lista de recibos (k, g) vinda do simulador. Saída: jogos (conjuntos de k dezenas de 1..60) que atendem as premissas ligadas.

**Modos:** totalmente aleatório | com premissas (cada uma liga/desliga e tem parâmetros).

| Premissa | Parâmetro |
|---|---|
| Máx. de números iguais entre dois jogos | N_max; escopo: dentro do recibo / entre recibos / entre bolões (padrão: todos os jogos do concurso). Com N_max=5 nunca há combinação de 6 repetida. |
| Números mais frequentes | X mais sorteados num **período livre** (intervalo de datas ou concursos, "dezembro de qualquer ano", só Viradas, últimos N anos, história toda); restringir jogos a eles ou apenas ponderar o sorteio |
| Máx. consecutivos | Y (maior sequência dentro do jogo) |
| Histórico | máx. de quinas/quadras que o jogo já fez no período escolhido |
| Pares/ímpares | faixa permitida de pares |
| Soma das dezenas | mínimo e máximo; sugestão por percentis (P10–P90) do histórico |
| Linhas do volante | máx. por linha (6 linhas de 10: 1–10, 11–20, …) |
| Obrigatórios / proibidos | obrigatórios em todos os jogos ou em ≥ M jogos; proibidos fora de todos |

Comportamento: geração por amostragem com rejeição e reinício; **detectar inviabilidade** e dizer qual premissa trava; regerar um jogo; **travar** jogos; relatório "premissas atendidas por jogo" e sobreposição máxima; ao **confirmar**, congelar com data/hora e **hash SHA-256** do conjunto de jogos, opção de anexar foto do recibo (armazenamento privado).
Aviso obrigatório: restringir a poucos números aumenta repetições e **reduz** combinações distintas.
**[PREMISSAS adotadas na Fase 2]**: pares, soma e linhas do volante valem para as k dezenas do jogo (valores absolutos); a sugestão de soma é o P10–P90 da soma dos sorteios de 6 dezenas escalado por k/6 (aproximação); "quinas/quadras que o jogo já fez" = nº de concursos do período em que o jogo teve ≥ 5 (≥ 4) acertos; "obrigatórios em ≥ M jogos" = cada dezena obrigatória aparece em pelo menos M jogos do bolão; o escopo padrão do "máx. de iguais" é todo o concurso; nunca se repete combinação de 6 dezenas, com ou sem premissas.

---

## 6. Cruzamento entre bolões (somente ADM)

- Registro único de **todas as combinações de 6** já cobertas no concurso (cada jogo de k dezenas cobre C(k,6) combinações).
- Ao gerar um bolão novo, excluir automaticamente combinações já usadas; detectar jogos idênticos e combinações repetidas (jogos de k≥7 que dividem ≥6 dezenas).
- Relatório de auditoria: duplicidades, sobreposição máxima entre quaisquer dois jogos, chance de sena combinada.
- O apostador **nunca** vê a relação entre bolões.

---

## 7. Probabilidades

- Sena (exata): `combinacoes_distintas / 50.063.860` (descontar sobreposição). Ex.: 329 combinações → ≈ 1 em 152.170.
- Por aposta simples: sena 1 em 50.063.860; quina 324/50.063.860 (1 em 154.518); quadra 21.465/50.063.860 (1 em 2.332).
- Acertos de um jogo de k dezenas: hipergeométrica `C(k,h)·C(60−k,6−h)/C(60,6)`.
- "Pelo menos uma quina/quadra" no bolão: simulação Monte Carlo (≥ 2 milhões de sorteios, em Web Worker, mostrando margem de erro, rotulada **aproximada**) e, opcionalmente, cálculo exato por enumeração em worker com barra de progresso.
- Exemplo de referência (329 combinações, jogos aleatórios): P(≥1 quadra) ≈ 2,6% (2 recibos: 7×7dez+10×8dez), ≈ 2,2% (3 recibos com 1×10dez) e ≈ 4,5% (47×7dez). Estrutura não muda a chance de sena nem o valor esperado; muda a chance de "pelo menos um prêmio" (jogos grandes concentram prêmios).
- Texto fixo na tela: **estatísticas de sorteios passados não aumentam a probabilidade**.

---

## 8. Conferência e rateio

### 8.1 Decomposição em apostas simples
Para um jogo de k dezenas com h acertos entre as 6 sorteadas:
`sena = C(h,6)·C(k−h,0)`, `quina = C(h,5)·C(k−h,1)`, `quadra = C(h,4)·C(k−h,2)`.

| k | h | sena | quina | quadra |
|---|---|---|---|---|
| 6 | 5 | 0 | 1 | 0 |
| 7 | 5 | 0 | 2 | 5 |
| 8 | 5 | 0 | 3 | 15 |
| 7 | 6 | 1 | 6 | 0 |
| 8 | 6 | 1 | 12 | 15 |
| 10 | 4 | 0 | 0 | 15 |

### 8.2 Valor
`bruto_recibo = Σ_jogos (sena×valor_sena + quina×valor_quina + quadra×valor_quadra)` com os **valores oficiais por ganhador** do concurso (campo `rateio` de cada faixa). `liquido = bruto × (1 − ir)` (considerando `ir_valor_isento`). `por_cota = liquido_recibo / N`; o participante soma suas cotas em cada recibo. **[PREMISSA adotada na Fase 1]**: o IR é arredondado para o centavo mais próximo (meio centavo sobe; reproduz o vetor abaixo) e o prêmio por cota é arredondado **para baixo**, com o resto indo para a caixinha; confirmar com o rateio real da Caixa.
Vetor de teste (concurso 2955, Virada 2025: quina R$11.931,42; quadra R$216,76): jogo de 7 dezenas com 5 acertos = 2×11.931,42 + 5×216,76 = **R$24.946,64 bruto**, **R$17.462,65 líquido**.

### 8.3 Quando mostrar "o bolão ganhou"
Assim que o concurso estiver no banco, o app calcula e exibe, com selo de origem ("Caixa, obtido em dd/mm hh:mm") e status **Confirmado** (conferido com 2ª fonte) ou **Aguardando confirmação**. O ADM pode travar/corrigir qualquer concurso.

### 8.4 Estimativas antes do sorteio e regra de rateio não reconciliada
Dados oficiais mostram: quadra = 5% × 43,79% × arrecadação na Virada 2025 e 10% nos concursos comuns recentes (confere); **quina paga sempre 70% da quadra** nas 16 Viradas de 2009–2025 (não vale para todos os concursos); a sena da Virada 2025 pagou R$1,09 bi, abaixo de 90% do prêmio bruto — **o texto da regra não explica**. Portanto:
- Fonte de verdade = rateio oficial. Estimativas = faixas **empíricas** rotuladas "estimativa calibrada": quadra pela fórmula, quina = 70% da quadra, sena = estimativa divulgada pela Caixa (campo `valorEstimadoProximoConcurso`).
- Dados empíricos (quadra/arrecadação): ~8,24% (2016–2023), 8,32% (2024), 2,19% (2025 — coincide com a mudança de regra).
- **[PENDENTE]** reconciliar; registrar em `docs/rateio.md`.

---

## 9. Banco de concursos

### 9.1 Princípios
Origem **direta da Caixa**; **sem job automático**. Botão **"Atualizar lista de concursos"** para **qualquer visitante**; importação manual da planilha oficial pelo ADM.

### 9.2 Fluxo do botão
1. O **navegador do visitante** consulta a Caixa pelo número (último no banco + 1, +2, … até a Caixa recusar; concurso inexistente responde HTTP 500, não 404; **não** usar o endpoint "último", que atrasa).
2. Envia ao servidor, que valida e grava: próximo concurso na sequência; 6 dezenas distintas 1..60; valores ≥ 0; nunca sobrescreve; limite de 1 atualização/minuto; confere com 2ª fonte (resultadomega, lida pelo servidor) → **Confirmado** ou **Aguardando confirmação**.
3. Se a Caixa recusar (CORS/IP), mostrar mensagem clara e oferecer: plano B (intermediário gratuito testado do Brasil), plano C (planilha).

### 9.3 Fase 0 — spikes obrigatórios antes de investir
1. A Caixa responde a `fetch` vindo do navegador (CORS) e de visitantes fora do Brasil? Medir.
2. Intermediário (Cloudflare Worker ou equivalente) consegue falar com a Caixa a partir do Brasil?
3. Política de senha e RLS no Supabase (seção 11).
4. Importação da planilha oficial.

**Resultado (26/11/2026):** ver `docs/fase0-relatorio.md`. Resumo: (1) Caixa responde ao navegador no Brasil, com CORS livre (`*`), de computador e celular em 4G; **visitante fora do Brasil não foi testado** (risco conhecido); (2) Worker da Cloudflare consegue consultar a Caixa a partir de data centers do Brasil; (3) Supabase atende senha e RLS; (4) planilha importa com leitor próprio (`src/data/planilha.ts`), pois bibliotecas comuns de Excel não leem o arquivo da Caixa.

### 9.4 Fontes
| Fonte | Uso | Observações |
|---|---|---|
| Caixa `https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena/{n}` | principal (oficial) | bloqueia IP de datacenter fora do Brasil; funciona no navegador no Brasil |
| Planilha oficial `Mega-Sena.xlsx` | importação ADM | 3.086 concursos (1→3086, 15/11/2026), sem lacunas/duplicatas |
| `https://resultadomega.com.br/api/ultimo.json` (`concursos.json`, `proximo.json`) | conferência/reserva (marcada não oficial) | CORS livre, projeto novo de uma pessoa |
| `https://api.guidi.dev.br/loteria/megasena/ultimo` ou `/{n}` | **descartada para uso no navegador** | só IP do Brasil, com rate limit; **não envia CORS**, o navegador bloqueia (Fase 0, teste 1, 26/11/2026). Só serviria lida pelo servidor |
| `https://valorfinal.com.br/dados/loterias/megasena.csv` | histórico de reserva (só sorteios) | CC BY 4.0 — citar ValorFinal e Caixa na tela "Fontes" |

### 9.5 Mapeamento dos campos
**Caixa (JSON):** `numero`, `dataApuracao` (dd/mm/aaaa), `listaDezenas` (ordenadas, strings), `dezenasSorteadasOrdemSorteio`, `listaRateioPremio[{faixa 1|2|3, numeroDeGanhadores, valorPremio}]`, `valorArrecadado`, `valorEstimadoProximoConcurso`, `valorAcumuladoConcursoEspecial` (acumulado da Virada), `valorAcumuladoProximoConcurso`, `valorAcumuladoConcurso_0_5`, `acumulado`, `listaMunicipioUFGanhadores`, `localSorteio`, `numeroConcursoProximo`, `dataProximoConcurso`, `indicadorConcursoEspecial` (visto 2 na Virada 2025 e 1 no concurso comum 3086 — **apenas sinal de apoio**), `observacao`. Limpar `\u0000` em `nomeTimeCoracaoMesSorte`.
**Planilha oficial (A–T):** Concurso, Data do Sorteio (dd/mm/aaaa), Bola1..Bola6, Ganhadores 6 acertos, Cidade/UF, Rateio 6 acertos, Ganhadores 5 acertos, Rateio 5 acertos, Ganhadores 4 acertos, Rateio 4 acertos, Acumulado 6 acertos, Arrecadação Total, Estimativa prêmio, Acumulado Sorteio Especial Mega da Virada, Observação. **Valores monetários vêm como texto `R$1.234,56`** → converter para centavos. A planilha não traz a ordem de sorteio nem cidades de quina/quadra.
Vetores: concurso 3086 (15/11/2026): dezenas 03-20-35-38-43-46; sena 0 ganhadores; quina 44 × R$32.785,73; quadra 2.538 × R$811,98; arrecadação R$47.061.366. Concurso 2955 (01/01/2026): 09-13-21-32-33-59; sena 6 × R$181.892.881,09; quina 3.921 × R$11.931,42; quadra 308.315 × R$216,76; arrecadação R$3.052.431.720.

### 9.6 Tela "Fontes de dados" (ADM)
Última atualização, quem/quando (anônimo), origem e status por concurso; importar planilha; conflitos pendentes; lista de fontes.

---

## 10. Estatísticas (ADM e apostador, somente leitura)
Frequência, atraso, pares/ímpares, soma, linhas do volante, consecutivos; **filtro por período livre**; sempre com o aviso da seção 7.

---

## 11. Perfis, acesso e segurança

| | ADM | Apostador |
|---|---|---|
| Acesso | **usuário e senha** | link público, sem login |
| Bolões | simulador, gerador, cruzamento, criar, congelar | vê jogos congelados |
| Participantes | nomes, cotas, pagamentos, via entregue, caixinha | **sem nomes**: totais de cotas, pagos, arrecadado |
| Regras/fontes | edita | leitura |
| Conferência | rateio oficial e simulações | acertos, "ganhou?", valor por cota |
| Estatísticas | todas | todas (leitura) |

- **Senha do ADM:** mínimo 8 caracteres com maiúscula, minúscula, número e símbolo, validada na tela **e** no servidor; sem cadastro público; bloqueio após tentativas erradas; "usuário" mapeado para o e-mail interno do Supabase Auth; recuperação por e-mail cadastrado. **[PREMISSA]** um único ADM. **[DECISÃO da Fase 2]**: o usuário vira o e-mail interno fixo `usuario@example.com` (domínio aceito pelo Supabase, testado na Fase 0); por isso a recuperação de senha **não chega por e-mail**: o dono do projeto troca a senha no painel do Supabase (Authentication → Users). O bloqueio após tentativas erradas é **parcial** na Fase 2 (limite por IP do próprio Supabase + espera crescente na tela). **[DECISÃO da Fase 5]**: no lugar do bloqueio de conta, o ADM usa **verificação em 2 passos (TOTP, código de 6 dígitos no celular)**: com um fator ativo, o banco (`is_adm()`) só trata a sessão como ADM no nível `aal2`, então a senha sozinha não lê nem escreve nada, nem por chamada direta à API. Sem fator ativo nada muda (para não trancar o dono de fora); a tela Conta ativa e desativa, e o Painel avisa enquanto não estiver ativa. Se o celular for perdido, o fator é removido no painel do Supabase. **O link pessoal secreto por participante entrou na Fase 5**: `#/p/<token>` mostra só as cotas, o valor e os jogos do(s) bolão(ões) em que aquela pessoa participa; o ADM liga, desliga e renova o link. A **foto do recibo** fica em armazenamento privado (só o ADM). O ADM tem telas de **Auditoria** e **Backup** (JSON e CSV de pagamentos).
- **Privacidade no servidor:** Row Level Security; o público só acessa **visões agregadas/funções** (sem nomes). Nunca depender de ocultar na tela.
- **Link pessoal secreto por participante** (opcional, liga/desliga): mostra só as cotas e o valor dele.
- **Data limite de aposta:** um campo de data/hora editável pelo ADM; bloqueia novas cotas (ADM pode prorrogar) e alimenta a contagem regressiva exibida ao apostador.
- Dados pessoais mínimos (nome, cotas, status de pagamento). O repositório é público: **nenhum dado de participante, chave secreta ou planilha com nomes pode ir ao Git** (`dados/` no `.gitignore`).
- Histórico de alterações (auditoria) e backup exportável.

---

## 12. Modelo de dados (sugestão — o Code pode refinar mantendo as regras)

`rules_versions(id, vigencia_inicio, json)` · `concursos(numero PK, data, dezenas int[6], ordem_sorteio int[], arrecadacao_cent, estimativa_prox_cent, acumulado_virada_cent, acumulado_prox_cent, observacao, fonte, obtido_em, status[confirmado|aguardando|oficial_importado])` · `concurso_faixas(concurso, faixa 4|5|6, ganhadores, valor_cent)` · `bolaos(id, concurso_alvo, nome, cota_base_cent, modo_cobranca, status[rascunho|congelado], congelado_em, hash)` · `recibos(id, bolao_id, k, g, total_cent, cotas_n, foto_path)` · `jogos(id, recibo_id, dezenas int[], travado)` · `combinacoes_cobertas(concurso, combo_hash)` · `participantes(id, nome, contato?)` · `cotas(id, participante_id, bolao_id, qtd, valor_devido_cent, pago, via_entregue, token_publico?)` · `caixinha_mov(id, bolao_id, valor_cent, motivo)` · `fontes_log(id, quando, origem, concurso, resultado)` · `auditoria(id, quando, usuario, acao, detalhe)` · `config(chave, valor)` (inclui `data_limite_aposta`).

---

## 13. Telas
**ADM:** painel; regras e parâmetros; simulador; gerador e cruzamento; bolões e recibos (congelar, foto); participantes e pagamentos; caixinha; concursos e fontes; conferência/rateio; estatísticas; auditoria e backup.
**Apostador:** resumo do bolão (totais, contagem regressiva); jogos congelados; conferência (acertos, ganhou?, valor por cota); estatísticas.
Geral: PT-BR, formato R$ e dd/mm/aaaa, PWA instalável, layout para celular primeiro.

---

## 14. Plataforma e custo
PWA em TypeScript (Vite + framework à escolha), motor de regras isolado em `src/engine/` com testes (Vitest), trabalhos pesados em Web Worker. Hospedagem gratuita (Cloudflare Pages ou GitHub Pages) e **Supabase** (banco + autenticação, região São Paulo se disponível). Custo do programa: R$ 0. O banco gratuito pode pausar por inatividade (reativar). Sem job agendado de atualização.

---

## 15. Premissas e pendências
**Premissas:** uso oficial da Caixa com 1 recibo por cota; sem tarifa de 35%; "máx. N iguais" vale entre todos os jogos do concurso; um ADM; arredondamento para cima (excesso → caixinha).
**Pendentes (validar na construção):** arredondamento real da Caixa; isenção de IR em prêmios pequenos; máximo de cotas por dezenas (usar total ÷ R$7, ≤ 100); horário final das apostas; CORS/IP da Caixa (Fase 0); política de senha do Supabase; reconciliação do rateio (8.4); API comunitária de reserva.

---

## 16. Plano de construção por fases
| Fase | Entrega | Aceite |
|---|---|---|
| 0 | Spikes (9.3) + esqueleto do projeto + CI de testes | relatório curto dos 4 testes com decisão por escrito |
| 1 | `engine/`: preços, totais, simulador (3 modos), decomposição de acertos, probabilidades, validações | **todos os vetores de teste das seções 4, 7, 8, 9 passando** |
| 2 | ADM: login/regras, simulador, gerador, cruzamento, criar/congelar bolão | gerar bolão de 20 cotas × R$100 igual ao vetor; 0 combinações repetidas |
| 3 | Participantes, cotas, pagamentos, caixinha, via entregue, data limite, visão do apostador + RLS | apostador não consegue ler nomes nem por chamada direta à API |
| 4 | Concursos (botão, importação da planilha), conferência, rateio, probabilidades na tela, estatísticas | importar 3.086 concursos; conferir 2955/3086 com os valores oficiais |
| 5 | Segurança, backup, auditoria, deploy, manual do ADM | checklist de segurança e ensaio de ponta a ponta com concurso real |

Marcos sugeridos: fases 0–2 até 30/11; fase 3 até 10/12; fase 4 até 20/12; fase 5 até 28/12; apostas fecham 31/12.

---

## 17. Critérios de aceite global
1. Nenhum valor de regra fixo no código; tudo em `rules.json`.
2. Todos os vetores de teste passam.
3. O público nunca vê nomes (testado por chamada direta).
4. Valor do prêmio sempre vindo do rateio oficial; estimativas sempre rotuladas.
5. O ADM consegue, sozinho, criar um bolão, registrar cotas e conferir um concurso.
