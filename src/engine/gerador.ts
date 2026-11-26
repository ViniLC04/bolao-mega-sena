// Gerador de jogos (SPEC seção 5) e cruzamento entre bolões (seção 6). Somente ADM. Funções puras.
//
// Entrada: a lista de recibos (k dezenas, g jogos) vinda do simulador + as premissas LIGADAS.
// Saída: os jogos, mais um relatório. Método: amostragem com rejeição e reinício.
//   - Sorteia um jogo candidato, confere as premissas por jogo e as de sobreposição; se passa, fica.
//   - Se um jogo não encontra candidato em `tentativasPorJogo` tentativas, REINICIA tudo (até `reinicios`).
//   - Se nada funciona, diz QUAL premissa trava (diagnóstico).
// Regras que valem SEMPRE, com ou sem premissas: nenhuma combinação de 6 dezenas se repete dentro do bolão
// nem contra as combinações já cobertas por outros bolões do mesmo concurso.
//
// AVISO (a tela mostra): restringir a poucos números aumenta repetições e REDUZ combinações distintas.
import { combinacoes, mascaraBits, popcount32, TOTAL_COMBINACOES, umEm } from './combinatoria'
import { contarFaixasHistorico, type MascarasHist } from './historico'
import { combinacoesDistintas, paraCadaRank } from './probabilidades'
import { criarRng } from './random'

export const AVISO_RESTRICAO =
  'Restringir a poucos números aumenta as repetições e reduz o número de combinações distintas.'

export const NOMES_PREMISSAS = {
  maxIguais: 'Máx. de números iguais entre jogos',
  maxConsecutivos: 'Máx. de números consecutivos',
  paresImpares: 'Pares e ímpares',
  soma: 'Soma das dezenas',
  linhas: 'Linhas do volante',
  obrigatorios: 'Números obrigatórios',
  proibidos: 'Números proibidos',
  frequentes: 'Números mais frequentes',
  historico: 'Histórico de quinas e quadras',
} as const

export type ChavePremissa = keyof typeof NOMES_PREMISSAS

/** Até onde vale o "máx. de números iguais": só dentro do recibo, entre os recibos do bolão ou em todo o concurso. */
export type EscopoMaxIguais = 'recibo' | 'bolao' | 'concurso'

/**
 * Cada premissa só vale se a chave estiver presente (ligada). Ausente = desligada.
 * Pares, soma e linhas valem para as k dezenas do jogo (valores absolutos).
 */
export interface Premissas {
  /** Com nMax = 5 nunca há combinação de 6 dezenas repetida entre jogos do escopo. Padrão do SPEC: escopo "concurso". */
  maxIguais?: { nMax: number; escopo: EscopoMaxIguais }
  maxConsecutivos?: { max: number }
  paresImpares?: { minPares: number; maxPares: number }
  soma?: { min: number; max: number }
  /** Linhas do volante: 6 linhas de 10 (1–10, 11–20, …); no máximo `maxPorLinha` dezenas do jogo por linha. */
  linhas?: { maxPorLinha: number }
  /** Cada dezena obrigatória aparece em todos os jogos ('todos') ou em pelo menos M jogos do bolão. */
  obrigatorios?: { dezenas: number[]; minJogos: number | 'todos' }
  proibidos?: { dezenas: number[] }
  /** As dezenas já calculadas (ex.: as X mais sorteadas do período); restringir os jogos a elas ou só ponderar o sorteio. */
  frequentes?: { dezenas: number[]; modo: 'restringir' | 'ponderar'; peso?: number }
  /** Máx. de concursos do período (já escolhido em `contexto.historico`) em que o jogo teria feito quina/quadra. */
  historico?: { maxQuinas?: number; maxQuadras?: number }
}

export interface ReciboAlvo {
  k: number
  g: number
}

export interface JogoGerado {
  /** posição do recibo na lista `recibos` */
  recibo: number
  /** dezenas em ordem crescente */
  dezenas: number[]
  /** jogo travado pelo ADM: nunca é trocado ao gerar de novo */
  travado: boolean
}

