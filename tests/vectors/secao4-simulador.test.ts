// Vetores do SPEC seção 4.4 (simulador, 3 modos).
import { describe, expect, it } from 'vitest'
import { opcoesValidasParaN, totalValidoParaN, type OpcaoRecibo } from '../../src/engine/bolao'
import {
  combinacoesCobertas,
  melhorComposicao,
  simularInverso,
  simularPorCotas,
  simularPorValor,
  tabelaPorCota,
  type PerfilSimulador,
} from '../../src/engine/simulador'
import { REGRAS } from './regras-teste'

const comp = (l: { recibos: { g: number; k: number }[] }) => l.recibos.map((o) => `${o.g}x${o.k}`).sort().join('+')

describe('modo 4: tabela por cota fixa', () => {
  it('cota R$56, N=20: arrecada R$1.120; o máximo em jogos é R$1.092 (sobra R$28)', () => {
    const l20 = tabelaPorCota(5_600, REGRAS).find((x) => x.n === 20)!
    expect(l20.arrecadadoCent).toBe(112_000)
    expect(l20.linha!.gastoCent).toBe(109_200)
    expect(l20.linha!.caixinhaCent).toBe(2_800)
  })

  it('cota R$56, N=20: R$1.116 não existe (cada recibo precisa de R$7 por cota, então os totais são múltiplos de R$42); mesmo com mais recibos o máximo é R$1.092', () => {
    const l20 = tabelaPorCota(5_600, { ...REGRAS, limite_recibos_simulador: 12 }).find((x) => x.n === 20)!
    expect(l20.linha!.gastoCent).toBe(109_200)
  })

  it('cobre N de 2 a 100, sobra nunca negativa, gasto múltiplo de R$6 e igual ao modo "por valor"', () => {
    const t = tabelaPorCota(5_600, REGRAS)
    expect(t[0].n).toBe(REGRAS.bolao_cotas_min)
    expect(t[t.length - 1].n).toBe(REGRAS.bolao_cotas_max)
    for (const x of t) {
      if (!x.linha) continue
      expect(x.linha.caixinhaCent).toBeGreaterThanOrEqual(0)
      expect(x.linha.gastoCent % REGRAS.preco_aposta_simples).toBe(0)
      expect(x.linha.gastoCent).toBeLessThanOrEqual(x.arrecadadoCent)
      expect(x.linha.gastoCent).toBe(simularPorValor({ n: x.n, cotaBaseCent: 5_600 }, REGRAS)!.gastoCent)
    }
  })

  it('cota inválida devolve tabela vazia', () => {
    expect(tabelaPorCota(0, REGRAS)).toEqual([])
    expect(tabelaPorCota(12.5, REGRAS)).toEqual([])
  })
})

describe('modo 1: por número de cotas', () => {
  it('N=20: R$168 (4×7dez), cota R$8,40, 28 apostas equivalentes, sem sobra', () => {
    const l = simularPorCotas(20, REGRAS)!
    expect(comp(l)).toBe('4x7')
    expect(l.gastoCent).toBe(16_800)
    expect(l.cotaTetoCent).toBe(840)
    expect(l.apostasEquivalentes).toBe(28)
    expect(l.jogos).toBe(4)
    expect(l.caixinhaCent).toBe(0)
    expect(l.avisoCentavos).toBe(false)
    expect(l.cobranca).toBe('cota_teto')
  })

  it('N=7: R$54, cota R$7,72, centavos quebrados → sobram 4 centavos para a caixinha', () => {
    const l = simularPorCotas(7, REGRAS)!
    expect(l.gastoCent).toBe(5_400)
    expect(l.cotaTetoCent).toBe(772)
    expect(l.arrecadacaoCent).toBe(5_404)
    expect(l.caixinhaCent).toBe(4)
    expect(l.avisoCentavos).toBe(true)
  })

  it('N inválido não simula', () => {
    expect(simularPorCotas(1, REGRAS)).toBeNull()
    expect(simularPorCotas(101, REGRAS)).toBeNull()
  })
})

