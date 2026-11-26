# Fase 0 — Relatório dos testes de viabilidade (SPEC 9.3)

Status: **Fase 0 encerrada em 26/11/2026.** 4 testes feitos; um único ponto **não testado** (visitante fora do Brasil, ver "Risco conhecido").

| # | Teste | Status | Decisão |
|---|---|---|---|
| 1 | A Caixa responde ao navegador (CORS) e a visitantes de fora do Brasil? | **concluído para o Brasil** (computador e celular 4G); exterior **não testado** | **Plano A: o navegador do visitante consulta a Caixa por número.** Funciona com CORS livre |
| 2 | Intermediário (Cloudflare Worker ou equivalente) fala com a Caixa a partir do Brasil? | **concluído para o Brasil** (data centers GIG e GRU) | **Plano B: Cloudflare Worker** que só aceita número de concurso. Plano C: planilha |

### Risco conhecido (não testado)
Não foi possível testar um visitante **fora do Brasil**. Se a Caixa recusar IPs do exterior, o botão "Atualizar" falha para esse visitante. Mitigação já prevista no SPEC 9.2: mensagem clara + plano B (Worker forçado na região de São Paulo, `spikes/worker/wrangler-br.toml`, já publicado e testado do Brasil) + plano C (planilha). Como o ADM e quem atualiza a lista estarão no Brasil, o impacto prático é baixo. **Reavaliar** quando algum participante no exterior abrir o app: a página `https://bolao-spike-caixa.pages.dev` continua no ar para esse teste.

### Decisões de projeto resultantes
1. Fonte principal dos concursos: Caixa, pelo navegador, por número (último + 1, +2…); HTTP 500 = fim da lista.
2. 2ª fonte de conferência: **resultadomega** (CORS livre). **guidi descartada** no navegador (sem CORS).
3. Banco e autenticação: **Supabase, região São Paulo**, chaves novas (`sb_publishable`, `sb_secret`).
4. Importação da planilha oficial: leitor próprio, carga inicial de 3.086 concursos; a Caixa já está 4 concursos à frente (3090).
5. Neste computador: usar `npm.cmd`/`npx.cmd` e `NODE_USE_SYSTEM_CA=1` (proxy Zscaler).
| 3 | Política de senha e RLS no Supabase | **concluído (26/11/2026)** | **Supabase atende: senha forte imposta pelo servidor, cadastro público desligado, público não lê nomes** |
| 4 | Importação da planilha oficial | **concluído (26/11/2026)** | **Usar a planilha como carga inicial do banco: SIM** |

---

## Teste 1 — A Caixa responde ao navegador? (PARCIAL, 26/11/2026)

Página de teste: `spikes/caixa.html` (rodar com `npm.cmd run dev` e abrir `http://localhost:5173/spikes/caixa.html`).

**Medido no navegador do app, IP de Rio de Janeiro/BR (saída do proxy corporativo Zscaler):**

| Fonte | Resultado | Tempo |
|---|---|---|
| Caixa, concurso 3086 (existe) | OK, HTTP 200, dados corretos | 385 ms |
| Caixa, concurso 3090 (24/11/2026, ainda fora da planilha) | OK, HTTP 200 | 104 ms |
| Caixa, concurso 9999 (inexistente) | HTTP 500, como o SPEC previa | 89 ms |
| resultadomega.com.br `ultimo.json` | OK (último = concurso 3090) | 162 ms |
| valorfinal.com.br CSV | OK | 338 ms |
| guidi.dev.br concurso 3086 | **BLOQUEADO no navegador** (resposta sem cabeçalho CORS) | 631 ms |

Conferido também por consulta direta (curl) do mesmo computador: a Caixa devolve `Access-Control-Allow-Origin: *` (qualquer site pode ler no navegador); guidi **não** devolve esse cabeçalho.

**Conclusões já firmes**
1. **No Brasil, o plano A funciona:** o navegador do visitante consegue consultar a Caixa por número, e o concurso inexistente devolve 500 (tratar como "fim da lista", não como erro).
2. **guidi não serve como 2ª leitura pelo navegador** (SPEC 9.4 supunha que sim). A 2ª fonte passa a ser **resultadomega** (CORS livre).
3. A planilha está **4 concursos atrás** (3086 → Caixa já tem até o 3090): o botão "Atualizar" terá trabalho real a fazer logo de início.