export interface ContextoGeracao {
  /** Jogos dos OUTROS bolões já criados para o mesmo concurso (para o cruzamento). */
  jogosOutrosBoloes?: readonly (readonly number[])[]
  /** Sorteios do período escolhido (de `mascarasDe`), usado pela premissa de histórico. */
  historico?: MascarasHist
}

export interface OpcoesGeracao {
  /** Semente do sorteio: com a mesma semente e os mesmos dados o resultado é sempre o mesmo. */
  semente?: number
  rng?: () => number
  /** Candidatos testados por jogo antes de reiniciar (padrão 5.000). */
  tentativasPorJogo?: number
  /** Reinícios antes de desistir (padrão 30). */
  reinicios?: number
  /** Jogos que ficam como estão (travados, ou todos menos o que será regerado). */
  fixos?: JogoGerado[]
  /** Fração concluída (0 a 1), para a barra de progresso do Worker. */
  onProgresso?: (fracao: number) => void
}

export interface PremissaAvaliada {
  chave: ChavePremissa
  nome: string
  ok: boolean
}

export interface RelatorioJogo {
  indice: number
  recibo: number
  k: number
  premissas: PremissaAvaliada[]
  /** maior número de dezenas iguais com qualquer outro jogo do escopo escolhido */
  maiorSobreposicao: number
}

export interface Relatorio {
  porJogo: RelatorioJogo[]
  /** maior nº de dezenas iguais entre dois jogos QUAISQUER do bolão */
  sobreposicaoMaxima: number
  parSobreposicao: [number, number] | null
  /** soma de C(k,6) dos jogos */
  combinacoesEsperadas: number
  combinacoesDistintas: number
  /** esperadas − distintas: precisa ser 0 */
  repetidas: number
  /** combinações deste bolão que já estavam cobertas em outros bolões: precisa ser 0 */
  repetidasComOutrosBoloes: number
  /** maior sobreposição entre um jogo deste bolão e um jogo de outro bolão */
  sobreposicaoMaximaComOutros: number
  senaUmEm: number
  avisos: string[]
}

export interface TaxaPremissa {
  chave: ChavePremissa
  nome: string
  /** fração dos jogos aleatórios que passam SÓ por esta premissa (null = não dá para medir isolada) */
  taxaAceitacao: number | null
  /** a geração funcionou quando esta premissa foi desligada? */
  viavelSemEla: boolean
}

export interface Diagnostico {
  mensagem: string
  aviso: string
  falhouNo: { recibo: number; k: number; posicao: number }
  taxas: TaxaPremissa[]
  culpadas: ChavePremissa[]
}

export interface ResultadoGeracao {
  ok: boolean
  jogos: JogoGerado[]
  semente: number
  relatorio?: Relatorio
  /** quando ok = false: explicação em português */
  motivo?: string
  diagnostico?: Diagnostico
}

// ---------------------------------------------------------------------------------------------
// Verificação das premissas por jogo
// ---------------------------------------------------------------------------------------------

const ORDEM_POR_JOGO: ChavePremissa[] = [
  'proibidos', 'frequentes', 'obrigatorios', 'paresImpares', 'soma', 'maxConsecutivos', 'linhas', 'historico',
]

interface Prep {
  proibidos: Set<number>
  freq: Set<number> | null
  freqRestringe: boolean
  obrig: number[]
  obrigSet: Set<number>
  minJogos: number | 'todos'
  pesos: Float64Array | null
}

function preparar(p: Premissas): Prep {
  const freqRestringe = p.frequentes?.modo === 'restringir'
  const pesos =
    p.frequentes && p.frequentes.modo === 'ponderar' ? new Float64Array(61).fill(1) : null
  if (pesos && p.frequentes) for (const d of p.frequentes.dezenas) pesos[d] = Math.max(1, p.frequentes.peso ?? 3)
  const obrig = [...new Set(p.obrigatorios?.dezenas ?? [])]
  return {
    proibidos: new Set(p.proibidos?.dezenas ?? []),
    freq: p.frequentes ? new Set(p.frequentes.dezenas) : null,
    freqRestringe,
    obrig,
    obrigSet: new Set(obrig),
    minJogos: p.obrigatorios?.minJogos ?? 'todos',
    pesos,
  }
}

