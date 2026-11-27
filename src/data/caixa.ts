// Atualizar a lista de concursos direto da Caixa, pelo NAVEGADOR de quem aperta o botão (SPEC 9.2).
// A Caixa bloqueia IPs de servidor fora do Brasil; por isso a consulta sai do navegador e o servidor (Supabase)
// só valida e grava. Consulta POR NÚMERO (último no banco + 1, +2…); concurso que ainda não existe responde HTTP 500.
import { supabase } from './supabase'

const URL_CAIXA = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena/'
const URL_RESULTADOMEGA_TODOS = 'https://resultadomega.com.br/api/concursos.json'
const URL_RESULTADOMEGA_ULTIMO = 'https://resultadomega.com.br/api/ultimo.json'
const MAX_POR_VEZ = 50

export interface FaixaPayload {
  faixa: 4 | 5 | 6
  ganhadores: number
  valor_cent: number
}

/** O que o servidor espera em `registrar_concurso` (ver supabase/migrations/003_fase4.sql). */
export interface PayloadConcurso {
  numero: number
  data: string
  dezenas: number[]
  ordem_sorteio: number[] | null
  arrecadacao_cent: number
  estimativa_prox_cent: number | null
  acumulado_virada_cent: number | null
  acumulado_prox_cent: number | null
  acumulado_sena_cent: number | null
  cidades: string | null
  observacao: string | null
  faixas: FaixaPayload[]
}

/** Valores da Caixa vêm como número com 2 casas (ex.: 24857.75). Converte para centavos inteiros, sem acumular erro. */
export function paraCentavos(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null
  return Math.round(v * 100)
}

function dataBrParaIso(t: unknown): string | null {
  const m = typeof t === 'string' ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t) : null
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

function dezenasDe(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length !== 6) return null
  const n = v.map((x) => Number(x))
  return n.every((x) => Number.isInteger(x) && x >= 1 && x <= 60) && new Set(n).size === 6 ? n : null
}

/** JSON da Caixa → payload. Devolve null se algo essencial faltar ou for inválido (nada é "consertado" em silêncio). */
export function converterCaixa(j: unknown): PayloadConcurso | null {
  if (typeof j !== 'object' || j === null) return null
  const o = j as Record<string, unknown>
  const numero = o.numero
  const data = dataBrParaIso(o.dataApuracao)
  const dezenas = dezenasDe(o.listaDezenas)
  if (typeof numero !== 'number' || !Number.isInteger(numero) || !data || !dezenas) return null
  const arrecadacao = paraCentavos(o.valorArrecadado)
  if (arrecadacao === null) return null

  const rateio = Array.isArray(o.listaRateioPremio) ? (o.listaRateioPremio as Record<string, unknown>[]) : []
  const faixas: FaixaPayload[] = []
  for (const [faixaCaixa, faixa] of [[1, 6], [2, 5], [3, 4]] as const) {
    const f = rateio.find((r) => r.faixa === faixaCaixa)
    const ganhadores = f?.numeroDeGanhadores
    const valor = paraCentavos(f?.valorPremio)
    if (typeof ganhadores !== 'number' || !Number.isInteger(ganhadores) || ganhadores < 0 || valor === null) return null
    faixas.push({ faixa, ganhadores, valor_cent: valor })
  }

  const ordem = dezenasDe(o.dezenasSorteadasOrdemSorteio)
  const cidades = Array.isArray(o.listaMunicipioUFGanhadores)
    ? (o.listaMunicipioUFGanhadores as Record<string, unknown>[])
        .map((c) => [c.municipio, c.uf].filter((x) => typeof x === 'string' && x).join('/'))
        .filter(Boolean)
        .join(', ')
    : ''
  return {
    numero,
    data,
    dezenas: [...dezenas].sort((a, b) => a - b),
    ordem_sorteio: ordem,
    arrecadacao_cent: arrecadacao,
    estimativa_prox_cent: paraCentavos(o.valorEstimadoProximoConcurso),
    acumulado_virada_cent: paraCentavos(o.valorAcumuladoConcursoEspecial),
    acumulado_prox_cent: paraCentavos(o.valorAcumuladoProximoConcurso),
    acumulado_sena_cent: null,
    cidades: cidades || null,
    observacao: typeof o.observacao === 'string' && o.observacao.trim() ? o.observacao.trim() : null,
    faixas,
  }
}

