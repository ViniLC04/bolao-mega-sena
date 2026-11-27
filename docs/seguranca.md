# Checklist de segurança do Bolão da Mega da Virada

Marque cada item antes de abrir o bolão para os participantes. Quem confere cada item está indicado (**eu** = conferido pelo código/testes; **você** = precisa de um clique seu).

## 1. Banco de dados (Supabase)
| # | Item | Como conferir | Situação |
|---|---|---|---|
| 1 | Todas as tabelas com RLS ligada e forçada; o público (anon) sem permissão em tabela nenhuma de pessoas, cotas, caixinha, bolões, jogos, auditoria, config | `$env:NODE_USE_SYSTEM_CA = '1'; node scripts/testar-rls.mts` deve terminar com "tudo passou" | **eu** (Fase 2 a 5) |
| 2 | O público só executa funções que devolvem totais e jogos de bolões congelados, sem nomes | mesmo teste (seção "responde sem nome") | **eu** |
| 3 | Cadastro público desligado (`disable_signup`) | lido da API de configuração do Supabase: `disable_signup: true` | **eu** (conferido em 27/11/2026) |
| 4 | Só existe 1 ADM (índice único) | `supabase/migrations/001_fase2.sql` | **eu** |
| 5 | Bolão congelado não muda (gatilho no banco) | `supabase/teste_congelar.sql` ("TUDO OK") | **eu** |
| 6 | Cotas nunca passam de N e depois da data limite não entram | `supabase/teste_cotas.sql` | **eu** (a data limite só vale com as regras gravadas no banco, ver item 12) |
| 7 | Concurso novo só o próximo da sequência, nunca sobrescreve, com limites por minuto | `supabase/teste_concursos.sql` | **eu** |

## 2. Login do organizador
| # | Item | Situação |
|---|---|---|
| 8 | Senha forte (mínimo 8, com maiúscula, minúscula, número e símbolo; o servidor também exige) | **você** (use uma senha longa e única) |
| 9 | **Verificação em 2 passos ligada** (tela Conta). Depois de ligada, o banco só aceita o ADM com o código | **você** |
| 10 | Limites de tentativas no painel do Supabase (passo a passo abaixo) | **você** |
| 11 | Celular com o aplicativo autenticador protegido por bloqueio de tela | **você** |

### Limites de tentativas (Supabase)
1. Abra o painel do Supabase → projeto → **Authentication** → **Rate Limits**.
2. Em "Rate limit for sign-ups and sign-ins", troque o número para **10** (a cada 5 minutos, por IP).
3. Salve.

### Se você perder o celular (2 passos)
1. Painel do Supabase → **Authentication** → **Users**.
2. Clique no seu usuário → procure a área **Multi-factor** (ou **Factors**) → remova o fator.
3. Entre de novo só com a senha e ligue a verificação em 2 passos com o celular novo.

## 3. Segredos e repositório
| # | Item | Como conferir | Situação |
|---|---|---|---|
| 12 | Regras gravadas no banco (data limite no servidor) | tela **Regras** não mostra o aviso "ainda não há regras gravadas" | **você** |
| 13 | Nenhum dado de participante, planilha com nomes nem chave secreta no Git | `npm run checar-segredos` ("OK") | **eu** |
| 14 | O pacote publicado não contém a chave secreta | `npm run build` e depois `npm run verificar` ("OK") | **eu** |
| 15 | Só a chave **pública** (publishable/anon) vai para o navegador; a chave **secreta** fica só no `.env.local` do seu computador | `.env.example` e `docs/pendencias.md` | **eu** |

## 4. Site publicado
| # | Item | Situação |
|---|---|---|
| 16 | Só HTTPS, com HSTS; sem abrir em moldura (`X-Frame-Options`); política de conteúdo (CSP) que só permite o próprio site, o Supabase, a Caixa e o resultadomega | **eu** (`public/_headers`, testado) |
| 17 | O service worker não guarda nada em cache (dados e login sempre da rede) | **eu** (`public/sw.js`) |

## 5. Rotina
- **Backup:** baixe o backup na tela **Backup** depois de cada mudança importante (cotas, pagamentos, congelamento) e guarde o arquivo em pasta **privada** (ele tem nomes). Nunca coloque no Git.
- **Projeto gratuito do Supabase pausa se ficar 1 semana sem uso:** abra o app pelo menos uma vez por semana; se pausar, reative no painel.

## 6. Se uma chave vazar
1. Painel do Supabase → **Project Settings** → **API Keys**.
2. Gere uma chave nova (a "secret" se foi ela que vazou) e apague a antiga.
3. Atualize o `.env.local` e publique de novo (`docs`/CLAUDE.md, seção Comandos).
4. Troque a senha do ADM (Authentication → Users) e refaça a verificação em 2 passos.