function maiorSequencia(d: readonly number[]): number {
  let melhor = d.length > 0 ? 1 : 0
  let atual = 1
  for (let i = 1; i < d.length; i++) {
    if (d[i] === d[i - 1] + 1) {
      atual++
      if (atual > melhor) melhor = atual
    } else atual = 1
  }
  return melhor
}

function maiorLinha(d: readonly number[]): number {
  const c = [0, 0, 0, 0, 0, 0]
  for (const n of d) c[Math.floor((n - 1) / 10)]++
  return Math.max(...c)
}

/** Confere UMA premissa por jogo. `d` em ordem crescente; lo/hi = máscara de bits do jogo. */
function verificar(chave: ChavePremissa, d: readonly number[], lo: number, hi: number, p: Premissas, prep: Prep, ctx: ContextoGeracao): boolean {
  switch (chave) {
    case 'proibidos':
      return !d.some((n) => prep.proibidos.has(n))
    case 'frequentes':
      return !prep.freqRestringe || !prep.freq || d.every((n) => prep.freq!.has(n) || prep.obrigSet.has(n))
    case 'obrigatorios':
      return prep.minJogos !== 'todos' || prep.obrig.every((n) => d.includes(n))
    case 'paresImpares': {
      const pares = d.filter((n) => n % 2 === 0).length
      return pares >= p.paresImpares!.minPares && pares <= p.paresImpares!.maxPares
    }
    case 'soma': {
      const s = d.reduce((a, n) => a + n, 0)
      return s >= p.soma!.min && s <= p.soma!.max
    }
    case 'maxConsecutivos':
      return maiorSequencia(d) <= p.maxConsecutivos!.max
    case 'linhas':
      return maiorLinha(d) <= p.linhas!.maxPorLinha
    case 'historico': {
      if (!ctx.historico) return true
      const h = p.historico!
      const f = contarFaixasHistorico(lo, hi, ctx.historico)
      return (h.maxQuinas === undefined || f.quinas <= h.maxQuinas) && (h.maxQuadras === undefined || f.quadras <= h.maxQuadras)
    }
    case 'maxIguais':
      return true // premissa entre jogos: conferida à parte
  }
}

function chavesLigadas(p: Premissas): ChavePremissa[] {
  return (Object.keys(NOMES_PREMISSAS) as ChavePremissa[]).filter((c) => p[c] !== undefined)
}

function semPremissa(p: Premissas, chave: ChavePremissa): Premissas {
  const copia: Premissas = { ...p }
  delete copia[chave]
  return copia
}

// ---------------------------------------------------------------------------------------------
// Sorteio do candidato
// ---------------------------------------------------------------------------------------------

/** Sorteia `k` dezenas: as forçadas + (k − forçadas) tiradas do `pool` (uniforme, ou ponderado por `pesos`). */
function sortear(rng: () => number, k: number, forcadas: readonly number[], pool: number[], pesos: Float64Array | null): number[] {
  const precisa = k - forcadas.length
  const saida = forcadas.slice()
  if (precisa > 0) {
    if (!pesos) {
      for (let i = 0; i < precisa; i++) {
        const j = i + Math.floor(rng() * (pool.length - i))
        const t = pool[i]
        pool[i] = pool[j]
        pool[j] = t
        saida.push(pool[i])
      }
    } else {
      const chaves = pool.map((n) => [Math.log(rng() || 1e-12) / pesos[n], n] as const)
      chaves.sort((a, b) => b[0] - a[0])
      for (let i = 0; i < precisa; i++) saida.push(chaves[i][1])
    }
  }
  return saida.sort((a, b) => a - b)
}

