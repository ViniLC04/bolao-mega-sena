// Motor de regras — funções puras (sem rede, sem banco, sem tela).

/** Estrutura do jogo (não é "regra oficial" que muda): 60 dezenas, 6 sorteadas. */
export const DEZENAS_UNIVERSO = 60
export const DEZENAS_SORTEADAS = 6

/** Combinações C(n, k). Resultado exato para os valores usados na Mega-Sena. */
export function combinacoes(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0 || k > n) return 0
  const m = Math.min(k, n - k)
  let r = 1
  for (let i = 1; i <= m; i++) {
    r = (r * (n - m + i)) / i
  }
  return Math.round(r)
}

/** Total de combinações da Mega-Sena: C(60,6) = 50.063.860. */
export const TOTAL_COMBINACOES = combinacoes(DEZENAS_UNIVERSO, DEZENAS_SORTEADAS)

/**
 * "1 em quantos": chance de sena de quem cobre `combinacoesDistintas` combinações de 6 dezenas.
 * Ex.: 329 combinações → 1 em 152.170 (SPEC seção 7).
 */
export function umEm(combinacoesDistintas: number): number {
  if (!(combinacoesDistintas > 0)) return Infinity
  return Math.round(TOTAL_COMBINACOES / combinacoesDistintas)
}
