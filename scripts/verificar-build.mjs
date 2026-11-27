// Confere o pacote publicado (pasta dist): nenhuma chave SECRETA do banco pode estar nele.
// Rode depois do build:  npm run build  e depois  npm run verificar
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

if (!existsSync('dist')) {
  console.error('ERRO: a pasta dist não existe. Rode "npm run build" antes.')
  process.exit(1)
}

// A chave secreta real (se o .env.local existir neste computador) nunca pode aparecer no pacote.
const segredos = []
if (existsSync('.env.local')) {
  for (const linha of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*(SUPABASE_SERVICE_ROLE_KEY|[A-Z_]*SECRET[A-Z_]*)\s*=\s*(.+?)\s*$/.exec(linha)
    if (m && m[2].length > 12) segredos.push({ nome: m[1], valor: m[2] })
  }
}

function* arquivos(pasta) {
  for (const f of readdirSync(pasta)) {
    const p = join(pasta, f)
    if (statSync(p).isDirectory()) yield* arquivos(p)
    else yield p
  }
}

// Uma chave JWT (3 partes) cujo conteúdo diz role=service_role é a chave secreta no formato antigo.
function ehJwtDeServico(trecho) {
  try {
    const corpo = JSON.parse(Buffer.from(trecho.split('.')[1], 'base64url').toString('utf8'))
    return corpo.role === 'service_role'
  } catch {
    return false
  }
}

const problemas = []
let total = 0
for (const arq of arquivos('dist')) {
  total++
  const texto = readFileSync(arq, 'latin1')
  for (const s of segredos) if (texto.includes(s.valor)) problemas.push(`${arq}: contém o valor de ${s.nome}`)
  for (const m of texto.matchAll(/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g)) {
    if (ehJwtDeServico(m[0])) problemas.push(`${arq}: contém uma chave service_role`)
  }
  // Chave no formato novo: o prefixo aparece no código do supabase-js (só para reconhecer chaves); o que não pode
  // aparecer é uma chave inteira (prefixo seguido de dezenas de caracteres).
  if (/sb_secret_[A-Za-z0-9_-]{20,}/.test(texto)) problemas.push(`${arq}: contém uma chave sb_secret_ inteira`)
}

if (problemas.length > 0) {
  console.error('ERRO: o pacote publicado tem segredo:\n- ' + problemas.join('\n- '))
  process.exit(1)
}
console.log(`OK: ${total} arquivos em dist, nenhuma chave secreta${segredos.length ? ' (conferido contra o .env.local)' : ''}.`)
