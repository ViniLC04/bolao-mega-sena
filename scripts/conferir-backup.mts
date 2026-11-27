// Confere um arquivo de backup baixado na tela Backup: formato, contagens e ligações entre tabelas.
// Uso:   node scripts/conferir-backup.mts "C:\caminho\backup-bolao-2026-12-01-1030.json"
// Só lê o arquivo (não usa rede nem chaves) e não imprime nomes de ninguém.
import { readFileSync } from 'node:fs'
import { conferirBackup } from '../src/app/backupConferir.ts'

const caminho = process.argv[2]
if (!caminho) {
  console.error('Informe o arquivo de backup. Exemplo: node scripts/conferir-backup.mts "C:\\Projetos\\bolao-mega-sena\\dados\\backup-bolao-2026-12-01-1030.json"')
  process.exit(1)
}

let backup: unknown
try {
  backup = JSON.parse(readFileSync(caminho, 'utf8').replace(/^﻿/, ''))
} catch (e) {
  console.error(`Não consegui ler o arquivo: ${(e as Error).message}`)
  process.exit(1)
}

const problemas = conferirBackup(backup)
if (problemas.length > 0) {
  console.error('BACKUP COM PROBLEMA:\n- ' + problemas.join('\n- '))
  process.exit(2)
}
const b = backup as { gerado_em: string; contagens: Record<string, number> }
console.log(`BACKUP OK (gerado em ${b.gerado_em})`)
for (const [tabela, n] of Object.entries(b.contagens)) console.log(`  ${tabela}: ${n} linha(s)`)
