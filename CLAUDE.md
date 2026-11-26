# CLAUDE.md — Bolão da Mega da Virada

Projeto: programa web (PWA, celular e computador) para organizar o bolão da Mega da Virada.
**Fonte de verdade do que construir: `SPEC.md`.** Leia-o inteiro antes de começar e releia a seção da fase atual.

## Quem é o usuário
- O usuário **não programa**. Fale em **português do Brasil**, simples e direto. Explique o que vai fazer antes de fazer.
- Quando precisar de uma ação manual (criar conta, copiar chave, abrir um link), dê **passo a passo numerado**.
- O app e a documentação são em PT-BR. Moeda `R$ 1.234,56`, datas `dd/mm/aaaa`.

## Forma de trabalhar
1. Use o **modo de planejamento** no início de cada fase. Mostre o plano curto e espere o "ok" do usuário.
2. Trabalhe **uma fase por vez** (seção 16 do SPEC). Ao terminar: rode os testes, faça commit com mensagem clara e resuma o que ficou pronto e o que falta.
3. Faça **commits pequenos e frequentes**. Nunca deixe o projeto quebrado entre commits.
4. Se uma decisão do SPEC mudar durante a conversa, **atualize o SPEC.md** no mesmo commit.
5. Se algo estiver marcado **[PREMISSA]** ou **[PENDENTE]** no SPEC, não invente: implemente como parâmetro editável e registre a dúvida em `docs/pendencias.md`.
6. O prazo é duro: apostas fecham em 31/12/2026 às 22h. Priorize na ordem das fases; não gaste tempo com enfeites antes do núcleo funcionar.

## Regras técnicas inegociáveis
- **Dinheiro sempre em inteiros (centavos)**. Nunca use `float` para valores monetários.
- **Nenhuma regra oficial fixa no código** (preços, limites, percentuais, IR). Tudo em `rules.json`, versionado por vigência e editável pelo ADM.
- **Motor de regras puro** em `src/engine/` (sem rede, sem banco, sem tela), com testes automatizados (Vitest). Todo vetor de teste do SPEC (seções 4, 7, 8, 9) vira um teste.
- Cálculos pesados (probabilidades, simulador) rodam em **Web Worker**, com barra de progresso.
- O simulador usa programação dinâmica sobre os totais possíveis (todos múltiplos de R$ 6), não força bruta.
- **Valor de prêmio vem sempre do rateio oficial da Caixa.** Estimativas ficam rotuladas "estimativa calibrada". Nunca afirme valor líquido por cota sem o rateio oficial no banco.
- A regra de rateio **não reconcilia** com o texto publicado pela Caixa (SPEC 8.4). Não tente "consertar" com fórmula.
- **Estatísticas de sorteios passados não aumentam a chance de acerto.** Mantenha o aviso visível nas telas de estatística e de probabilidade.

## Dados e rede
- A Caixa **bloqueia IPs de servidor fora do Brasil**. Por isso: o botão "Atualizar lista de concursos" busca no **navegador do visitante**; o servidor só valida e grava. **Não** crie job agendado de atualização.
- Consulte a Caixa **por número de concurso** (último no banco + 1, +2…). Não use o endpoint "último concurso" (atrasa). Concurso inexistente responde HTTP 500.
- Valide tudo antes de gravar: próximo da sequência, 6 dezenas distintas de 1 a 60, valores ≥ 0, **nunca sobrescrever**, limite de 1 atualização por minuto. Confira com 2ª fonte e marque Confirmado / Aguardando confirmação.
- A planilha oficial `Mega-Sena.xlsx` traz valores como texto `R$1.234,56` — converter para centavos.
- Cite **ValorFinal** (CC BY 4.0) e **Caixa** na tela "Fontes" se usar o CSV do ValorFinal.

## Segurança e privacidade
- Login do ADM por **usuário e senha** (Supabase Auth; usuário mapeado para e-mail interno). Senha: mínimo 8, com maiúscula, minúscula, número e símbolo — validar na tela **e** no servidor. Sem cadastro público.
- **Row Level Security** em todas as tabelas. O público só lê visões/funções agregadas (sem nomes). Teste chamando a API diretamente.
- O repositório é **público**: **nunca** commitar dados de participantes, chaves secretas, `.env`, nem as planilhas com nomes. Crie `.gitignore` incluindo `dados/` e `.env*` **no primeiro commit**.
- Registre alterações em tabela de auditoria. Ofereça backup exportável.

## Estrutura sugerida
```
src/engine/      motor de regras (puro, testado)
src/workers/     cálculos pesados
src/app/         telas ADM e apostador
src/data/        acesso ao Supabase, fontes de concursos, importação
rules.json       regras versionadas
tests/vectors/   vetores de teste do SPEC
docs/            pendencias.md, rateio.md, manual-adm.md
dados/           (ignorado pelo Git) planilhas locais do usuário
```

## Comandos
Requer Node.js LTS. Rodar na pasta do projeto (`C:\Projetos\bolao-mega-sena`).
**No PowerShell deste computador, use `npm.cmd` no lugar de `npm`** (a política de scripts bloqueia `npm.ps1`); o mesmo vale para `npx.cmd`.
- Instalar dependências: `npm install`
- Rodar em desenvolvimento: `npm run dev` (abre em http://localhost:5173)
- Testes (uma vez): `npm test` · testes ao salvar: `npm run test:watch`
- Checar que nenhum dado/segredo está no Git: `npm run checar-segredos`
- Gerar build: `npm run build`
- Publicar: (definir na Fase 5 — Cloudflare Pages)

## Definição de pronto (por fase)
Testes passando · vetores do SPEC cobertos · sem segredos no Git · RLS testada (quando houver banco) · commit feito · resumo em português para o usuário com o próximo passo.

## Fora de escopo
Outras loterias, pagamento online, apostas feitas dentro do app, notificações push, job automático de atualização.
