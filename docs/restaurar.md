# Como restaurar um backup

O backup (arquivo `.json` baixado na tela **Backup**) guarda participantes, cotas, caixinha, bolões, recibos, jogos, combinações cobertas, regras, configuração e auditoria. As **fotos dos recibos** ficam no armazenamento do Supabase e não vão no arquivo.

## Antes de tudo
1. **Não apague nada** e não rode nenhum SQL de "limpeza".
2. Confira o arquivo de backup:

```powershell
node scripts/conferir-backup.mts "C:\Projetos\bolao-mega-sena\dados\backup-bolao-AAAA-MM-DD-HHMM.json"
```

Deve aparecer "BACKUP OK" com as contagens de cada tabela. Se aparecer "BACKUP COM PROBLEMA", use outro arquivo (o mais recente que passe na conferência).

## Quando restaurar
Só em caso de perda de dados no banco (por exemplo, o projeto do Supabase foi apagado ou ficou corrompido). Para erros pequenos (uma cota lançada errada) use a própria tela do app.

## Passo a passo
1. Se o projeto do Supabase foi perdido, crie um novo, rode os SQLs `001_fase2.sql`, `002_fase3.sql`, `003_fase4.sql` e `004_fase5.sql` (pasta `supabase/migrations`, nessa ordem), cadastre o ADM (`supabase/bootstrap_adm.sql`), atualize as chaves no `.env.local` e importe a planilha dos concursos na tela **Concursos**.
2. Abra o Claude Code neste projeto e diga: "restaurar o backup" informando o caminho do arquivo. Ele vai conferir o arquivo, mostrar o que está faltando no banco e inserir só o que falta, na ordem certa (participantes, bolões, recibos, jogos, cotas, caixinha, combinações cobertas), usando a chave secreta do seu `.env.local`. Peça para mostrar o resultado antes de gravar.
3. Depois, confira no app: número de bolões, de participantes e o total arrecadado, e baixe um backup novo.

## Observações
- Bolões **congelados** têm um hash (SHA-256) dos jogos. Depois de restaurar, o hash tem de continuar igual ao do backup. Não recalcule nem altere.
- As fotos dos recibos, se foram perdidas, precisam ser anexadas de novo (tire outra foto do recibo da Caixa).
- A restauração automática ainda **não foi testada com um banco vazio** de verdade; por isso o passo 2 é feito junto com o assistente, com conferência a cada etapa.
