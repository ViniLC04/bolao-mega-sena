// Probabilidades (SPEC seção 7). Funções puras, sem rede nem tela.
//
// Lembrete que a tela deve mostrar: estatísticas de sorteios passados NÃO aumentam a probabilidade.
// Cada sorteio é independente; todo conjunto de 6 dezenas tem a mesma chance.
import {
  combinacoes,
  DEZENAS_SORTEADAS,
  DEZENAS_UNIVERSO,
  mascaraBits,
  popcount32,
  TOTAL_COMBINACOES,
  umEm,
} from './combinatoria'
import { criarRng } from './random'

// ---------------------------------------------------------------------------------------------
// Fórmulas exatas
// ---------------------------------------------------------------------------------------------

/** Quantos sorteios dão exatamente h acertos a um jogo de k dezenas: C(k,h)·C(60−k, 6−h). */
export function sorteiosComAcertos(k: number, h: number): number {
  return combinacoes(k, h) * combinacoes(DEZENAS_UNIVERSO - k, DEZENAS_SORTEADAS - h)
}

export interface LinhaAcertos {
  acertos: number
  /** quantos dos C(60,6) sorteios dão estes acertos */
  sorteios: number
  /** probabilidade exata (hipergeométrica) */
  probabilidade: number
}

/** 7: distribuição de acertos de UM jogo de k dezenas (hipergeométrica), de 0 a 6 acertos. */
export function distribuicaoAcertos(k: number): LinhaAcertos[] {
  const linhas: LinhaAcertos[] = []
  for (let h = 0; h <= DEZENAS_SORTEADAS; h++) {
    const sorteios = sorteiosComAcertos(k, h)
    linhas.push({ acertos: h, sorteios, probabilidade: sorteios / TOTAL_COMBINACOES })
  }
  return linhas
}

export interface ChanceFaixa {
  /** combinações (sorteios) que dão a faixa a UMA aposta simples */
  combinacoes: number
  /** 1 em quantos */
  umEm: number
}

/** 7: chance de uma aposta simples (6 dezenas) em cada faixa: sena 1 em 50.063.860; quina 324; quadra 21.465. */
export function chancesApostaSimples(): { sena: ChanceFaixa; quina: ChanceFaixa; quadra: ChanceFaixa } {
  const sena = sorteiosComAcertos(6, 6)
  const quina = sorteiosComAcertos(6, 5)
  const quadra = sorteiosComAcertos(6, 4)
  return {
    sena: { combinacoes: sena, umEm: umEm(sena) },
    quina: { combinacoes: quina, umEm: umEm(quina) },
    quadra: { combinacoes: quadra, umEm: umEm(quadra) },
  }
}

// ---------------------------------------------------------------------------------------------
// Combinações distintas (descontando sobreposição) — chance exata de SENA do bolão
// ---------------------------------------------------------------------------------------------

// Tabela de binomiais C(n, j) para n ≤ 60 e j ≤ 6, usada no "rank" de uma combinação.
const BINOMIAIS: number[][] = Array.from({ length: DEZENAS_UNIVERSO + 1 }, (_, n) =>
  Array.from({ length: DEZENAS_SORTEADAS + 1 }, (_, j) => combinacoes(n, j)),
)

/** Posição única (0 .. C(60,6)−1) de uma combinação de 6 dezenas ordenadas, 1..60 (ordem colex). */
export function rankCombinacao(seis: readonly number[]): number {
  let rank = 0
  for (let i = 0; i < DEZENAS_SORTEADAS; i++) rank += BINOMIAIS[seis[i] - 1][i + 1]
  return rank
}

/**
 * Quantas combinações DISTINTAS de 6 dezenas os jogos cobrem (cada jogo de k dezenas cobre C(k,6)).
 * Jogos que compartilham 6 ou mais dezenas repetem combinações; elas contam uma vez só.
 * Usa um mapa de bits de ~6 MB, então cabe em navegador e em Worker.
 */