// ---------------------------------------------------------------------------------------------
// Núcleo da geração
// ---------------------------------------------------------------------------------------------

type Rejeicoes = Partial<Record<ChavePremissa | 'combinacoes', number>>

interface Falha {
  motivo: 'pool' | 'obrigatorios' | 'tentativas'
  recibo: number
  k: number
  posicao: number
  avaliados: number
  rejeicoes: Rejeicoes
  detalhe?: string
}

interface ResultadoInterno {
  ok: boolean
  jogos: JogoGerado[]
  falha?: Falha
}

const baralhar = <T,>(lista: T[], rng: () => number): T[] => {
  const v = lista.slice()
  for (let i = v.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[v[i], v[j]] = [v[j], v[i]]
  }
  return v
}

function gerarInterno(
  recibos: readonly ReciboAlvo[],
  p: Premissas,
  ctx: ContextoGeracao,
  tentativas: number,
  reinicios: number,
  rng: () => number,
  fixos: readonly JogoGerado[],
  onProgresso?: (f: number) => void,
): ResultadoInterno {
  const prep = preparar(p)
  const ligadas = chavesLigadas(p)
  const ativasPorJogo = ORDEM_POR_JOGO.filter((c) => ligadas.includes(c))
  const maxIguais = p.maxIguais
  const externos = (ctx.jogosOutrosBoloes ?? []).map((j) => mascaraBits(j))

  for (const f of fixos) {
    if (!recibos[f.recibo] || f.dezenas.length !== recibos[f.recibo].k) {
      throw new Error('Um jogo fixo não combina com o recibo informado.')
    }
  }

  // Conflitos que nenhum sorteio resolve.
  const conflito = prep.obrig.filter((n) => prep.proibidos.has(n))
  if (conflito.length > 0) {
    return { ok: false, jogos: [], falha: { motivo: 'obrigatorios', recibo: 0, k: recibos[0]?.k ?? 6, posicao: 0, avaliados: 0, rejeicoes: {}, detalhe: `As dezenas ${conflito.join(', ')} estão ao mesmo tempo em "obrigatórios" e em "proibidos".` } }
  }
  const menorK = Math.min(...recibos.map((r) => r.k))
  if (prep.minJogos === 'todos' && prep.obrig.length > menorK) {
    return { ok: false, jogos: [], falha: { motivo: 'obrigatorios', recibo: 0, k: menorK, posicao: 0, avaliados: 0, rejeicoes: {}, detalhe: `Há ${prep.obrig.length} dezenas obrigatórias em todos os jogos, mas existem jogos de apenas ${menorK} dezenas.` } }
  }

  // Dezenas que o sorteio livre pode usar.
  const permitidas: number[] = []
  for (let n = 1; n <= 60; n++) {
    if (prep.proibidos.has(n)) continue
    if (prep.freqRestringe && prep.freq && !prep.freq.has(n)) continue
    permitidas.push(n)
  }

  // "Escopo concurso com N_max ≤ 5" já garante que nenhuma combinação de 6 se repete: dispensa o mapa de combinações.
  const implicito = maxIguais !== undefined && maxIguais.nMax <= 5 && maxIguais.escopo === 'concurso'
  let coberturaBase: Uint8Array | null = null
  const marcar = (cob: Uint8Array, d: readonly number[]) =>
    paraCadaRank(d, (r) => {
      cob[r >>> 3] |= 1 << (r & 7)
    })
  if (!implicito) {
    coberturaBase = new Uint8Array((TOTAL_COMBINACOES >>> 3) + 1)
    for (const j of ctx.jogosOutrosBoloes ?? []) marcar(coberturaBase, j)
    for (const f of fixos) marcar(coberturaBase, f.dezenas)
  }

  // Vagas a preencher: tudo o que falta em cada recibo, os jogos maiores primeiro (são os mais difíceis).
  const vagas: { recibo: number; k: number }[] = []
  recibos.forEach((r, ri) => {
    const jaTem = fixos.filter((f) => f.recibo === ri).length
    for (let i = jaTem; i < r.g; i++) vagas.push({ recibo: ri, k: r.k })
  })
  vagas.sort((a, b) => b.k - a.k)

  const fixosMasc = fixos.map((f) => mascaraBits(f.dezenas))
  let ultimaFalha: Falha | undefined

  for (let rt = 0; rt <= reinicios; rt++) {
    const aceitos: JogoGerado[] = []
    const aLo = fixosMasc.map((m) => m[0])
    const aHi = fixosMasc.map((m) => m[1])
    const aRec = fixos.map((f) => f.recibo)
    const cobertura = coberturaBase ? coberturaBase.slice() : null

    // Obrigatórios em ≥ M jogos: decide, a cada tentativa, em quais vagas cada dezena entra.
    const forcadas: number[][] = vagas.map(() => [])
    let atribuicaoOk = true
    for (const d of prep.obrig) {
      if (prep.minJogos === 'todos') {
        forcadas.forEach((f) => f.push(d))
        continue
      }
      const jaTem = fixos.filter((f) => f.dezenas.includes(d)).length
      const faltam = Math.max(0, prep.minJogos - jaTem)
      if (faltam > vagas.length) {
        return { ok: false, jogos: [], falha: { motivo: 'obrigatorios', recibo: 0, k: menorK, posicao: 0, avaliados: 0, rejeicoes: {}, detalhe: `A dezena ${d} deveria estar em pelo menos ${prep.minJogos} jogos, mas só há ${vagas.length + jaTem} jogos no bolão.` } }
      }
      baralhar(vagas.map((_, i) => i), rng).slice(0, faltam).forEach((i) => forcadas[i].push(d))
    }
    for (let i = 0; i < vagas.length; i++) if (forcadas[i].length > vagas[i].k) atribuicaoOk = false

    let falhou: Falha | null = null
    if (!atribuicaoOk) {
      falhou = { motivo: 'obrigatorios', recibo: vagas[0]?.recibo ?? 0, k: vagas[0]?.k ?? 6, posicao: 0, avaliados: 0, rejeicoes: {}, detalhe: 'Dezenas obrigatórias demais para os jogos deste bolão.' }
    } else {
      for (let v = 0; v < vagas.length && !falhou; v++) {
        const { recibo, k } = vagas[v]
        const forc = forcadas[v]
        const forcSet = new Set(forc)
        const pool = permitidas.filter((n) => !forcSet.has(n))
        if (k - forc.length > pool.length) {
          falhou = { motivo: 'pool', recibo, k, posicao: v, avaliados: 0, rejeicoes: {}, detalhe: `Sobram só ${pool.length + forc.length} dezenas possíveis, mas o jogo precisa de ${k}.` }
          break
        }
        const rej: Rejeicoes = {}
        let achou = false
        let avaliados = 0
        for (let t = 0; t < tentativas && !achou; t++) {
          avaliados++
          const d = sortear(rng, k, forc, pool, prep.pesos)
          const [lo, hi] = mascaraBits(d)
          let reprovada: ChavePremissa | 'combinacoes' | null = null
          for (const c of ativasPorJogo) {
            if (!verificar(c, d, lo, hi, p, prep, ctx)) {
              reprovada = c
              break
            }
          }
          if (!reprovada && maxIguais) {
            const n = maxIguais.nMax
            for (let i = 0; i < aLo.length && !reprovada; i++) {
              if (maxIguais.escopo === 'recibo' && aRec[i] !== recibo) continue
              if (popcount32(lo & aLo[i]) + popcount32(hi & aHi[i]) > n) reprovada = 'maxIguais'
            }
            if (!reprovada && maxIguais.escopo === 'concurso') {
              for (let i = 0; i < externos.length && !reprovada; i++) {
                if (popcount32(lo & externos[i][0]) + popcount32(hi & externos[i][1]) > n) reprovada = 'maxIguais'
              }
            }
          }
          if (!reprovada && cobertura && paraCadaRank(d, (r) => (cobertura[r >>> 3] & (1 << (r & 7))) !== 0)) reprovada = 'combinacoes'
          if (reprovada) {
            rej[reprovada] = (rej[reprovada] ?? 0) + 1
            continue
          }
          if (cobertura) marcar(cobertura, d)
          aceitos.push({ recibo, dezenas: d, travado: false })
          aLo.push(lo)
          aHi.push(hi)
          aRec.push(recibo)
          achou = true
        }
        if (!achou) falhou = { motivo: 'tentativas', recibo, k, posicao: v, avaliados, rejeicoes: rej }
        onProgresso?.((rt + (v + 1) / Math.max(1, vagas.length)) / (reinicios + 1))
      }
    }

    if (!falhou) {
      onProgresso?.(1)
      // Ordem final: recibo a recibo; dentro de cada um, primeiro os fixos, depois os novos.
      const todos: JogoGerado[] = [...fixos, ...aceitos]
      const ordem = todos.map((j, i) => ({ j, i })).sort((a, b) => a.j.recibo - b.j.recibo || a.i - b.i)
      return { ok: true, jogos: ordem.map((o) => o.j) }
    }
    ultimaFalha = falhou
    if (falhou.motivo === 'pool') break // reiniciar não resolve falta de dezenas
  }
  return { ok: false, jogos: [], falha: ultimaFalha }
}