describe('modo 2: por valor — vetores do SPEC', () => {
  it('N=24, cota-base R$50 → B=R$1.200; 1 recibo 7×8dez = R$1.176 (cota 49,00; sobra R$24)', () => {
    const l = simularPorValor({ n: 24, cotaBaseCent: 5_000 }, REGRAS)!
    expect(comp(l)).toBe('7x8')
    expect(l.gastoCent).toBe(117_600)
    expect(l.sobraOrcamentoCent).toBe(2_400)
    expect(l.cotaTetoCent).toBe(4_900)
    // cota fixa: cobra R$50, a sobra de R$24 vai para a caixinha
    expect(l.cobranca).toBe('cota_fixa')
    expect(l.cotaCobradaCent).toBe(5_000)
    expect(l.caixinhaCent).toBe(2_400)
  })

  it('N=24 em cota-teto: cobra R$49,00 e não sobra nada', () => {
    const l = simularPorValor({ n: 24, cotaBaseCent: 5_000, cobranca: 'cota_teto' }, REGRAS)!
    expect(l.cotaCobradaCent).toBe(4_900)
    expect(l.arrecadacaoCent).toBe(117_600)
    expect(l.caixinhaCent).toBe(0)
  })

  it('N=20, cota-base R$100 → B=R$2.000; gasto máximo R$1.974 (47 × R$42), sobra R$26, cota final 98,70, 329 apostas', () => {
    const l = simularPorValor({ n: 20, cotaBaseCent: 10_000 }, REGRAS)!
    expect(l.gastoCent).toBe(197_400)
    expect(l.gastoCent / 4_200).toBe(47)
    expect(l.sobraOrcamentoCent).toBe(2_600)
    expect(l.cotaTetoCent).toBe(9_870)
    expect(l.apostasEquivalentes).toBe(329)
    expect(l.senaUmEm).toBe(152_170) // SPEC seção 7: "1 em 152.170"
  })

  it('N=20/R$100, perfil "menos recibos": 2 recibos (7×7dez + 10×8dez), cotas 14,70 + 84,00', () => {
    const l = simularPorValor({ n: 20, cotaBaseCent: 10_000, perfil: 'menos_recibos' }, REGRAS)!
    expect(l.recibos.length).toBe(2)
    expect(comp(l)).toBe('10x8+7x7')
    expect(l.recibos.map((o) => o.cotaCent).sort((a, b) => a - b)).toEqual([1_470, 8_400])
  })

  it('N=32, cota-base R$42 → R$1.344 sem sobra (8×8dez)', () => {
    const l = simularPorValor({ n: 32, cotaBaseCent: 4_200 }, REGRAS)!
    expect(l.gastoCent).toBe(134_400)
    expect(l.sobraOrcamentoCent).toBe(0)
    expect(comp(l)).toBe('8x8')
  })

  it('sem composição possível: devolve null', () => {
    expect(simularPorValor({ n: 2, cotaBaseCent: 500 }, REGRAS)).toBeNull() // B = R$10 < R$18
    expect(simularPorValor({ n: 20, cotaBaseCent: 0 }, REGRAS)).toBeNull()
    expect(simularPorValor({ n: 1, cotaBaseCent: 5_000 }, REGRAS)).toBeNull()
  })
})

describe('modo 2: onde cada cota-base fecha sem sobra (N de 2 a 100)', () => {
  const fecham = (cotaBaseCent: number) => {
    const lista: number[] = []
    for (let n = 2; n <= 100; n++) {
      if (simularPorValor({ n, cotaBaseCent }, REGRAS)?.sobraOrcamentoCent === 0) lista.push(n)
    }
    return lista
  }

  it('R$42 fecha sem sobra de 5 a 54 cotas (e, além do que o SPEC dizia, em 2–4 e em todos os pares até 100)', () => {
    const lista = fecham(4_200)
    for (let n = 5; n <= 54; n++) expect(lista).toContain(n)
    expect([2, 3, 4]).toEqual(lista.filter((n) => n < 5))
    const acima = lista.filter((n) => n > 54)
    expect(acima).toEqual(Array.from({ length: 23 }, (_, i) => 56 + 2 * i)) // 56, 58, ..., 100
  })

  it('R$84 fecha para qualquer N', () => {
    expect(fecham(8_400).length).toBe(99)
  })

  it('R$50 só fecha em N = 3, 6, 21, 42, 84', () => {
    expect(fecham(5_000)).toEqual([3, 6, 21, 42, 84])
  })
})

describe('invariante: cada R$ 6 compra uma combinação, qualquer que seja k', () => {
  it('apostas equivalentes = combinações cobertas = gasto ÷ preço da aposta simples', () => {
    for (const [n, base] of [[20, 10_000], [24, 5_000], [32, 4_200], [10, 3_000], [64, 9_000]] as const) {
      const l = simularPorValor({ n, cotaBaseCent: base }, REGRAS)!
      expect(l.apostasEquivalentes).toBe(combinacoesCobertas(l.recibos))
      expect(l.apostasEquivalentes * REGRAS.preco_aposta_simples).toBe(l.gastoCent)
    }
  })
})

