// Vetores do SPEC seção 7 (probabilidades).
import { describe, expect, it } from 'vitest'
import { TOTAL_COMBINACOES, umEm } from '../../src/engine/combinatoria'
import {
  chancesApostaSimples,
  combinacoesDistintas,
  distribuicaoAcertos,
  enumeracaoExata,
  monteCarlo,
  monteCarloComSemente,
  probabilidadeSena,
  rankCombinacao,
} from '../../src/engine/probabilidades'
import { criarRng, sortearDezenas } from '../../src/engine/random'

describe('7 fórmulas exatas', () => {
  it('total de combinações: C(60,6) = 50.063.860', () => {
    expect(TOTAL_COMBINACOES).toBe(50_063_860)
  })

  it('329 combinações → sena 1 em 152.170', () => {
    expect(umEm(329)).toBe(152_170)
    expect(probabilidadeSena(329)).toBeCloseTo(329 / 50_063_860, 12)
  })

  it('aposta simples: sena 1 em 50.063.860; quina 324/50.063.860 (1 em 154.518); quadra 21.465/50.063.860 (1 em 2.332)', () => {
    const c = chancesApostaSimples()
    expect(c.sena).toEqual({ combinacoes: 1, umEm: 50_063_860 })
    expect(c.quina).toEqual({ combinacoes: 324, umEm: 154_518 })
    expect(c.quadra).toEqual({ combinacoes: 21_465, umEm: 2_332 })
  })

  it('hipergeométrica C(k,h)·C(60−k,6−h)/C(60,6): soma 1 para todo k de 6 a 20', () => {
    for (let k = 6; k <= 20; k++) {
      const d = distribuicaoAcertos(k)
      expect(d.reduce((s, l) => s + l.sorteios, 0)).toBe(TOTAL_COMBINACOES)
      expect(d.reduce((s, l) => s + l.probabilidade, 0)).toBeCloseTo(1, 12)
    }
  })

  it('jogo de 6 dezenas: 1 sena, 324 quinas, 21.465 quadras; de 7 dezenas: 7, 1.113 e 48.230', () => {
    const d6 = distribuicaoAcertos(6)
    expect([d6[6].sorteios, d6[5].sorteios, d6[4].sorteios]).toEqual([1, 324, 21_465])
    const d7 = distribuicaoAcertos(7)
    expect([d7[6].sorteios, d7[5].sorteios, d7[4].sorteios]).toEqual([7, 1_113, 48_230])
  })
})

describe('combinações distintas (descontando sobreposição)', () => {
  it('um jogo de k dezenas cobre C(k,6): 1, 7, 28, 84, 210', () => {
    expect([6, 7, 8, 9, 10].map((k) => combinacoesDistintas([Array.from({ length: k }, (_, i) => i + 1)]))).toEqual([1, 7, 28, 84, 210])
  })

  it('jogos repetidos não contam duas vezes; jogos de 7 dezenas que dividem 6 dezenas repetem 1 combinação', () => {
    const a = [1, 2, 3, 4, 5, 6, 7]
    expect(combinacoesDistintas([a, [...a]])).toBe(7)
    expect(combinacoesDistintas([a, [1, 2, 3, 4, 5, 6, 8]])).toBe(13) // {1..6} é comum
    expect(combinacoesDistintas([a, [8, 9, 10, 11, 12, 13, 14]])).toBe(14) // disjuntos
    expect(combinacoesDistintas([a, [1, 2, 3, 4, 5, 8, 9]])).toBe(14) // 5 em comum: nenhuma combinação repetida
  })

  it('o rank é único e vai de 0 a C(60,6)−1', () => {
    expect(rankCombinacao([1, 2, 3, 4, 5, 6])).toBe(0)
    expect(rankCombinacao([55, 56, 57, 58, 59, 60])).toBe(TOTAL_COMBINACOES - 1)
    const rng = criarRng(7)
    const vistos = new Set<number>()
    for (let i = 0; i < 2_000; i++) vistos.add(rankCombinacao(sortearDezenas(rng, 6)))
    expect(vistos.size).toBeGreaterThan(1_990) // colisões só se o sorteio repetir (muito raro)
  })

  it('exemplo do SPEC: 7×7dez + 10×8dez = 329 combinações quando não há repetição', () => {
    const rng = criarRng(2026)
    const jogos = [...Array.from({ length: 7 }, () => sortearDezenas(rng, 7)), ...Array.from({ length: 10 }, () => sortearDezenas(rng, 8))]
    const soma = 7 * 7 + 10 * 28
    expect(soma).toBe(329)
    // com sorteios aleatórios é improvável dividir 6 dezenas; o motor devolve exatamente 329 nesse caso
    expect(combinacoesDistintas(jogos)).toBe(329)
  })
})