**Celular em 4G/5G, IP de São Paulo/BR, origem real `https://bolao-spike-caixa.pages.dev` (26/11/2026, 17:23)**

| Fonte | Resultado | Tempo |
|---|---|---|
| Caixa 3086 / 3090 | OK (200) | 580 / 124 ms |
| Caixa 9999 (inexistente) | HTTP 500 como esperado | 148 ms |
| Via Worker normal, 3086 / 9999 | Caixa respondeu 200 / 500 ao Worker (data center GRU = São Paulo) | 448 / 678 ms |
| Via Worker forçado em São Paulo, 3086 | Caixa respondeu 200 | 206 ms |
| resultadomega | OK | 589 ms |
| valorfinal CSV | OK | 860 ms |
| guidi | **BLOQUEADO** (sem CORS, de novo) | 870 ms |

Conclusões adicionais: funciona com origem real (domínio publicado), não só `localhost`, e com IP residencial de operadora no Brasil (sem proxy corporativo). O resultado da Caixa no Worker, a partir de um data center brasileiro, é o mesmo que no navegador.

**Ainda falta**
- Visitante **fora do Brasil** (IP residencial no exterior): a Caixa responde no navegador? O Worker normal (que roda perto do visitante, portanto no exterior) é recusado? O Worker forçado em São Paulo resolve? (Teste C, depende de alguém no exterior.)
- Observação: `cfPlacement` veio vazio nos testes feitos no Brasil, então ainda não está provado que o `placement` forçado funciona. O teste do exterior decide.

---

## Teste 3 — Supabase: política de senha e RLS (26/11/2026)

**Resultado: aprovado.** Projeto `bolao-mega-sena`, região São Paulo, plano Free. Script: `spikes/supabase/rls.mts` (chama a API diretamente, como um atacante; SQL em `spikes/supabase/teste-rls.sql`). Todas as verificações passaram.

**Privacidade (chave pública/publishable, chamada direta à API)**
- `SELECT nome`, `SELECT *` e busca com filtro por nome: **nenhum nome devolvido** (HTTP 401).
- `INSERT`, `UPDATE` e `DELETE` pelo público: recusados.
- A função pública de totais (`resumo_publico_teste`, `security definer`) funciona e devolve só números: `total_cotas 6, cotas_pagas 3, participantes 3`, sem nomes. É o modelo a usar na Fase 3 ("público só lê funções agregadas").
- O esquema da API (`/rest/v1/`) também responde 401 ao público.

**Política de senha (servidor, via API administrativa)**
- Recusadas (HTTP 422): `abc`, `12345678`, `abcdefgh`, `Abcdefgh` e `Abcdefg1` (8 caracteres, sem símbolo). Ou seja, o servidor exige **minúscula, maiúscula, número e símbolo**, como pede o SPEC (seção 11).
- Aceita: `Abcdef1!xyz`. Usuário de teste apagado em seguida.
- **Cadastro público desligado** (signup recusado).

**Pontos de atenção para a Fase 3**
1. A tabela de teste foi protegida em **duas camadas**: RLS ligada **e** permissões de tabela retiradas do público (`revoke`). O teste confirma a barreira de permissões; **a camada de RLS isolada** (se alguém conceder `SELECT` por engano, a RLS sem política deve devolver lista vazia) deve ter teste próprio nas tabelas reais.
2. O Supabase agora usa chaves `sb_publishable_…` e `sb_secret_…` (as legadas serão aposentadas no início de 2027). Usar sempre as novas. A chave secreta só roda local ou em servidor, **nunca** no navegador nem no Git.
3. Falta ainda a regra "bloqueio após tentativas erradas" (SPEC 11); verificar nas configurações de proteção de Auth na Fase 2.
4. O servidor do Supabase não está atrás do proxy da empresa nos testes feitos; o Node precisou de `NODE_USE_SYSTEM_CA=1` por causa do Zscaler (vale para qualquer script local que acesse a internet).
5. Limpeza: a tabela e a função de teste ainda existem no banco; apagar com o bloco "LIMPEZA" do SQL ao final da Fase 0.

**Decisão:** usar o Supabase (São Paulo) como banco e autenticação. A política de senha nativa já cumpre o SPEC; ainda assim a validação "na tela e no servidor" será mantida no app (a do servidor já está garantida pelo Supabase).

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