describe('modo 2: a DP confere com força bruta (N=20, B=R$2.000, até 3 recibos)', () => {
  const regras3 = { ...REGRAS, limite_recibos_simulador: 3 }
  const N = 20
  const B = 200_000
  const opcoes = opcoesValidasParaN(N, regras3).filter((o) => o.total <= B)

  // Enumera TODAS as composições de 1 a 3 recibos (força bruta, só no teste) e guarda as de maior gasto.
  let maxGasto = 0
  let empatadas: OpcaoRecibo[][] = []
  const rec = (de: number, atual: OpcaoRecibo[], soma: number) => {
    if (atual.length > 0) {
      if (soma > maxGasto) { maxGasto = soma; empatadas = [] }
      if (soma === maxGasto) empatadas.push([...atual])
    }
    if (atual.length === 3) return
    for (let i = de; i < opcoes.length; i++) {
      if (soma + opcoes[i].total > B) continue
      atual.push(opcoes[i])
      rec(i, atual, soma + opcoes[i].total)
      atual.pop()
    }
  }
  rec(0, [], 0)

  it('o gasto máximo é o mesmo', () => {
    expect(maxGasto).toBe(197_400)
    const c = melhorComposicao(N, B, 'menos_recibos', regras3)!
    expect(c.reduce((s, o) => s + o.total, 0)).toBe(maxGasto)
  })

  const jogos = (c: OpcaoRecibo[]) => c.reduce((s, o) => s + o.g, 0)
  const maiorK = (c: OpcaoRecibo[]) => Math.max(...c.map((o) => o.k))

  it.each<[PerfilSimulador, (c: OpcaoRecibo[]) => boolean]>([
    ['menos_recibos', (c) => c.length === Math.min(...empatadas.map((e) => e.length))],
    ['mais_jogos', (c) => jogos(c) === Math.max(...empatadas.map(jogos))],
    ['mais_dezenas', (c) => maiorK(c) === Math.max(...empatadas.map(maiorK))],
  ])('perfil %s escolhe uma das melhores composições empatadas', (perfil, ehMelhor) => {
    const c = melhorComposicao(N, B, perfil, regras3)!
    expect(c.reduce((s, o) => s + o.total, 0)).toBe(maxGasto)
    expect(ehMelhor(c)).toBe(true)
    // e é uma composição que realmente existe entre as empatadas
    const chaves = empatadas.map((e) => e.map((o) => `${o.k}x${o.g}`).sort().join('+'))
    expect(chaves).toContain(c.map((o) => `${o.k}x${o.g}`).sort().join('+'))
  })

  it('os perfis podem dar composições diferentes para o mesmo gasto', () => {
    const a = melhorComposicao(N, B, 'menos_recibos', REGRAS)!
    const b = melhorComposicao(N, B, 'mais_jogos', REGRAS)!
    expect(jogos(b)).toBeGreaterThanOrEqual(jogos(a))
  })
})

describe('modo 3: inverso (dado um orçamento, quantas cotas cabem) — [PREMISSA]', () => {
  it('R$840 cabe em 100 cotas (5×8dez); R$30 cabe em 4; R$20 em 2; abaixo de R$18 nada cabe', () => {
    expect(simularInverso(84_000, REGRAS).maiorN).toBe(100)
    expect(simularInverso(84_000, REGRAS).linhas.at(-1)!.gastoCent).toBe(84_000)
    expect(simularInverso(3_000, REGRAS).maiorN).toBe(4)
    expect(simularInverso(2_000, REGRAS).maiorN).toBe(2)
    expect(simularInverso(1_799, REGRAS)).toEqual({ linhas: [], maiorN: null })
  })

  it('toda linha respeita 700×N por recibo, N ≤ 100 e o orçamento', () => {
    const orcamento = 100_000
    const { linhas } = simularInverso(orcamento, REGRAS)
    expect(linhas.length).toBeGreaterThan(0)
    for (const l of linhas) {
      expect(l.gastoCent).toBeLessThanOrEqual(orcamento)
      expect(l.n).toBeLessThanOrEqual(100)
      for (const o of l.recibos) expect(totalValidoParaN(o.total, l.n, REGRAS)).toBe(true)
    }
  })

  it('orçamento grande (R$10.000) termina em tempo razoável', () => {
    const r = simularInverso(1_000_000, REGRAS)
    expect(r.maiorN).toBe(100)
    for (const l of r.linhas) expect(l.gastoCent).toBeLessThanOrEqual(1_000_000)
  }, 30_000)
})
