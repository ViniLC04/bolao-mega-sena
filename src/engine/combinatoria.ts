// Motor de regras — funções puras (sem rede, sem banco, sem tela).

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

/** Preço em CENTAVOS de um jogo de k dezenas. O preço da aposta simples vem de rules.json. */
export function precoJogo(k: number, precoApostaSimplesCent: number): number {
  return combinacoes(k, 6) * precoApostaSimplesCent
}