export function combinacoesDistintas(jogos: readonly (readonly number[])[]): number {
  const vistos = new Uint8Array((TOTAL_COMBINACOES >>> 3) + 1)
  let distintas = 0
  for (const jogo of jogos) {
    paraCadaRank(jogo, (rank) => {
      const byte = rank >>> 3
      const bit = 1 << (rank & 7)
      if (!(vistos[byte] & bit)) {
        vistos[byte] |= bit
        distintas++
      }
    })
  }
  return distintas
}

/**
 * Percorre as C(k,6) combinações de 6 dezenas de um jogo, chamando `cb` com o rank de cada uma.
 * Se `cb` devolver true, para na hora e esta função devolve true (serve para "achei uma já coberta").
 */
export function paraCadaRank(jogoBruto: readonly number[], cb: (rank: number) => boolean | void): boolean {
  const jogo = [...jogoBruto].sort((a, b) => a - b)
  const k = jogo.length
  if (k < DEZENAS_SORTEADAS) return false
  const idx = [0, 1, 2, 3, 4, 5]
  const seis = new Array<number>(DEZENAS_SORTEADAS)
  for (;;) {
    for (let i = 0; i < DEZENAS_SORTEADAS; i++) seis[i] = jogo[idx[i]]
    if (cb(rankCombinacao(seis)) === true) return true
    let p = DEZENAS_SORTEADAS - 1
    while (p >= 0 && idx[p] === k - DEZENAS_SORTEADAS + p) p--
    if (p < 0) return false
    idx[p]++
    for (let q = p + 1; q < DEZENAS_SORTEADAS; q++) idx[q] = idx[q - 1] + 1
  }
}

/** 7: chance exata de sena do bolão = combinações distintas ÷ 50.063.860. */
export function probabilidadeSena(distintas: number): number {
  return distintas / TOTAL_COMBINACOES
}

// ---------------------------------------------------------------------------------------------
// "Pelo menos uma quina/quadra no bolão": Monte Carlo e enumeração exata
// ---------------------------------------------------------------------------------------------

const mascara = mascaraBits
const bits = popcount32

export interface EstimativaFaixa {
  /** quantos sorteios deram ao menos um jogo com essa faixa */
  sorteios: number
  /** probabilidade (fração) */
  p: number
  /** margem de erro de 95% (só no Monte Carlo; 0 na enumeração exata) */
  margem95: number
}

export interface ResultadoProbabilidades {
  /** "exato" (enumeração completa) ou "aproximado" (Monte Carlo): a tela deve mostrar este rótulo */
  tipo: 'exato' | 'aproximado'
  sorteios: number
  /** pelo menos um jogo com 6 acertos */
  sena: EstimativaFaixa
  /** pelo menos um jogo com 5 ou mais acertos (inclui quem fez a sena) */
  quina: EstimativaFaixa
  /** pelo menos um jogo com 4 ou mais acertos (inclui quina e sena) */
  quadra: EstimativaFaixa
}

function resumir(tipo: 'exato' | 'aproximado', total: number, s6: number, s5: number, s4: number): ResultadoProbabilidades {
  const faixa = (c: number): EstimativaFaixa => {
    const p = c / total
    return { sorteios: c, p, margem95: tipo === 'exato' ? 0 : 1.96 * Math.sqrt((p * (1 - p)) / total) }
  }
  return { tipo, sorteios: total, sena: faixa(s6), quina: faixa(s5), quadra: faixa(s4) }
}

export interface OpcoesMonteCarlo {
  /** padrão: 2.000.000 (mínimo pedido no SPEC) */
  sorteios?: number
  /** gerador em [0,1); padrão Math.random. Passe criarRng(semente) para resultado reprodutível. */
  rng?: () => number
  /** chamado de tempos em tempos com a fração concluída (0 a 1), para a barra de progresso do Worker */
  onProgresso?: (fracao: number) => void
}

