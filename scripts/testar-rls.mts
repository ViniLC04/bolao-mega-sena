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
const PESSOA = 'RLS TESTE PESSOA SECRETA'
const OUTRA = 'RLS TESTE OUTRA PESSOA'
const TOKEN_A = randomBytes(32).toString('hex') // link pessoal de teste da PESSOA
const TOKEN_B = randomBytes(32).toString('hex') // link pessoal de teste da OUTRA
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
let baseFontesId: number | null = null
let bolaoIdTeste: string | null = null
let pessoaIdTeste: string | null = null
let outraIdTeste: string | null = null

async function main() {
  // Linha de base da auditoria, para apagar no fim SÓ o que o teste gerar. Se a leitura falhar, a limpeza da
  // auditoria é pulada (melhor sobrar uma linha de teste do que apagar registro de verdade).
  const rBase = await chamar(svc, 'GET', '/rest/v1/auditoria?select=id&order=id.desc&limit=1')
  const vBase = json(rBase)
  if (rBase.status === 200 && Array.isArray(vBase)) {
    baseAuditoriaId = vBase.length ? Number((vBase[0] as { id: number }).id) : 0
  }

  // Idem para o registro das atualizações de concursos (as tentativas recusadas do teste serão apagadas no fim).
  const rFonte = await chamar(svc, 'GET', '/rest/v1/fontes_log?select=id&order=id.desc&limit=1')
  const vFonte = json(rFonte)
  if (rFonte.status === 200 && Array.isArray(vFonte)) baseFontesId = vFonte.length ? Number((vFonte[0] as { id: number }).id) : 0

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
  bolaoIdTeste = bolaoId
  const recibo = await criar('recibos', { bolao_id: bolaoId, ordem: 1, k: 7, g: 1, total_cent: 4200, cotas_n: 2 })
  const reciboId = String(recibo.id)
  const jogo = await criar('jogos', { recibo_id: reciboId, ordem: 1, dezenas: [1, 2, 3, 4, 5, 6, 7] })
  const jogoId = String(jogo.id)
  await criar('combinacoes_cobertas', { concurso: CONCURSO, combo_rank: 1, bolao_id: bolaoId })
  const pessoa = await criar('participantes', { nome: PESSOA, contato: 'rls-teste@contato.secreto', link_token: TOKEN_A, link_ativo: true })
  const pessoaId = String(pessoa.id)
  pessoaIdTeste = pessoaId
  const outra = await criar('participantes', { nome: OUTRA, link_token: TOKEN_B, link_ativo: true })
  outraIdTeste = String(outra.id)
  await criar('cotas', { participante_id: outraIdTeste, bolao_id: bolaoId, qtd: 1, valor_devido_cent: 10_000 })
  const cota = await criar('cotas', { participante_id: pessoaId, bolao_id: bolaoId, qtd: 1, valor_devido_cent: 10_000 })
  const cotaId = String(cota.id)
  const mov = await criar('caixinha_mov', { bolao_id: bolaoId, valor_cent: 100, motivo: 'rls teste' })
  const movId = String(mov.id)
  await criar('fontes_log', { origem: 'rls-teste', resultado: 'rls-teste' })
  // Uma foto de teste no armazenamento privado (enviada com a chave secreta)
  const subida = await fetch(`${URL_BASE}/storage/v1/object/recibos/rls-teste/x.jpg`, { method: 'POST', headers: { ...svc, 'Content-Type': 'image/jpeg' }, body: Buffer.from('foto de teste') })
  if (subida.status >= 300) throw new Error(`Não consegui criar a foto de teste: HTTP ${subida.status} (o SQL da Fase 5 foi rodado?)`)

  const clientes: Cliente[] = [
    { nome: 'PÚBLICO (anon)', headers: cab(ANON, { Prefer: 'return=representation' }) },
    { nome: 'USUÁRIO COMUM logado', headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' } },
  ]

  const tabelasAdm = ['admins', 'config', 'auditoria', 'bolaos', 'recibos', 'jogos', 'combinacoes_cobertas', 'participantes', 'cotas', 'caixinha_mov', 'fontes_log']
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
    participantes: { insere: { nome: 'INVASOR' }, filtro: `id=eq.${pessoaId}`, altera: { nome: 'INVASOR' } },
    cotas: { insere: { participante_id: pessoaId, bolao_id: bolaoId, qtd: 1, valor_devido_cent: 1 }, filtro: `id=eq.${cotaId}`, altera: { pago: true } },
    fontes_log: { insere: { origem: 'invasor', resultado: 'invasor' }, filtro: 'origem=eq.rls-teste', altera: { resultado: 'invasor' } },
    caixinha_mov: { insere: { bolao_id: bolaoId, valor_cent: 1, motivo: 'invasor' }, filtro: `id=eq.${movId}`, altera: { motivo: 'invasor' } },
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
    // Visão pública: funciona, mas NUNCA traz nomes, contatos nem rascunhos
    for (const [fn, corpo] of [['publico_boloes', {}], ['publico_jogos', { p_bolao: bolaoId }]] as const) {
      const r = await chamar(c.headers, 'POST', `/rest/v1/rpc/${fn}`, corpo)
      ok(r.status === 200 && !r.texto.includes(PESSOA) && !r.texto.includes('contato.secreto') && !r.texto.includes(MARCADOR), `${fn}() responde sem nome, contato nem rascunho`, `HTTP ${r.status}`)
    }
    // Atualizar concursos: o visitante só consegue enviar o PRÓXIMO da sequência; o que já existe nunca é sobrescrito
    const reg = await chamar(c.headers, 'POST', '/rest/v1/rpc/registrar_concurso', {
      p_dados: { numero: 1, data: '2099-01-01', dezenas: [1, 2, 3, 4, 5, 6], faixas: [{ faixa: 4, ganhadores: 0, valor_cent: 0 }, { faixa: 5, ganhadores: 0, valor_cent: 0 }, { faixa: 6, ganhadores: 0, valor_cent: 0 }] },
    })
    const regJson = json(reg) as { ok?: boolean } | null
    ok(reg.status === 200 && regJson?.ok === false, 'registrar_concurso recusa um concurso que já existe', `HTTP ${reg.status} ${reg.texto.slice(0, 60)}`)
    for (const fn of ['confirmar_concurso', 'rejeitar_concurso']) {
      const r = await chamar(c.headers, 'POST', `/rest/v1/rpc/${fn}`, { p_numero: 1 })
      ok(r.status >= 400, `${fn}() é recusada`, `HTTP ${r.status}`)
    }
    const vir = await chamar(c.headers, 'POST', '/rest/v1/rpc/publico_viradas', {})
    ok(vir.status === 200, 'publico_viradas() responde', `HTTP ${vir.status}`)
    for (const fn of ['data_limite_vigente', 'cotas_validar']) {
      const r = await chamar(c.headers, 'POST', `/rest/v1/rpc/${fn}`, {})
      ok(r.status >= 400, `${fn}() não é chamável de fora`, `HTTP ${r.status}`)
    }
    // Link pessoal: o token certo mostra só a própria pessoa; token errado não mostra nada
    const meu = await chamar(c.headers, 'POST', '/rest/v1/rpc/publico_participante', { p_token: TOKEN_A })
    const meuJson = json(meu)
    ok(
      meu.status === 200 && Array.isArray(meuJson) && meuJson.length === 1 && meu.texto.includes(MARCADOR) && !meu.texto.includes(OUTRA) && !meu.texto.includes('contato.secreto') && !meu.texto.includes(TOKEN_B),
      'link pessoal: o token certo mostra só o bolão e as cotas da própria pessoa',
      `HTTP ${meu.status}`,
    )
    const errado = await chamar(c.headers, 'POST', '/rest/v1/rpc/publico_participante', { p_token: randomBytes(32).toString('hex') })
    ok(errado.status === 200 && errado.texto.trim() === '[]', 'link pessoal: token errado não devolve nada', `HTTP ${errado.status}`)
    const curto = await chamar(c.headers, 'POST', '/rest/v1/rpc/publico_participante', { p_token: 'a' })
    ok(curto.status === 200 && curto.texto.trim() === '[]', 'link pessoal: token curto não devolve nada', `HTTP ${curto.status}`)
    const jg = await chamar(c.headers, 'POST', '/rest/v1/rpc/publico_participante_jogos', { p_token: TOKEN_A, p_bolao: bolaoId })
    ok(jg.status === 200 && jg.texto.trim() === '[]', 'link pessoal: não mostra jogos de bolão em rascunho', `HTTP ${jg.status}`)

    // Fotos de recibo: o armazenamento é privado
    const baixar = await fetch(`${URL_BASE}/storage/v1/object/recibos/rls-teste/x.jpg`, { headers: c.headers })
    ok(baixar.status >= 400, 'fotos de recibo: não baixa', `HTTP ${baixar.status}`)
    const listar2 = await chamar(c.headers, 'POST', '/storage/v1/object/list/recibos', { prefix: 'rls-teste', limit: 10 })
    const listaJson = json(listar2)
    ok(listar2.status >= 400 || (Array.isArray(listaJson) && listaJson.length === 0), 'fotos de recibo: não lista', `HTTP ${listar2.status}`)
    const enviar = await fetch(`${URL_BASE}/storage/v1/object/recibos/rls-teste/y.jpg`, { method: 'POST', headers: { ...c.headers, 'Content-Type': 'image/jpeg' }, body: Buffer.from('invasor') })
    ok(enviar.status >= 400, 'fotos de recibo: não envia', `HTTP ${enviar.status}`)
    const assinar = await chamar(c.headers, 'POST', '/storage/v1/object/sign/recibos/rls-teste/x.jpg', { expiresIn: 60 })
    ok(assinar.status >= 400, 'fotos de recibo: não gera link temporário', `HTTP ${assinar.status}`)

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
  const pp = await listar('participantes', `id=eq.${pessoaId}`)
  ok(pp.length === 1 && pp[0].nome === PESSOA, 'o participante continua intacto')
  ok((await listar('participantes', 'nome=eq.INVASOR')).length === 0, 'nenhum participante invasor foi criado')
  const ct = await listar('cotas', `bolao_id=eq.${bolaoId}`)
  ok(ct.length === 2 && ct.every((x) => x.qtd === 1 && x.pago === false), 'as cotas continuam intactas')
  const fotoSvc = await fetch(`${URL_BASE}/storage/v1/object/recibos/rls-teste/x.jpg`, { headers: svc })
  ok(fotoSvc.status === 200, 'a foto de teste continua lá (só a chave secreta a lê)')
  const cx = await listar('caixinha_mov', `bolao_id=eq.${bolaoId}`)
  ok(cx.length === 1 && cx[0].motivo === 'rls teste', 'a caixinha continua intacta')
  ok((await listar('concursos', 'numero=eq.1')).every((x) => x.data === '1996-03-11'), 'o concurso 1 continua com a data original')
  ok((await listar('fontes_log', 'origem=eq.invasor')).length === 0, 'ninguém gravou no registro das fontes')
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
  // Só mexe no que o teste criou (por id do bolão e da pessoa de teste), nunca em dados reais.
  await del('fontes_log?origem=in.(rls-teste,invasor)')
  if (baseFontesId !== null) await del(`fontes_log?id=gt.${baseFontesId}&concurso=is.null&resultado=eq.recusado`)
  if (bolaoIdTeste) await del(`caixinha_mov?bolao_id=eq.${bolaoIdTeste}`)
  if (pessoaIdTeste) await del(`cotas?participante_id=eq.${pessoaIdTeste}`)
  if (outraIdTeste) await del(`cotas?participante_id=eq.${outraIdTeste}`)
  await del(`participantes?nome=in.(${encodeURIComponent(PESSOA)},${encodeURIComponent(OUTRA)},INVASOR)`)
  await chamar(svc, 'DELETE', '/storage/v1/object/recibos/rls-teste/x.jpg').catch(() => null)
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
