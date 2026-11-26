// Gerador pseudoaleatório com semente (mulberry32). Serve para testes reproduzíveis e para o
// Monte Carlo: com a mesma semente, o resultado é sempre o mesmo. Sem rede, sem relógio.

/** Devolve uma função que gera números em [0, 1), sempre na mesma sequência para a mesma semente. */
export function criarRng(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Inteiro em [0, max). */
export function inteiroAte(rng: () => number, max: number): number {
  return Math.floor(rng() * max)
}

/** `k` dezenas distintas de 1 a `universo`, em ordem crescente. */
export function sortearDezenas(rng: () => number, k: number, universo = 60): number[] {
  const pool = Array.from({ length: universo }, (_, i) => i + 1)
  for (let i = 0; i < k; i++) {
    const j = i + inteiroAte(rng, universo - i)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, k).sort((a, b) => a - b)
}