/**
 * 7: chance de "pelo menos uma quina/quadra" no bolão, por simulação. Rótulo: APROXIMADO.
 * `jogos` são todos os jogos de todos os recibos do bolão.
 */
export function monteCarlo(jogos: readonly (readonly number[])[], opcoes: OpcoesMonteCarlo = {}): ResultadoProbabilidades {
  const total = opcoes.sorteios ?? 2_000_000
  const rng = opcoes.rng ?? Math.random
  const masks = jogos.map(mascara)
  const lo = masks.map((m) => m[0])
  const hi = masks.map((m) => m[1])
  const g = masks.length
  const passo = Math.max(1, Math.floor(total / 100))

  let s6 = 0
  let s5 = 0
  let s4 = 0
  const pool = Array.from({ length: DEZENAS_UNIVERSO }, (_, i) => i + 1)
  for (let s = 0; s < total; s++) {
    let dLo = 0
    let dHi = 0
    for (let i = 0; i < DEZENAS_SORTEADAS; i++) {
      const j = i + Math.floor(rng() * (DEZENAS_UNIVERSO - i))
      const t = pool[i]
      pool[i] = pool[j]
      pool[j] = t
      const d = pool[i]
      if (d <= 30) dLo |= 1 << (d - 1)
      else dHi |= 1 << (d - 31)
    }
    let melhor = 0
    for (let j = 0; j < g; j++) {
      const h = bits(lo[j] & dLo) + bits(hi[j] & dHi)
      if (h > melhor) melhor = h
    }
    if (melhor === 6) s6++
    if (melhor >= 5) s5++
    if (melhor >= 4) s4++
    if (opcoes.onProgresso && (s + 1) % passo === 0) opcoes.onProgresso((s + 1) / total)
  }
  return resumir('aproximado', total, s6, s5, s4)
}

export interface ResultadoGrupos {
  /** um resultado para cada grupo (cada recibo), na ordem recebida */
  porGrupo: ResultadoProbabilidades[]
  /** o bolão inteiro (todos os jogos de todos os grupos juntos) */
  total: ResultadoProbabilidades
}

/**
 * 7: chance de "pelo menos uma quina/quadra" POR RECIBO e do BOLÃO INTEIRO, na mesma passada de sorteios.
 * `grupos[i]` = os jogos do recibo i. Rótulo: APROXIMADO.
 */
export function monteCarloGrupos(grupos: readonly (readonly (readonly number[])[])[], opcoes: OpcoesMonteCarlo = {}): ResultadoGrupos {
  const sorteios = opcoes.sorteios ?? 2_000_000
  const rng = opcoes.rng ?? Math.random
  const lo: number[] = []
  const hi: number[] = []
  const grp: number[] = []
  grupos.forEach((jogos, gi) => {
    for (const j of jogos) {
      const [l, h] = mascara(j)
      lo.push(l)
      hi.push(h)
      grp.push(gi)
    }
  })
  const ng = grupos.length
  const n = lo.length
  const c6 = new Array<number>(ng).fill(0)
  const c5 = new Array<number>(ng).fill(0)
  const c4 = new Array<number>(ng).fill(0)
  let t6 = 0
  let t5 = 0
  let t4 = 0
  const melhorDoGrupo = new Array<number>(ng).fill(0)
  const passo = Math.max(1, Math.floor(sorteios / 100))
  const pool = Array.from({ length: DEZENAS_UNIVERSO }, (_, i) => i + 1)

  for (let s = 0; s < sorteios; s++) {
    let dLo = 0
    let dHi = 0
    for (let i = 0; i < DEZENAS_SORTEADAS; i++) {
      const j = i + Math.floor(rng() * (DEZENAS_UNIVERSO - i))
      const t = pool[i]
      pool[i] = pool[j]
      pool[j] = t
      const d = pool[i]
      if (d <= 30) dLo |= 1 << (d - 1)
      else dHi |= 1 << (d - 31)
    }
    melhorDoGrupo.fill(0)
    for (let j = 0; j < n; j++) {
      const h = bits(lo[j] & dLo) + bits(hi[j] & dHi)
      if (h > melhorDoGrupo[grp[j]]) melhorDoGrupo[grp[j]] = h
    }
    let geral = 0
    for (let g = 0; g < ng; g++) {
      const m = melhorDoGrupo[g]
      if (m > geral) geral = m
      if (m === 6) c6[g]++
      if (m >= 5) c5[g]++
      if (m >= 4) c4[g]++
    }
    if (geral === 6) t6++
    if (geral >= 5) t5++
    if (geral >= 4) t4++
    if (opcoes.onProgresso && (s + 1) % passo === 0) opcoes.onProgresso((s + 1) / sorteios)
  }
  return {
    porGrupo: grupos.map((_, g) => resumir('aproximado', sorteios, c6[g], c5[g], c4[g])),
    total: resumir('aproximado', sorteios, t6, t5, t4),
  }
}

