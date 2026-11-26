# Banco de dados (Supabase)

Os arquivos SQL são colados pelo **SQL Editor** do Supabase (projeto `bolao-mega-sena`), na ordem abaixo.

| Ordem | Arquivo | O que faz |
|---|---|---|
| 1 | `limpeza_fase0.sql` | Apaga a tabela e a função de teste da Fase 0 |
| 2 | `migrations/001_fase2.sql` | Cria as tabelas, a proteção (RLS), a função `congelar_bolao`, os gatilhos de auditoria e de imutabilidade. Pode rodar de novo sem estragar |
| 3 | (Authentication → Users) | Criar o usuário do ADM: e-mail `usuario@example.com`, senha forte, "Auto Confirm User" |
| 4 | `bootstrap_adm.sql` | Cadastra esse usuário como ADM (só pode existir um) |
| 5 | `teste_congelar.sql` | Testa congelar, recusas, imutabilidade e cruzamento **dentro do banco, sem deixar nada gravado**. O resultado aparece como "erro": `TUDO OK` é sucesso |
| — | `../scripts/testar-rls.mts` | Teste de segurança por chamada direta à API (público e usuário comum). Roda no computador, não no Supabase |

## Quem pode o quê
| Tabela | Público (sem login) | Usuário comum logado | ADM |
|---|---|---|---|
| `rules_versions`, `concursos`, `concurso_faixas` | só lê | só lê | lê e **insere** (nunca altera nem apaga) |
| `admins` | nada | nada | lê só a própria linha |
| `config`, `bolaos`, `recibos`, `jogos` | nada | nada | tudo (bolão congelado fica imutável) |
| `auditoria`, `combinacoes_cobertas` | nada | nada | só lê (quem grava são gatilhos e funções) |

Segurança em duas camadas: RLS com política "só ADM" **e** permissões de tabela retiradas de `anon` e `authenticated`. Tabelas futuras também nascem fechadas (`alter default privileges`).

## Desvios do modelo da seção 12 do SPEC (o SPEC permite refinar)
- `combinacoes_cobertas(concurso, combo_rank, bolao_id)`: guarda a **posição** (rank) da combinação de 6 dezenas, de 0 a 50.063.859, em vez de um hash. É um inteiro, único por concurso: o próprio banco impede combinação repetida entre bolões.
- `concursos` ganhou `acumulado_sena_cent` e `cidades` (a planilha traz esses dados). `bolaos` ganhou `regras_versao_id`, `regras_snapshot` e `semente` (para reproduzir o sorteio).
- As restrições de tamanho no banco são só **estruturais** (jogo de 6 a 60 dezenas distintas entre 1 e 60; `n_cotas`, `g` ≥ 1). Os limites **oficiais** (2 a 100 cotas, 6 a 20 dezenas, 10 jogos por recibo) ficam nas regras (`rules.json`), conferidos pelo motor, nunca fixos no SQL.
- `participantes`, `cotas`, `caixinha_mov` e `fontes_log` ficam para as Fases 3 e 4. `foto_path` já existe em `recibos` e pode ser alterado mesmo depois de congelado.

## Pontos de atenção
- O hash do conjunto de jogos e os `combo_rank` são calculados pelo app (motor em `src/engine/`); o banco confere formato, repetição e conflito, mas não recalcula a partir dos jogos. Como só o ADM escreve, o risco é de erro de programa, não de ataque. O teste da tela cobre isso.
- Congelar não tem "descongelar": é de propósito. Se for preciso desfazer, só pelo SQL Editor, de forma deliberada.
- `NODE_USE_SYSTEM_CA=1` é necessário para scripts locais por causa do proxy da empresa.
