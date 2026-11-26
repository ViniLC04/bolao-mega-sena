# Fase 0 — Relatório dos testes de viabilidade (SPEC 9.3)

Status: **1 de 4 concluídos.**

| # | Teste | Status | Decisão |
|---|---|---|---|
| 1 | A Caixa responde ao navegador (CORS) e a visitantes de fora do Brasil? | pendente | — |
| 2 | Intermediário (Cloudflare Worker ou equivalente) fala com a Caixa a partir do Brasil? | pendente | — |
| 3 | Política de senha e RLS no Supabase | pendente | — |
| 4 | Importação da planilha oficial | **concluído (26/11/2026)** | **Usar a planilha como carga inicial do banco: SIM** |

---

## Teste 4 — Importação da planilha oficial `Mega-Sena.xlsx`

**Resultado: aprovado.** Todos os vetores do SPEC (seção 9.5) conferem.

**O que foi medido**
- 3.086 concursos, do 1 (11/03/1996) ao 3086 (15/11/2026), **sem lacunas e sem duplicatas**.
- Todos com 6 dezenas distintas entre 1 e 60; nenhum valor negativo.
- Concurso 3086: dezenas 03-20-35-38-43-46; sena 0 ganhadores; quina 44 × R$ 32.785,73; quadra 2.538 × R$ 811,98; arrecadação R$ 47.061.366,00. **Confere com o SPEC.**
- Concurso 2955 (01/01/2026): 09-13-21-32-33-59; sena 6 × R$ 181.892.881,09; quina 3.921 × R$ 11.931,42; quadra 308.315 × R$ 216,76; arrecadação R$ 3.052.431.720,00. **Confere com o SPEC.**
- Leitura do arquivo inteiro: cerca de 130 ms.

**Problema encontrado (e resolvido)**
As bibliotecas comuns de leitura de Excel (`read-excel-file`, `exceljs`) **falham** nesta planilha. Motivos: o XML usa o prefixo `x:` (`<x:row>`) e as células das linhas de dados **não têm endereço** (A2, B2…). Foi escrito um leitor próprio, `src/data/planilha.ts`, que:
- acha as colunas pelo **nome** do cabeçalho (se a Caixa mudar a ordem, continua funcionando; se renomear, dá erro claro);
- converte `R$1.234,56` para centavos **sem usar decimais**;
- roda no navegador e no Node (será reaproveitado na importação da Fase 4);
- tem testes em `tests/vectors/planilha.test.ts`. Os testes que leem a planilha real são pulados no GitHub, onde ela não existe (fica fora do Git).

**Cuidados para a Fase 4** (observações sobre os dados)
1. **Arrecadação vem vazia (0) em 1.069 concursos antigos.** Serve para estatística de sorteios; só não serve para calibrar rateio dos concursos antigos.
2. **A coluna "Acumulado Sorteio Especial Mega da Virada" é preenchida em 2.075 concursos**, não só nas Viradas. Portanto **não dá para identificar Virada por essa coluna**.
3. **Como identificar Viradas:** pela data (31/12, e 01/01 quando o sorteio foi adiado, como o 2955 em 01/01/2026; a Virada 2026 será o 3100 em 01/01/2027). A planilha tem sorteios em 31/12 desde 1998, antes de existir a Mega da Virada como hoje. Então a **lista oficial de Viradas** precisa ser definida (parâmetro editável). Registrado em `docs/pendencias.md`.
4. A planilha **não traz** ordem de sorteio nem cidades de quina/quadra (como o SPEC já avisava). Coluna "Cidade / UF" só tem dado para sena.
5. A coluna "Observação" tem texto livre em 896 concursos (ex.: "GANHADOR DA CIDADE DE SALVADOR…"); guardar como texto, sem interpretar.

**Decisão:** a planilha oficial é uma boa carga inicial do banco. Importar pelo leitor próprio, validando com `validarConcursos` antes de gravar. Nunca sobrescrever concursos já existentes.
