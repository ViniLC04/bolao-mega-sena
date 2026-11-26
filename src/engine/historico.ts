// Estatísticas sobre os sorteios passados (SPEC 5 e 10), em funções puras.
//
// AVISO que a tela precisa mostrar junto: estatísticas de sorteios passados NÃO aumentam a probabilidade
// de acerto. Servem para o ADM escolher um critério, não para "prever".
import { mascaraBits, popcount32 } from './combinatoria'

export interface ConcursoHist {
  numero: number
  /** yyyy-mm-dd */
  data: string
  dezenas: readonly number[]
}

/** Período livre para as estatísticas e para os filtros do gerador (SPEC 5). */
export type FiltroPeriodo =
  | { tipo: 'tudo' }
  | { tipo: 'datas'; de?: string; ate?: string }
  | { tipo: 'concursos'; de?: number; ate?: number }
  /** um mês, em qualquer ano: "dezembro de qualquer ano" = { tipo: 'mes', mes: 12 } */
  | { tipo: 'mes'; mes: number }
  /** só os concursos da lista (as Viradas); a lista é editável e vem da configuração */
  | { tipo: 'viradas'; numeros: readonly number[] }
  /** os últimos N anos até a data de referência (yyyy-mm-dd), informada por quem chama */
  | { tipo: 'ultimos_anos'; anos: number; referencia: string }

export function filtrarPeriodo(concursos: readonly ConcursoHist[], f: FiltroPeriodo): ConcursoHist[] {
  switch (f.tipo) {
    case 'tudo':
      return [...concursos]
    case 'datas':
      return concursos.filter((c) => (!f.de || c.data >= f.de) && (!f.ate || c.data <= f.ate))
    case 'concursos':
      return concursos.filter((c) => (f.de === undefined || c.numero >= f.de) && (f.ate === undefined || c.numero <= f.ate))
    case 'mes':
      return concursos.filter((c) => Number(c.data.slice(5, 7)) === f.mes)
    case 'viradas': {
      const lista = new Set(f.numeros)
      return concursos.filter((c) => lista.has(c.numero))
    }
    case 'ultimos_anos': {
      const [ano, mes, dia] = f.referencia.split('-')
      const corte = `${Number(ano) - f.anos}-${mes}-${dia}`
      return concursos.filter((c) => c.data > corte && c.data <= f.referencia)
    }
  }
}

/** Quantas vezes cada dezena saiu. Índice = dezena (1 a 60); a posição 0 não é usada. */
export function frequencias(concursos: readonly ConcursoHist[]): number[] {
  const f = new Array<number>(61).fill(0)
  for (const c of concursos) for (const d of c.dezenas) f[d]++
  return f
}

/** As X dezenas mais sorteadas do período (empate: a dezena menor vem primeiro). */
export function maisSorteadas(concursos: readonly ConcursoHist[], x: number): number[] {
  const f = frequencias(concursos)
  return Array.from({ length: 60 }, (_, i) => i + 1)
    .sort((a, b) => f[b] - f[a] || a - b)
    .slice(0, Math.max(0, x))
}

/** Há quantos concursos cada dezena não sai (0 = saiu no último). Índice = dezena; 0 não é usada. */
export function atrasos(concursos: readonly ConcursoHist[]): number[] {
  const ordenados = [...concursos].sort((a, b) => a.numero - b.numero)
  const ultimo = new Array<number>(61).fill(-1)
  ordenados.forEach((c, i) => {
    for (const d of c.dezenas) ultimo[d] = i
  })
  return ultimo.map((u) => (u < 0 ? ordenados.length : ordenados.length - 1 - u))
}

/** Percentil p (0 a 100) por interpolação linear. Lista vazia é erro. */
export function percentil(valores: readonly number[], p: number): number {
  if (valores.length === 0) throw new Error('Não há sorteios no período escolhido.')
  const v = [...valores].sort((a, b) => a - b)
  const pos = (Math.min(100, Math.max(0, p)) / 100) * (v.length - 1)
  const base = Math.floor(pos)
  const resto = pos - base
  return base + 1 < v.length ? v[base] + (v[base + 1] - v[base]) * resto : v[base]
}

/** Soma das 6 dezenas de cada sorteio do período. */
export function somasDosSorteios(concursos: readonly ConcursoHist[]): number[] {
  return concursos.map((c) => c.dezenas.reduce((s, d) => s + d, 0))
}

/**
 * Sugestão de faixa para a soma das dezenas de um jogo de k dezenas: percentis P10 a P90 da soma dos
 * sorteios do período, escalados por k/6 (APROXIMAÇÃO: o histórico é de sorteios de 6 dezenas).
 */
export function sugestaoSoma(concursos: readonly ConcursoHist[], k: number): { min: number; max: number } {
  const somas = somasDosSorteios(concursos)
  const fator = k / 6
  return { min: Math.floor(percentil(somas, 10) * fator), max: Math.ceil(percentil(somas, 90) * fator) }
}

/** Máscaras de bits dos sorteios, para contar acertos de um jogo contra todos eles rapidamente. */
export interface MascarasHist {
  lo: Int32Array
  hi: Int32Array
}

export function mascarasDe(concursos: readonly ConcursoHist[]): MascarasHist {
  const lo = new Int32Array(concursos.length)
  const hi = new Int32Array(concursos.length)
  concursos.forEach((c, i) => {
    const [l, h] = mascaraBits(c.dezenas)
    lo[i] = l
    hi[i] = h
  })
  return { lo, hi }
}

/**
 * Quantos concursos do período o jogo teria premiado: `quinas` = concursos com 5 ou mais acertos;
 * `quadras` = concursos com 4 ou mais acertos (inclui os de quina e de sena).
 * [PREMISSA] definição do "máx. de quinas/quadras que o jogo já fez" (SPEC 5).
 */
export function contarFaixasHistorico(
  jogoLo: number,
  jogoHi: number,
  m: MascarasHist,
): { quinas: number; quadras: number } {
  let quinas = 0
  let quadras = 0
  for (let i = 0; i < m.lo.length; i++) {
    const h = popcount32(jogoLo & m.lo[i]) + popcount32(jogoHi & m.hi[i])
    if (h >= 5) quinas++
    if (h >= 4) quadras++
  }
  return { quinas, quadras }
}
