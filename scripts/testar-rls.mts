// TESTE DE SEGURANÇA do banco (Fase 2): chama a API do Supabase DIRETAMENTE, como um atacante faria, e
// confere que o público e um usuário comum (sem ser o ADM) não leem nem escrevem nada do ADM.
//
// Uso:   $env:NODE_USE_SYSTEM_CA = '1'; node scripts/testar-rls.mts
// Lê as chaves de .env.local (que NUNCA vai para o Git) e NÃO imprime nenhuma chave.
// Cria dados fictícios no concurso 999999 e um usuário comum temporários, e apaga tudo no fim.
import { randomBytes } from 'node:crypto'
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
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!URL_BASE || !ANON || !SECRET) {
  console.error('Faltam VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e/ou SUPABASE_SERVICE_ROLE_KEY em .env.local')
  process.exit(1)
}

// Chaves novas (sb_publishable_/sb_secret_) não são JWT: vão só no cabeçalho apikey.
const cab = (chave: string, extra: Record<string, string> = {}): Record<string, string> => ({
  apikey: chave,
  ...(chave.startsWith('sb_') ? {} : { Authorization: `Bearer ${chave}` }),
  'Content-Type': 'application/json',
  ...extra,
})

interface Resp { status: number; texto: string }
async function chamar(headers: Record<string, string>, metodo: string, caminho: string, corpo?: unknown): Promise<Resp> {
  const r = await fetch(`${URL_BASE}${caminho}`, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  return { status: r.status, texto: await r.text() }
}
const json = (r: Resp): unknown => {
  try { return JSON.parse(r.texto) } catch { return null }
}

let falhas = 0
let total = 0
const ok = (cond: boolean, texto: string, extra = '') => {
  total++
  if (!cond) falhas++
  console.log(`${cond ? 'PASSOU ' : 'FALHOU '} ${texto}${extra ? ' — ' + extra : ''}`)
}

const MARCADOR = 'RLS TESTE'
const CONCURSO = 999_999
const svc = cab(SECRET)
const SVC_REP = cab(SECRET, { Prefer: 'return=representation' })

// ---------- ações com a chave secreta (ignora RLS) ----------
async function criar(tabela: string, corpo: unknown): Promise<Record<string, unknown>> {
  const r = await chamar(SVC_REP, 'POST', `/rest/v1/${tabela}`, corpo)
  const v = json(r)
  if (r.status >= 300 || !Array.isArray(v) || v.length === 0) throw new Error(`Não consegui criar dado de teste em ${tabela}: HTTP ${r.status} ${r.texto.slice(0, 200)}`)
  return v[0] as Record<string, unknown>
}
const listar = async (tabela: string, filtro: string): Promise<Record<string, unknown>[]> => {
  const r = await chamar(svc, 'GET', `/rest/v1/${tabela}?select=*&${filtro}`)
  const v = json(r)
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : []
}

interface Cliente { nome: string; headers: Record<string, string> }

// Guardados já no começo para a limpeza do fim funcionar mesmo se a preparação falhar no meio.
let baseAuditoriaId: number | null = null
let usuarioComumId: string | null = null

async function main() {
  // Linha de base da auditoria, para apagar no fim SÓ o que o teste gerar. Se a leitura falhar, a limpeza da
  // auditoria é pulada (melhor sobrar uma linha de teste do que apagar registro de verdade).
  const rBase = await chamar(svc, 'GET', '/rest/v1/auditoria?select=id&order=id.desc&limit=1')
  const vBase = json(rBase)
  if (rBase.status === 200 && Array.isArray(vBase)) {
    baseAuditoriaId = vBase.length ? Number((vBase[0] as { id: number }).id) : 0
  }

  // Usuário comum (NÃO é ADM) para provar que "estar logado" não basta.
  const email = `rls-teste-${Date.now()}@example.com`
  const senha = `Aa1!${randomBytes(9).toString('base64url')}`
  const rUser = await chamar(svc, 'POST', '/auth/v1/admin/users', { email, password: senha, email_confirm: true })
  const comumId = (json(rUser) as { id?: string } | null)?.id
  if (!comumId) throw new Error(`Não consegui criar o usuário comum de teste: HTTP ${rUser.status}`)
  usuarioComumId = comumId
  const rLogin = await chamar({ apikey: ANON, 'Content-Type': 'application/json' }, 'POST', '/auth/v1/token?grant_type=password', { email, password: senha })
  const token = (json(rLogin) as { access_token?: string } | null)?.access_token
  if (!token) throw new Error(`O usuário comum de teste não conseguiu entrar: HTTP ${rLogin.status}`)

  // Dados fictícios (concurso 999999), criados com a chave secreta.
  await criar('concursos', { numero: CONCURSO, data: '2099-01-01', dezenas: [1, 2, 3, 4, 5, 6], fonte: 'rls-teste', status: 'confirmado' })
  await criar('concurso_faixas', { concurso: CONCURSO, faixa: 6, ganhadores: 0, valor_cent: 0 })
  await criar('config', { chave: 'rls_teste', valor: { x: 1 } })
  await criar('rules_versions', { vigencia_inicio: '2098-01-01', json: { teste: true } })
  const bolao = await criar('bolaos', { concurso_alvo: CONCURSO, nome: MARCADOR, n_cotas: 2 })
  const bolaoId = String(bolao.id)
  const recibo = await criar('recibos', { bolao_id: bolaoId, ordem: 1, k: 7, g: 1, total_cent: 4200, cotas_n: 2 })
  const reciboId = String(recibo.id)
  const jogo = await criar('jogos', { recibo_id: reciboId, ordem: 1, dezenas: [1, 2, 3, 4, 5, 6, 7] })
  const jogoId = String(jogo.id)
  await criar('combinacoes_cobertas', { concurso: CONCURSO, combo_rank: 1, bolao_id: bolaoId })

  const clientes: Cliente[] = [
    { nome: 'PÚBLICO (anon)', headers: cab(ANON, { Prefer: 'return=representation' }) },
    { nome: 'USUÁRIO COMUM logado', headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' } },
  ]

  const tabelasAdm = ['admins', 'config', 'auditoria', 'bolaos', 'recibos', 'jogos', 'combinacoes_cobertas']
  const tabelasPublicas = ['rules_versions', 'concursos', 'concurso_faixas']

  // Para cada tabela: um INSERT que seria VÁLIDO, uma alteração e uma exclusão de linha que existe.
  const escritas: Record<string, { insere: unknown; filtro: string; altera: unknown }> = {
    admins: { insere: { user_id: comumId }, filtro: `user_id=eq.${comumId}`, altera: { criado_em: '2000-01-01T00:00:00Z' } },
    config: { insere: { chave: 'rls_invasor', valor: 1 }, filtro: 'chave=eq.rls_teste', altera: { valor: { x: 999 } } },
    auditoria: { insere: { acao: 'invasor' }, filtro: 'id=gt.0', altera: { acao: 'invasor' } },
    bolaos: { insere: { concurso_alvo: CONCURSO, nome: 'INVASOR', n_cotas: 2 }, filtro: `id=eq.${bolaoId}`, altera: { nome: 'INVASOR' } },
    recibos: { insere: { bolao_id: bolaoId, ordem: 9, k: 7, g: 1, total_cent: 4200, cotas_n: 2 }, filtro: `id=eq.${reciboId}`, altera: { g: 5 } },
    jogos: { insere: { recibo_id: reciboId, ordem: 9, dezenas: [1, 2, 3, 4, 5, 6, 7] }, filtro: `id=eq.${jogoId}`, altera: { travado: true } },
    combinacoes_cobertas: { insere: { concurso: CONCURSO, combo_rank: 2, bolao_id: bolaoId }, filtro: `concurso=eq.${CONCURSO}`, altera: { combo_rank: 3 } },
    rules_versions: { insere: { vigencia_inicio: '2099-01-01', json: {} }, filtro: 'vigencia_inicio=eq.2098-01-01', altera: { json: { x: 1 } } },
    concursos: { insere: { numero: 999_998, data: '2099-01-01', dezenas: [1, 2, 3, 4, 5, 6], fonte: 'invasor', status: 'confirmado' }, filtro: `numero=eq.${CONCURSO}`, altera: { fonte: 'invasor' } },
    concurso_faixas: { insere: { concurso: CONCURSO, faixa: 4, ganhadores: 0, valor_cent: 0 }, filtro: `concurso=eq.${CONCURSO}`, altera: { ganhadores: 9 } },
  }

  const semDado = (r: Resp): boolean => {
    if (r.status >= 400) return true
    const v = json(r)
    return r.status === 200 && Array.isArray(v) && v.length === 0
  }
  const nada = (r: Resp): boolean => r.status >= 400 || (r.status < 300 && (r.texto.trim() === '' || r.texto.trim() === '[]'))

  for (const c of clientes) {
    console.log(`\n--- ${c.nome} ---`)

    // LEITURA: nada do ADM aparece
    for (const t of tabelasAdm) {
      const r = await chamar(c.headers, 'GET', `/rest/v1/${t}?select=*`)
      ok(semDado(r) && !r.texto.includes(MARCADOR), `não lê ${t}`, `HTTP ${r.status}`)
    }

    // LEITURA: o que é público por desenho aparece
    for (const [t, filtro] of [['concursos', `numero=eq.${CONCURSO}`], ['concurso_faixas', `concurso=eq.${CONCURSO}`], ['rules_versions', 'vigencia_inicio=eq.2098-01-01']] as const) {
      const r = await chamar(c.headers, 'GET', `/rest/v1/${t}?select=*&${filtro}`)
      const v = json(r)
      ok(r.status === 200 && Array.isArray(v) && v.length === 1, `lê ${t} (público por desenho)`, `HTTP ${r.status}`)
    }

    // ESCRITA: nada entra, nada muda, nada some
    for (const t of [...tabelasAdm, ...tabelasPublicas]) {
      const e = escritas[t]
      const ins = await chamar(c.headers, 'POST', `/rest/v1/${t}`, e.insere)
      ok(ins.status >= 400, `INSERT em ${t} é recusado`, `HTTP ${ins.status}`)
      const alt = await chamar(c.headers, 'PATCH', `/rest/v1/${t}?${e.filtro}`, e.altera)
      ok(nada(alt), `UPDATE em ${t} não altera nada`, `HTTP ${alt.status}`)
      const del = await chamar(c.headers, 'DELETE', `/rest/v1/${t}?${e.filtro}`)
      ok(nada(del), `DELETE em ${t} não apaga nada`, `HTTP ${del.status}`)
    }

    // FUNÇÕES
    const cong = await chamar(c.headers, 'POST', '/rest/v1/rpc/congelar_bolao', { p_bolao: bolaoId, p_hash: 'a'.repeat(64), p_ranks: [5, 6] })
    ok(cong.status >= 400, 'congelar_bolao é recusada', `HTTP ${cong.status}`)
    const adm = await chamar(c.headers, 'POST', '/rest/v1/rpc/is_adm', {})
    ok(adm.status === 200 && adm.texto.trim() === 'false', 'is_adm() responde false', `HTTP ${adm.status} ${adm.texto.slice(0, 20)}`)
  }

  // CONFERÊNCIA FINAL com a chave secreta: nada foi alterado, criado ou apagado pelos ataques.
  console.log('\n--- Conferência final (nada mudou) ---')
  const b = await listar('bolaos', `id=eq.${bolaoId}`)
  ok(b.length === 1 && b[0].nome === MARCADOR && b[0].status === 'rascunho', 'o bolão continua intacto e em rascunho')
  ok((await listar('bolaos', 'nome=eq.INVASOR')).length === 0, 'nenhum bolão invasor foi criado')
  const rc = await listar('recibos', `id=eq.${reciboId}`)
  ok(rc.length === 1 && rc[0].g === 1, 'o recibo continua intacto')
  const jg = await listar('jogos', `id=eq.${jogoId}`)
  ok(jg.length === 1 && jg[0].travado === false, 'o jogo continua intacto')
  const cobertas = await listar('combinacoes_cobertas', `concurso=eq.${CONCURSO}`)
  ok(cobertas.length === 1 && cobertas[0].combo_rank === 1, 'as combinações cobertas continuam intactas')
  const cf = await listar('config', 'chave=like.rls_*')
  ok(cf.length === 1 && cf[0].chave === 'rls_teste' && (cf[0].valor as { x?: number }).x === 1, 'a configuração continua intacta e sem invasora')
  const rv = await listar('rules_versions', 'vigencia_inicio=in.(2098-01-01,2099-01-01)')
  ok(rv.length === 1 && (rv[0].json as { teste?: boolean }).teste === true, 'as regras continuam intactas e sem versão invasora')
  const cs = await listar('concursos', `numero=in.(${CONCURSO},999998)`)
  ok(cs.length === 1 && cs[0].fonte === 'rls-teste', 'os concursos continuam intactos e sem invasor')
  const fx = await listar('concurso_faixas', `concurso=eq.${CONCURSO}`)
  ok(fx.length === 1 && fx[0].ganhadores === 0, 'as faixas continuam intactas e sem invasora')
  const ad = await listar('admins', `user_id=eq.${comumId}`)
  ok(ad.length === 0, 'o usuário comum NÃO virou ADM')
  const au = await listar('auditoria', 'acao=in.(invasor)')
  ok(au.length === 0, 'ninguém gravou na auditoria')
}

// ---------- execução com limpeza garantida ----------
let erro: unknown = null
try {
  await main()
} catch (e) {
  erro = e
} finally {
  // Limpa tudo, mesmo se algo acima falhou (a chave secreta ignora RLS, mas gatilhos continuam valendo).
  const del = (caminho: string) => chamar(svc, 'DELETE', `/rest/v1/${caminho}`).catch(() => null)
  await del(`combinacoes_cobertas?concurso=eq.${CONCURSO}`)
  await del(`bolaos?concurso_alvo=eq.${CONCURSO}`) // recibos e jogos saem por cascata
  await del('concursos?numero=in.(999999,999998)') // faixas saem por cascata
  await del('config?chave=in.(rls_teste,rls_invasor)')
  await del('rules_versions?vigencia_inicio=in.(2098-01-01,2099-01-01)')
  if (baseAuditoriaId !== null) await del(`auditoria?id=gt.${baseAuditoriaId}&usuario=is.null`)
  if (usuarioComumId) await chamar(svc, 'DELETE', `/auth/v1/admin/users/${usuarioComumId}`).catch(() => null)
}

if (erro) {
  console.error('\nERRO NO TESTE:', String((erro as Error).message ?? erro))
  process.exit(1)
}
console.log(falhas === 0 ? `\nRESULTADO: tudo passou (${total} verificações). Dados de teste apagados.` : `\nRESULTADO: ${falhas} de ${total} verificações FALHARAM. Dados de teste apagados.`)
process.exit(falhas === 0 ? 0 : 2)