// ---------------------------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------------------------

function sobreposicao(a: [number, number], b: [number, number]): number {
  return popcount32(a[0] & b[0]) + popcount32(a[1] & b[1])
}

/** Premissas atendidas por jogo, sobreposição máxima, combinações distintas e repetidas (SPEC 5 e 6). */
export function gerarRelatorio(
  jogos: readonly JogoGerado[],
  recibos: readonly ReciboAlvo[],
  p: Premissas = {},
  ctx: ContextoGeracao = {},
): Relatorio {
  const prep = preparar(p)
  const ligadas = chavesLigadas(p)
  const masc = jogos.map((j) => mascaraBits(j.dezenas))
  const externos = (ctx.jogosOutrosBoloes ?? []).map((j) => mascaraBits(j))
  const avisos: string[] = []

  let sobMax = 0
  let par: [number, number] | null = null
  for (let i = 0; i < jogos.length; i++) {
    for (let j = i + 1; j < jogos.length; j++) {
      const s = sobreposicao(masc[i], masc[j])
      if (s > sobMax) {
        sobMax = s
        par = [i, j]
      }
    }
  }
  let sobMaxOutros = 0
  for (const m of masc) for (const e of externos) sobMaxOutros = Math.max(sobMaxOutros, sobreposicao(m, e))

  const porJogo: RelatorioJogo[] = jogos.map((jg, i) => {
    let maior = 0
    for (let j = 0; j < jogos.length; j++) if (j !== i) maior = Math.max(maior, sobreposicao(masc[i], masc[j]))
    const premissas: PremissaAvaliada[] = []
    for (const c of ligadas) {
      let ok = true
      if (c === 'maxIguais') {
        const esc = p.maxIguais!.escopo
        let m = 0
        for (let j = 0; j < jogos.length; j++) {
          if (j === i) continue
          if (esc === 'recibo' && jogos[j].recibo !== jg.recibo) continue
          m = Math.max(m, sobreposicao(masc[i], masc[j]))
        }
        if (esc === 'concurso') for (const e of externos) m = Math.max(m, sobreposicao(masc[i], e))
        ok = m <= p.maxIguais!.nMax
      } else {
        ok = verificar(c, jg.dezenas, masc[i][0], masc[i][1], p, prep, ctx)
      }
      premissas.push({ chave: c, nome: NOMES_PREMISSAS[c], ok })
    }
    return { indice: i, recibo: jg.recibo, k: jg.dezenas.length, premissas, maiorSobreposicao: maior }
  })

  // Obrigatórios em ≥ M jogos: conferência do conjunto.
  if (p.obrigatorios && prep.minJogos !== 'todos') {
    for (const d of prep.obrig) {
      const n = jogos.filter((j) => j.dezenas.includes(d)).length
      if (n < prep.minJogos) avisos.push(`A dezena obrigatória ${d} está em ${n} jogos (o pedido era pelo menos ${prep.minJogos}).`)
    }
  }
  if (p.frequentes?.modo === 'restringir' && p.frequentes.dezenas.length < 30) avisos.push(AVISO_RESTRICAO)

  const esperadas = jogos.reduce((s, j) => s + combinacoes(j.dezenas.length, 6), 0)
  const distintas = combinacoesDistintas(jogos.map((j) => j.dezenas))
  let comOutros = 0
  if (ctx.jogosOutrosBoloes && ctx.jogosOutrosBoloes.length > 0) {
    const total = combinacoesDistintas([...ctx.jogosOutrosBoloes, ...jogos.map((j) => j.dezenas)])
    const soOutros = combinacoesDistintas(ctx.jogosOutrosBoloes)
    comOutros = distintas + soOutros - total
  }
  void recibos
  return {
    porJogo,
    sobreposicaoMaxima: sobMax,
    parSobreposicao: par,
    combinacoesEsperadas: esperadas,
    combinacoesDistintas: distintas,
    repetidas: esperadas - distintas,
    repetidasComOutrosBoloes: comOutros,
    sobreposicaoMaximaComOutros: sobMaxOutros,
    senaUmEm: umEm(distintas),
    avisos,
  }
}