describe('Monte Carlo (≥ 2 milhões de sorteios, rótulo aproximado)', () => {
  const faixa = (jogos: number[][]) => {
    // soma das probabilidades individuais de "pelo menos uma quadra" (limite superior da união)
    return jogos.reduce((s, j) => {
      const d = distribuicaoAcertos(j.length)
      return s + d[4].probabilidade + d[5].probabilidade + d[6].probabilidade
    }, 0)
  }

  it('exemplo 1 do SPEC: 2 recibos (7×7dez + 10×8dez) → P(≥1 quadra) ≈ 2,6%', () => {
    const rng = criarRng(11)
    const jogos = [...Array.from({ length: 7 }, () => sortearDezenas(rng, 7)), ...Array.from({ length: 10 }, () => sortearDezenas(rng, 8))]
    const r = monteCarloComSemente(jogos, 101)
    expect(r.tipo).toBe('aproximado')
    expect(r.sorteios).toBe(2_000_000)
    expect(r.quadra.p).toBeGreaterThan(0.024)
    expect(r.quadra.p).toBeLessThan(0.028)
    expect(r.quadra.p).toBeLessThanOrEqual(faixa(jogos) + 3 * r.quadra.margem95)
  })

  it('exemplo 2 do SPEC: 3 recibos com 1×10dez (1×10dez + 10×7dez + 7×7dez) → ≈ 2,2%', () => {
    const rng = criarRng(12)
    const jogos = [sortearDezenas(rng, 10), ...Array.from({ length: 17 }, () => sortearDezenas(rng, 7))]
    const r = monteCarloComSemente(jogos, 102)
    expect(r.quadra.p).toBeGreaterThan(0.019)
    expect(r.quadra.p).toBeLessThan(0.025)
  })

  it('exemplo 3 do SPEC: 47×7dez → ≈ 4,5%', () => {
    const rng = criarRng(13)
    const jogos = Array.from({ length: 47 }, () => sortearDezenas(rng, 7))
    const r = monteCarloComSemente(jogos, 103)
    expect(r.quadra.p).toBeGreaterThan(0.042)
    expect(r.quadra.p).toBeLessThan(0.048)
  })

  it('quadra ≥ quina ≥ sena (cada faixa inclui a de cima) e a margem de erro é positiva', () => {
    const rng = criarRng(14)
    const jogos = Array.from({ length: 20 }, () => sortearDezenas(rng, 7))
    const r = monteCarloComSemente(jogos, 104, 500_000)
    expect(r.quadra.p).toBeGreaterThanOrEqual(r.quina.p)
    expect(r.quina.p).toBeGreaterThanOrEqual(r.sena.p)
    expect(r.quadra.margem95).toBeGreaterThan(0)
  })

  it('com a mesma semente dá exatamente o mesmo resultado; com outra, muda', () => {
    const rng = criarRng(15)
    const jogos = Array.from({ length: 10 }, () => sortearDezenas(rng, 8))
    const a = monteCarloComSemente(jogos, 5, 300_000)
    const b = monteCarloComSemente(jogos, 5, 300_000)
    const c = monteCarloComSemente(jogos, 6, 300_000)
    expect(a).toEqual(b)
    expect(a.quadra.sorteios).not.toBe(c.quadra.sorteios)
  })

  it('informa o progresso de 0 a 1 (para a barra do Worker)', () => {
    const marcas: number[] = []
    monteCarlo([[1, 2, 3, 4, 5, 6]], { sorteios: 200_000, rng: criarRng(1), onProgresso: (f) => marcas.push(f) })
    expect(marcas.length).toBe(100)
    expect(marcas[marcas.length - 1]).toBe(1)
    expect([...marcas].sort((x, y) => x - y)).toEqual(marcas)
  })
})

describe('enumeração exata dos 50.063.860 sorteios', () => {
  it('um jogo de 7 dezenas: exatamente 7 senas, 1.120 quinas+ e 49.350 quadras+', () => {
    const r = enumeracaoExata([[1, 2, 3, 4, 5, 6, 7]])
    expect(r.tipo).toBe('exato')
    expect(r.sorteios).toBe(TOTAL_COMBINACOES)
    expect(r.sena.sorteios).toBe(7)
    expect(r.quina.sorteios).toBe(1_113 + 7)
    expect(r.quadra.sorteios).toBe(48_230 + 1_113 + 7)
    expect(r.quadra.margem95).toBe(0)
  }, 120_000)

  it('dois jogos de 6 dezenas disjuntos: 2 senas e 2×(1+324+21.465) quadras+; e o Monte Carlo concorda', () => {
    const jogos = [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]]
    const marcas: number[] = []
    const r = enumeracaoExata(jogos, { onProgresso: (f) => marcas.push(f) })
    expect(r.sena.sorteios).toBe(2)
    expect(r.quina.sorteios).toBe(2 * (1 + 324))
    expect(r.quadra.sorteios).toBe(2 * (1 + 324 + 21_465))
    expect(marcas[marcas.length - 1]).toBeCloseTo(1, 12)
    expect([...marcas].sort((x, y) => x - y)).toEqual(marcas)

    const mc = monteCarloComSemente(jogos, 77)
    expect(Math.abs(mc.quadra.p - r.quadra.p)).toBeLessThan(4 * mc.quadra.margem95)
  }, 120_000)
})
