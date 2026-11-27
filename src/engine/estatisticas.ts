// Estatísticas sobre os sorteios de um período (SPEC 10). Funções puras.
//
// AVISO que a tela precisa mostrar junto: estatísticas de sorteios passados NÃO aumentam a probabilidade
// de acerto. Servem para descrever o passado, não para "prever".
import { percentil, somasDosSorteios, type ConcursoHist } from './historico'

/** Maior sequência de números consecutivos num conjunto de dezenas (ex.: 7-8-9 = 3). */
export function maiorSequencia(dezenas: readonly number[]): number {
  const d = [...dezenas].sort((a, b) => a - b)
  let melhor = d.length > 0 ? 1 : 0
  let atual = 1
  for (let i = 1; i < d.length; i++) {
    atual = d[i] === d[i - 1] + 1 ? atual + 1 : 1
    if (atual > melhor) melhor = atual
  }
  return melhor
}

/** Quantos sorteios tiveram 0, 1, …, 6 dezenas pares. Índice = nº de pares. */
export function distribuicaoPares(concursos: readonly ConcursoHist[]): number[] {
  const r = new Array<number>(7).fill(0)
  for (const c of concursos) r[c.dezenas.filter((d) => d % 2 === 0).length]++
  return r
}

/** Quantos sorteios tiveram a maior sequência de consecutivos igual a 1 … 6. Índice = tamanho (0 não é usado). */
export function distribuicaoConsecutivos(concursos: readonly ConcursoHist[]): number[] {
  const r = new Array<number>(7).fill(0)
  for (const c of concursos) r[maiorSequencia(c.dezenas)]++
  return r
}

/** Linha do volante (0 = 1–10, 1 = 11–20, … 5 = 51–60) de uma dezena. */
export const linhaDoVolante = (d: number): number => Math.floor((d - 1) / 10)

/** Quantas dezenas já saíram em cada linha do volante (6 posições). */
export function totaisPorLinha(concursos: readonly ConcursoHist[]): number[] {
  const r = new Array<number>(6).fill(0)
  for (const c of concursos) for (const d of c.dezenas) r[linhaDoVolante(d)]++
  return r
}

/** Quantos sorteios tiveram, no máximo, 1 … 6 dezenas numa mesma linha. Índice = máximo por linha (0 não é usado). */
export function distribuicaoMaxPorLinha(concursos: readonly ConcursoHist[]): number[] {
  const r = new Array<number>(7).fill(0)
  for (const c of concursos) {
    const por = new Array<number>(6).fill(0)
    for (const d of c.dezenas) por[linhaDoVolante(d)]++
    r[Math.max(...por)]++
  }
  return r
}

export interface ResumoSoma {
  min: number
  p10: number
  mediana: number
  p90: number
  max: number
  media: number
}

/** Resumo da soma das 6 dezenas dos sorteios do período; sem sorteios devolve null. */
export function resumoSoma(concursos: readonly ConcursoHist[]): ResumoSoma | null {
  if (concursos.length === 0) return null
  const somas = somasDosSorteios(concursos)
  return {
    min: Math.min(...somas),
    p10: percentil(somas, 10),
    mediana: percentil(somas, 50),
    p90: percentil(somas, 90),
    max: Math.max(...somas),
    media: somas.reduce((s, v) => s + v, 0) / somas.length,
  }
}