// ---------------------------------------------------------------------------------------------
// Diagnóstico de inviabilidade: "qual premissa trava?"
// ---------------------------------------------------------------------------------------------

const pct = (x: number): string => `${(x * 100).toFixed(x < 0.01 ? 2 : 1).replace('.', ',')}%`

function diagnosticar(
  recibos: readonly ReciboAlvo[],
  p: Premissas,
  ctx: ContextoGeracao,
  falha: Falha,
  fixos: readonly JogoGerado[],
  rng: () => number,
): Diagnostico {
  const ligadas = chavesLigadas(p)
  const prep = preparar(p)
  const falhouNo = { recibo: falha.recibo, k: falha.k, posicao: falha.posicao }

  if (falha.motivo === 'pool' || falha.motivo === 'obrigatorios') {
    return {
      mensagem: `Não é possível gerar com estas premissas: ${falha.detalhe ?? 'conflito entre obrigatórios, proibidos e frequentes.'}`,
      aviso: AVISO_RESTRICAO,
      falhouNo,
      taxas: [],
      culpadas: falha.motivo === 'pool' ? (ligadas.filter((c) => c === 'proibidos' || c === 'frequentes') as ChavePremissa[]) : (['obrigatorios'] as ChavePremissa[]),
    }
  }

  // 1) Quanto de cada premissa, sozinha, deixa passar de jogos aleatórios do mesmo tamanho.
  const amostra = 2_000
  const taxas: TaxaPremissa[] = []
  const culpadas: ChavePremissa[] = []
  const todas = Array.from({ length: 60 }, (_, i) => i + 1)
  for (const c of ligadas) {
    let taxa: number | null = null
    if (c === 'maxIguais') {
      const av = Math.max(1, falha.avaliados)
      taxa = 1 - (falha.rejeicoes.maxIguais ?? 0) / av
      taxa = Math.max(0, Math.min(1, taxa))
    } else {
      let passam = 0
      for (let i = 0; i < amostra; i++) {
        const d = sortear(rng, falha.k, [], todas.slice(), null)
        const [lo, hi] = mascaraBits(d)
        if (verificar(c, d, lo, hi, p, prep, ctx)) passam++
      }
      taxa = passam / amostra
    }
    // 2) A geração funciona sem ela?
    const sem = gerarInterno(recibos, semPremissa(p, c), ctx, 500, 2, rng, fixos)
    taxas.push({ chave: c, nome: NOMES_PREMISSAS[c], taxaAceitacao: taxa, viavelSemEla: sem.ok })
    if (sem.ok) culpadas.push(c)
  }

  let mensagem: string
  if (culpadas.length > 0) {
    const partes = culpadas.map((c) => {
      const t = taxas.find((x) => x.chave === c)!
      const aceita = t.taxaAceitacao === null ? '' : c === 'maxIguais' ? ` (rejeitou ${pct(1 - t.taxaAceitacao)} dos candidatos testados)` : ` (deixa passar só ${pct(t.taxaAceitacao)} dos jogos aleatórios de ${falha.k} dezenas)`
      return `«${t.nome}»${aceita}`
    })
    mensagem = `Não consegui gerar os jogos. Sem ${culpadas.length === 1 ? 'a premissa' : 'qualquer uma destas premissas'} ${partes.join(' ou ')} a geração funciona. Afrouxe ou desligue.`
  } else if (ligadas.length === 0) {
    mensagem = 'Não consegui gerar os jogos, mesmo sem premissas: confira se há combinações suficientes e se os outros bolões não cobrem quase tudo.'
  } else {
    const piores = [...taxas].filter((t) => t.taxaAceitacao !== null).sort((a, b) => (a.taxaAceitacao ?? 1) - (b.taxaAceitacao ?? 1)).slice(0, 2)
    mensagem = `Não consegui gerar os jogos: nenhuma premissa sozinha explica, mas a combinação delas é restritiva demais${piores.length ? ` (as mais restritivas: ${piores.map((t) => `«${t.nome}» passa ${pct(t.taxaAceitacao ?? 0)}`).join(', ')})` : ''}. Afrouxe algumas.`
    culpadas.push(...piores.map((t) => t.chave))
  }
  return { mensagem, aviso: AVISO_RESTRICAO, falhouNo, taxas, culpadas }
}

