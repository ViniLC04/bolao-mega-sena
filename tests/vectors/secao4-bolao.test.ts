// Vetores do SPEC seção 4.1 a 4.3 (matemática do bolão).
import { describe, expect, it } from 'vitest'
import {
  cotaDeTotal,
  opcoesRecibo,
  opcoesValidasParaN,
  piso,
  precoJogo,
  temCentavosQuebrados,
  totalMinimo,
  totalRecibo,
  totalValidoParaN,
} from '../../src/engine/bolao'
import { REGRAS } from './regras-teste'

describe('4.1 preço de um jogo', () => {
  it('6→R$6; 7→R$42; 8→R$168; 9→R$504; 10→R$1.260', () => {
    expect([6, 7, 8, 9, 10].map((k) => precoJogo(k, REGRAS))).toEqual([600, 4_200, 16_800, 50_400, 126_000])
  })
  it('segue o preço da aposta simples das regras (nada fixo no código)', () => {
    expect(precoJogo(7, { ...REGRAS, preco_aposta_simples: 700 })).toBe(4_900)
  })
})

describe('4.2 totais e validade do recibo', () => {
  it('T(k,g) = preço(k) × g', () => {
    expect(totalRecibo(7, 2, REGRAS)).toBe(8_400)
    expect(totalRecibo(6, 10, REGRAS)).toBe(6_000)
  })

  it('o conjunto de composições vai de 6 a 20 dezenas e de 1 a 10 jogos', () => {
    const todas = opcoesRecibo(REGRAS)
    expect(todas.length).toBe(15 * 10)
    expect(Math.min(...todas.map((o) => o.k))).toBe(6)
    expect(Math.max(...todas.map((o) => o.k))).toBe(20)
  })

  it('válido quando 2 ≤ N ≤ 100, T ≥ R$18 e T/N ≥ R$7', () => {
    expect(totalValidoParaN(1_800, 2, REGRAS)).toBe(true)
    expect(totalValidoParaN(1_799, 2, REGRAS)).toBe(false) // abaixo do mínimo de R$18
    expect(totalValidoParaN(4_200, 6, REGRAS)).toBe(true) // 4200/6 = 700 exato
    expect(totalValidoParaN(4_199, 6, REGRAS)).toBe(false) // cota abaixo de R$7
    expect(totalValidoParaN(8_400, 1, REGRAS)).toBe(false) // N < 2
    expect(totalValidoParaN(840_000, 101, REGRAS)).toBe(false) // N > 100
  })

  it('jogos de 6 dezenas só servem até N=8', () => {
    for (let n = 2; n <= 100; n++) {
      const temSeis = opcoesValidasParaN(n, REGRAS).some((o) => o.k === 6)
      expect(temSeis).toBe(n <= 8)
    }
  })

  it('a partir de N=9 os totais são múltiplos de R$ 42 (exceto 13 e 20 dezenas — achado da Fase 1)', () => {
    // O SPEC afirma "todos os totais". Conferido: C(13,6)=1716 e C(20,6)=38760 não são múltiplos de 7,
    // então com 13 ou 20 dezenas o total só é múltiplo de R$ 42 quando o nº de jogos é múltiplo de 7.
    // Registrado em docs/pendencias.md.
    for (const n of [9, 10, 24, 64, 100]) {
      for (const o of opcoesValidasParaN(n, REGRAS)) {
        if (o.k === 13 || o.k === 20) {
          expect(o.total % 4_200 === 0).toBe(o.g % 7 === 0)
        } else {
          expect(o.total % 4_200).toBe(0)
        }
      }
    }
  })
})

