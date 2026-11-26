// Falha se algum arquivo proibido estiver no Git (repositório PÚBLICO).
import { execSync } from 'node:child_process'

const arquivos = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean)

const proibidos = arquivos.filter((f) => {
  const baixo = f.toLowerCase()
  const nome = baixo.split('/').pop() ?? ''
  if (nome === '.env.example') return false
  return (
    /\.(xlsx|xls|csv|pem|key)$/.test(baixo) ||
    nome === '.env' ||
    nome.startsWith('.env.') ||
    nome === '.dev.vars' ||
    baixo.startsWith('dados/')
  )
})

if (proibidos.length > 0) {
  console.error('ERRO: arquivos proibidos no Git (dados, planilhas ou segredos):')
  for (const f of proibidos) console.error('  - ' + f)
  process.exit(1)
}
console.log(`OK: ${arquivos.length} arquivos no Git, nenhum proibido.`)