// ---------------------------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------------------------

/**
 * Gera todos os jogos dos recibos. Com `opcoes.fixos`, mantém esses jogos (travados) e completa o resto.
 * Sem premissas = modo "totalmente aleatório" (ainda sem repetir combinações).
 */
export function gerarJogos(
  recibos: readonly ReciboAlvo[],
  premissas: Premissas = {},
  contexto: ContextoGeracao = {},
  opcoes: OpcoesGeracao = {},
): ResultadoGeracao {
  const semente = opcoes.semente ?? 1
  const rng = opcoes.rng ?? criarRng(semente)
  const fixos = opcoes.fixos ?? []
  const r = gerarInterno(recibos, premissas, contexto, opcoes.tentativasPorJogo ?? 5_000, opcoes.reinicios ?? 30, rng, fixos, opcoes.onProgresso)
  if (r.ok) {
    return { ok: true, jogos: r.jogos, semente, relatorio: gerarRelatorio(r.jogos, recibos, premissas, contexto) }
  }
  const diag = diagnosticar(recibos, premissas, contexto, r.falha!, fixos, criarRng(semente + 1))
  return { ok: false, jogos: [], semente, motivo: diag.mensagem, diagnostico: diag }
}

/** Troca só o jogo de posição `indice`, mantendo todos os outros como estão. */
export function regerarJogo(
  recibos: readonly ReciboAlvo[],
  jogosAtuais: readonly JogoGerado[],
  indice: number,
  premissas: Premissas = {},
  contexto: ContextoGeracao = {},
  opcoes: OpcoesGeracao = {},
): ResultadoGeracao {
  const alvo = jogosAtuais[indice]
  if (!alvo) throw new Error('Jogo inexistente.')
  const outros = jogosAtuais.filter((_, i) => i !== indice)
  const r = gerarJogos(recibos, premissas, contexto, { ...opcoes, fixos: outros })
  if (!r.ok) return r
  const novo = r.jogos.find((j) => !outros.includes(j))!
  const jogos = jogosAtuais.map((j, i) => (i === indice ? { recibo: alvo.recibo, dezenas: novo.dezenas, travado: false } : j))
  return { ...r, jogos, relatorio: gerarRelatorio(jogos, recibos, premissas, contexto) }
}
