// TESTE 3 da Fase 0: chama a API do Supabase DIRETAMENTE (como um atacante faria) e confere:
//  - o público (chave anon) NÃO consegue ler nomes, nem inserir, nem apagar;
//  - o público consegue chamar a função de totais;
//  - a política de senha recusa senhas fracas (usa a chave service_role, só local).
// Uso:  $env:NODE_USE_SYSTEM_CA='1'; node spikes/supabase/rls.mts
// Lê as chaves de .env.local (que NUNCA vai para o Git). Não imprime nenhuma chave.
import { readFileSync } from 'node:fs'

function lerEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const linha of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(linha)
    if (m && !linha.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const env = lerEnv()
const URL_BASE = (env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const ANON = env.VITE_SUPABASE_ANON_KEY ?? ''
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!URL_BASE || !ANON) {
  console.error('Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY em .env.local')
  process.exit(1)
}

const NOMES = ['Fulano de Teste', 'Beltrana de Teste', 'Ciclano de Teste']
let falhas = 0
const ok = (cond: boolean, texto: string, extra = '') => {
  if (!cond) falhas++
  console.log(`${cond ? 'PASSOU ' : 'FALHOU '} ${texto}${extra ? ' — ' + extra : ''}`)
}
// Chaves novas do Supabase ("sb_publishable_..." / "sb_secret_...") não são JWT: vão só no cabeçalho apikey.
// Chaves antigas (anon / service_role) são JWT e vão nos dois cabeçalhos.
const cab = (chave: string, extra: Record<string, string> = {}) => ({
  apikey: chave,
  ...(chave.startsWith('sb_') ? {} : { Authorization: `Bearer ${chave}` }),
  'Content-Type': 'application/json',
  ...extra,
})
const vazaNome = (corpo: string) => NOMES.some((n) => corpo.includes(n))

async function main() {
  console.log('--- Como PÚBLICO (chave anon) ---')

  let r = await fetch(`${URL_BASE}/rest/v1/participantes_teste?select=nome`, { headers: cab(ANON) })
  let t = await r.text()
  ok(!vazaNome(t), 'SELECT nome (público) não devolve nomes', `HTTP ${r.status}`)

  r = await fetch(`${URL_BASE}/rest/v1/participantes_teste?select=*`, { headers: cab(ANON) })
  t = await r.text()
  ok(!vazaNome(t), 'SELECT * (público) não devolve nomes', `HTTP ${r.status}`)

  r = await fetch(`${URL_BASE}/rest/v1/participantes_teste?select=nome&nome=ilike.*Fulano*`, { headers: cab(ANON) })
  t = await r.text()
  ok(!vazaNome(t), 'busca por nome (filtro) não vaza', `HTTP ${r.status}`)

  r = await fetch(`${URL_BASE}/rest/v1/participantes_teste`, {
    method: 'POST', headers: cab(ANON, { Prefer: 'return=representation' }),
    body: JSON.stringify({ nome: 'Invasor', cotas: 99, pago: true }),
  })
  ok(r.status >= 400, 'INSERT (público) é recusado', `HTTP ${r.status}`)

  r = await fetch(`${URL_BASE}/rest/v1/participantes_teste?id=gt.0`, { method: 'DELETE', headers: cab(ANON, { Prefer: 'return=representation' }) })
  t = await r.text()
  ok(r.status >= 400 || t === '[]', 'DELETE (público) não apaga nada', `HTTP ${r.status}`)

  r = await fetch(`${URL_BASE}/rest/v1/participantes_teste?id=gt.0`, {
    method: 'PATCH', headers: cab(ANON, { Prefer: 'return=representation' }), body: JSON.stringify({ pago: true }),
  })
  t = await r.text()
  ok(r.status >= 400 || t === '[]', 'UPDATE (público) não altera nada', `HTTP ${r.status}`)

  r = await fetch(`${URL_BASE}/rest/v1/rpc/resumo_publico_teste`, { method: 'POST', headers: cab(ANON), body: '{}' })
  t = await r.text()
  ok(r.status === 200 && !vazaNome(t) && t.includes('total_cotas'), 'função de totais funciona e não tem nomes', t.slice(0, 120))

  // O esquema aberto da API não deve listar a tabela com dados ao público
  r = await fetch(`${URL_BASE}/rest/v1/`, { headers: cab(ANON) })
  console.log(`INFO    GET /rest/v1/ (público): HTTP ${r.status}`)

  console.log('--- Política de senha (Auth) ---')
  if (!SERVICE) {
    console.log('PULADO  SUPABASE_SERVICE_ROLE_KEY não está em .env.local')
  } else {
    const fracas = ['abc', '12345678', 'abcdefgh', 'Abcdefgh', 'Abcdefg1']
    for (const senha of fracas) {
      r = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
        method: 'POST', headers: cab(SERVICE),
        body: JSON.stringify({ email: `teste-fraca-${Date.now()}@example.com`, password: senha, email_confirm: true }),
      })
      t = await r.text()
      const recusou = r.status >= 400
      ok(recusou, `senha fraca "${senha.replace(/./g, '*')}" (${senha.length} car.) é recusada`, `HTTP ${r.status}`)
      if (!recusou) { // limpeza se criou por engano
        const id = JSON.parse(t).id
        if (id) await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: cab(SERVICE) })
      }
    }
    const email = `teste-forte-${Date.now()}@example.com`
    r = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
      method: 'POST', headers: cab(SERVICE),
      body: JSON.stringify({ email, password: 'Abcdef1!xyz', email_confirm: true }),
    })
    t = await r.text()
    ok(r.status === 200, 'senha forte (maiúscula, minúscula, número, símbolo) é aceita', `HTTP ${r.status}`)
    if (r.status === 200) {
      const id = JSON.parse(t).id
      await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: cab(SERVICE) })
      console.log('INFO    usuário de teste apagado')
    }

    // Cadastro público deve estar desligado
    r = await fetch(`${URL_BASE}/auth/v1/signup`, {
      method: 'POST', headers: cab(ANON),
      body: JSON.stringify({ email: `teste-publico-${Date.now()}@example.com`, password: 'Abcdef1!xyz' }),
    })
    ok(r.status >= 400, 'cadastro público (signup) está DESLIGADO', `HTTP ${r.status}`)
  }

  console.log(falhas === 0 ? '\nRESULTADO: tudo passou.' : `\nRESULTADO: ${falhas} verificação(ões) FALHARAM.`)
  process.exit(falhas === 0 ? 0 : 2)
}

main().catch((e) => { console.error('ERRO:', String(e)); process.exit(1) })