export interface SegundaFonte {
  /** número → data e dezenas (de concursos.json) */
  sorteios: Map<number, { data: string; dezenas: number[] }>
  /** rateio do último concurso (de ultimo.json), se disponível */
  ultimo: { numero: number; faixas: Map<number, { ganhadores: number; valor_cent: number }> } | null
}

/** Confere o concurso lido da Caixa com a 2ª fonte: data e dezenas sempre; rateio quando a 2ª fonte o tiver. */
export function confereComSegundaFonte(p: PayloadConcurso, seg: SegundaFonte | null): boolean {
  if (!seg) return false
  const s = seg.sorteios.get(p.numero)
  if (!s || s.data !== p.data) return false
  if ([...s.dezenas].sort((a, b) => a - b).join('-') !== p.dezenas.join('-')) return false
  if (seg.ultimo && seg.ultimo.numero === p.numero) {
    for (const f of p.faixas) {
      const o = seg.ultimo.faixas.get(f.faixa)
      if (!o || o.ganhadores !== f.ganhadores || o.valor_cent !== f.valor_cent) return false
    }
  }
  return true
}

async function pegarJson(url: string, ms = 20_000): Promise<{ status: number; json: unknown } | null> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctl.signal })
    let json: unknown = null
    try {
      json = await r.json()
    } catch {
      /* corpo vazio ou não-JSON: fica null */
    }
    return { status: r.status, json }
  } catch {
    return null // sem resposta: rede, CORS ou bloqueio
  } finally {
    clearTimeout(t)
  }
}

async function carregarSegundaFonte(): Promise<SegundaFonte | null> {
  const todos = await pegarJson(URL_RESULTADOMEGA_TODOS, 30_000)
  if (!todos || todos.status !== 200 || !Array.isArray(todos.json)) return null
  const sorteios = new Map<number, { data: string; dezenas: number[] }>()
  for (const l of todos.json as unknown[]) {
    if (Array.isArray(l) && typeof l[0] === 'number' && typeof l[1] === 'string' && Array.isArray(l[2])) {
      sorteios.set(l[0], { data: l[1], dezenas: (l[2] as unknown[]).map(Number) })
    }
  }
  let ultimo: SegundaFonte['ultimo'] = null
  const u = await pegarJson(URL_RESULTADOMEGA_ULTIMO)
  const uj = u?.json as { concurso?: unknown; premios?: Record<string, { ganhadores?: unknown; rateio?: unknown }> } | null | undefined
  if (uj && typeof uj.concurso === 'number' && uj.premios) {
    const faixas = new Map<number, { ganhadores: number; valor_cent: number }>()
    for (const f of [4, 5, 6]) {
      const p = uj.premios[String(f)]
      const v = paraCentavos(p?.rateio)
      if (p && typeof p.ganhadores === 'number' && v !== null) faixas.set(f, { ganhadores: p.ganhadores, valor_cent: v })
    }
    ultimo = { numero: uj.concurso, faixas }
  }
  return { sorteios, ultimo }
}

export interface ResultadoAtualizacao {
  /** concursos gravados nesta rodada */
  gravados: { numero: number; status: string }[]
  /** o que aconteceu, em português */
  mensagem: string
  tipo: 'ok' | 'sem_novidade' | 'bloqueada' | 'erro'
}

/**
 * Busca na Caixa os concursos depois de `ultimoNumero` e envia ao servidor, um a um, até a Caixa dizer que o
 * próximo ainda não existe. `souAdm`: quando o ADM aperta e a 2ª fonte confere, o concurso já entra "confirmado".
 */