describe('4.3 Piso, total mínimo e cota mínima (tabela do SPEC)', () => {
  it('Piso(N) = max(1800, 700×N)', () => {
    expect(piso(2, REGRAS)).toBe(1_800)
    expect(piso(3, REGRAS)).toBe(2_100)
    expect(piso(100, REGRAS)).toBe(70_000)
  })

  // [N, total, jogos g, dezenas k, cota em centavos, centavos quebrados?]
  // N=7: o SPEC publicava 7,71; a regra escrita ("para cima") dá 7,72 (e N=9, 9,34, só fecha com "para cima").
  // N=64: 50400/64 = 787,5 centavos → também tem centavo quebrado (o SPEC não marcava com *).
  const tabela: [number, number, number, number, number, boolean][] = [
    [2, 1_800, 3, 6, 900, false],
    [3, 2_400, 4, 6, 800, false],
    [4, 3_000, 5, 6, 750, false],
    [5, 3_600, 6, 6, 720, false],
    [6, 4_200, 7, 6, 700, false],
    [7, 5_400, 9, 6, 772, true],
    [8, 6_000, 10, 6, 750, false],
    [9, 8_400, 2, 7, 934, true],
    [10, 8_400, 2, 7, 840, false],
    [12, 8_400, 2, 7, 700, false],
    [15, 12_600, 3, 7, 840, false],
    [20, 16_800, 4, 7, 840, false],
    [30, 21_000, 5, 7, 700, false],
    [50, 37_800, 9, 7, 756, false],
    [60, 42_000, 10, 7, 700, false],
    [64, 50_400, 3, 8, 788, true],
    [100, 84_000, 5, 8, 840, false],
  ]

  it.each(tabela)('N=%i → total %i, %i jogo(s) de %i dezenas, cota %i', (n, total, g, k, cota, quebrado) => {
    const r = totalMinimo(n, REGRAS)!
    expect(r.total).toBe(total)
    expect(r.opcao.g).toBe(g)
    expect(r.opcao.k).toBe(k)
    expect(r.cotaCent).toBe(cota)
    expect(r.avisoCentavos).toBe(quebrado)
  })

  it('N=6: o total R$42 também é 1×7dez; vale o desempate por menor k (7×6dez)', () => {
    const r = totalMinimo(6, REGRAS)!
    expect(r.opcao).toMatchObject({ k: 6, g: 7, total: 4_200 })
  })

  it('N fora de 2..100 não tem recibo', () => {
    expect(totalMinimo(1, REGRAS)).toBeNull()
    expect(totalMinimo(101, REGRAS)).toBeNull()
  })

  it('sempre a cota mínima cobre o total (nunca falta dinheiro)', () => {
    for (let n = 2; n <= 100; n++) {
      const r = totalMinimo(n, REGRAS)!
      expect(r.cotaCent * n).toBeGreaterThanOrEqual(r.total)
      expect(r.cotaCent * n - r.total).toBeLessThan(n) // sobra menor que 1 centavo por cota
    }
  })
})

describe('arredondamento da cota (parâmetro editável)', () => {
  it('para cima, para baixo e para o mais próximo', () => {
    expect(cotaDeTotal(5_400, 7, 'cima')).toBe(772) // 771,43
    expect(cotaDeTotal(5_400, 7, 'baixo')).toBe(771)
    expect(cotaDeTotal(5_400, 7, 'proximo')).toBe(771)
    expect(cotaDeTotal(8_400, 9, 'proximo')).toBe(933) // 933,33
    expect(cotaDeTotal(50_400, 64, 'proximo')).toBe(788) // 787,5 → meio centavo sobe
    expect(cotaDeTotal(8_400, 10, 'cima')).toBe(840) // exato
  })
  it('detecta centavos quebrados', () => {
    expect(temCentavosQuebrados(8_400, 10)).toBe(false)
    expect(temCentavosQuebrados(8_400, 9)).toBe(true)
  })
  it('totalMinimo respeita a regra de arredondamento das regras', () => {
    const baixo = { ...REGRAS, arredondamento_cota: 'baixo' as const }
    expect(totalMinimo(7, baixo)!.cotaCent).toBe(771)
  })
})