export interface OpcoesEnumeracao {
  /** chamado com a fração concluída (0 a 1) */
  onProgresso?: (fracao: number) => void
}

/**
 * 7 (opcional): cálculo EXATO por enumeração dos 50.063.860 sorteios possíveis. Pesado: rode em Web Worker
 * com barra de progresso. Cada jogo de k dezenas custa uma checagem por sorteio.
 */
export function enumeracaoExata(jogos: readonly (readonly number[])[], opcoes: OpcoesEnumeracao = {}): ResultadoProbabilidades {
  const masks = jogos.map(mascara)
  const lo = Int32Array.from(masks.map((m) => m[0]))
  const hi = Int32Array.from(masks.map((m) => m[1]))
  const g = masks.length
  let s6 = 0
  let s5 = 0
  let s4 = 0
  let feitos = 0

  const bitDe = (d: number): [number, number] => (d <= 30 ? [1 << (d - 1), 0] : [0, 1 << (d - 31)])
  const B = Array.from({ length: DEZENAS_UNIVERSO + 1 }, (_, d) => (d === 0 ? [0, 0] : bitDe(d)))

  for (let a = 1; a <= 55; a++) {
    for (let b = a + 1; b <= 56; b++) {
      const abLo = B[a][0] | B[b][0]
      const abHi = B[a][1] | B[b][1]
      for (let c = b + 1; c <= 57; c++) {
        const cLo = abLo | B[c][0]
        const cHi = abHi | B[c][1]
        for (let d = c + 1; d <= 58; d++) {
          const dLo = cLo | B[d][0]
          const dHi = cHi | B[d][1]
          for (let e = d + 1; e <= 59; e++) {
            const eLo = dLo | B[e][0]
            const eHi = dHi | B[e][1]
            for (let f = e + 1; f <= 60; f++) {
              const sLo = eLo | B[f][0]
              const sHi = eHi | B[f][1]
              let melhor = 0
              for (let j = 0; j < g; j++) {
                const h = bits(lo[j] & sLo) + bits(hi[j] & sHi)
                if (h > melhor) melhor = h
              }
              if (melhor === 6) s6++
              if (melhor >= 5) s5++
              if (melhor >= 4) s4++
            }
          }
        }
      }
    }
    feitos += combinacoes(DEZENAS_UNIVERSO - a, DEZENAS_SORTEADAS - 1)
    opcoes.onProgresso?.(feitos / TOTAL_COMBINACOES)
  }
  return resumir('exato', TOTAL_COMBINACOES, s6, s5, s4)
}

/** Atalho para testes e telas: Monte Carlo reproduzível com semente. */
export function monteCarloComSemente(
  jogos: readonly (readonly number[])[],
  semente: number,
  sorteios?: number,
): ResultadoProbabilidades {
  return monteCarlo(jogos, { rng: criarRng(semente), sorteios })
}