export async function atualizarConcursos(ultimoNumero: number, souAdm: boolean, aoAndar: (texto: string) => void): Promise<ResultadoAtualizacao> {
  const gravados: { numero: number; status: string }[] = []
  let segunda: SegundaFonte | null | undefined
  const origem = souAdm ? 'Caixa (navegador do ADM)' : 'Caixa (navegador de visitante)'

  for (let n = ultimoNumero + 1; n <= ultimoNumero + MAX_POR_VEZ; n++) {
    aoAndar(`Consultando o concurso ${n} na Caixa…`)
    const r = await pegarJson(URL_CAIXA + n)
    if (!r) {
      return {
        gravados,
        tipo: 'bloqueada',
        mensagem: gravados.length
          ? `Gravei ${gravados.length} concurso(s), mas depois a Caixa parou de responder ao seu navegador.`
          : 'A Caixa não respondeu ao seu navegador (ela pode bloquear acessos de fora do Brasil ou a internet pode ter falhado). Tente de novo mais tarde, ou peça ao organizador para importar a planilha oficial.',
      }
    }
    if (r.status === 500 || r.status === 404) break // esse concurso ainda não existe: acabou a lista
    if (r.status !== 200) return { gravados, tipo: 'erro', mensagem: `A Caixa respondeu com erro (${r.status}). Tente de novo mais tarde.` }

    const p = converterCaixa(r.json)
    if (!p || p.numero !== n) return { gravados, tipo: 'erro', mensagem: `A resposta da Caixa para o concurso ${n} veio incompleta; não gravei.` }

    if (segunda === undefined) {
      aoAndar('Conferindo com a segunda fonte…')
      segunda = await carregarSegundaFonte()
    }
    const bate = confereComSegundaFonte(p, segunda)
    const { data, error } = await supabase.rpc('registrar_concurso', { p_dados: p, p_origem: origem, p_segunda_fonte_ok: bate })
    if (error) return { gravados, tipo: 'erro', mensagem: 'O servidor não conseguiu gravar agora. Tente de novo.' }
    const res = data as { ok?: boolean; erro?: string; status?: string } | null
    if (!res?.ok) return { gravados, tipo: 'erro', mensagem: res?.erro ?? 'O servidor recusou o concurso.' }
    gravados.push({ numero: n, status: res.status ?? 'aguardando' })
  }

  if (gravados.length === 0) return { gravados, tipo: 'sem_novidade', mensagem: 'A lista já está em dia: não há concurso novo na Caixa.' }
  const confirmados = gravados.filter((g) => g.status === 'confirmado').length
  return {
    gravados,
    tipo: 'ok',
    mensagem:
      `Pronto: ${gravados.length} concurso(s) novo(s) gravado(s) (${gravados[0].numero} a ${gravados[gravados.length - 1].numero}).` +
      (confirmados === gravados.length ? ' Todos já confirmados pela 2ª fonte.' : ' Eles ficam "aguardando confirmação" até o organizador confirmar.'),
  }
}

/** Número do último concurso no banco (0 se o banco estiver vazio). */
export async function ultimoConcursoNoBanco(): Promise<number | null> {
  const { data, error } = await supabase.from('concursos').select('numero').order('numero', { ascending: false }).limit(1)
  if (error) return null
  return data && data.length > 0 ? (data[0] as { numero: number }).numero : 0
}

export async function confirmarConcurso(numero: number): Promise<string | null> {
  const { error } = await supabase.rpc('confirmar_concurso', { p_numero: numero })
  return error ? error.message.replace(/^.*?ERROR:\s*/, '') : null
}

export async function rejeitarConcurso(numero: number): Promise<string | null> {
  const { error } = await supabase.rpc('rejeitar_concurso', { p_numero: numero })
  return error ? error.message.replace(/^.*?ERROR:\s*/, '') : null
}
