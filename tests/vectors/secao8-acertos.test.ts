// Vetores do SPEC seção 8 (conferência e rateio).
import { describe, expect, it } from 'vitest'
import {
  brutoDoJogo,
  conferirRecibo,
  contarAcertos,
  decomporAcertos,
  impostoDeRenda,
  liquido,
  type RateioOficial,
} from '../../src/engine/acertos'
import { combinacoes } from '../../src/engine/combinatoria'
import { REGRAS } from './regras-teste'

// Concurso 2955 (Virada 2025, sorteio em 01/01/2026), valores oficiais da seção 9.5, em centavos.
const SORTEADAS_2955 = [9, 13, 21, 32, 33, 59]
const RATEIO_2955: RateioOficial = { senaCent: 18_189_288_109, quinaCent: 1_193_142, quadraCent: 21_676 }

describe('8.1 decomposição em apostas simples (tabela do SPEC)', () => {
  // [k, h, sena, quina, quadra]
  const tabela: [number, number, number, number, number][] = [
    [6, 5, 0, 1, 0],
    [7, 5, 0, 2, 5],
    [8, 5, 0, 3, 15],
    [7, 6, 1, 6, 0],
    [8, 6, 1, 12, 15],
    [10, 4, 0, 0, 15],
  ]
  it.each(tabela)('k=%i com %i acertos → sena %i, quina %i, quadra %i', (k, h, sena, quina, quadra) => {
    expect(decomporAcertos(k, h)).toEqual({ sena, quina, quadra })
  })

  it('confere por força bruta: conta, aposta a aposta, os subconjuntos de 6 dezenas do jogo', () => {
    const sorteadas = [1, 2, 3, 4, 5, 6]
    for (const k of [6, 7, 8, 9, 10, 12]) {
      for (let h = 0; h <= 6 && h <= k; h++) {
        // jogo com exatamente h dezenas sorteadas + (k-h) não sorteadas
        const jogo = [...sorteadas.slice(0, h), ...Array.from({ length: k - h }, (_, i) => 20 + i)]
        const contagem = { sena: 0, quina: 0, quadra: 0 }
        const escolhe = (de: number, atual: number[]) => {
          if (atual.length === 6) {
            const acertos = contarAcertos(atual, sorteadas)
            if (acertos === 6) contagem.sena++
            else if (acertos === 5) contagem.quina++
            else if (acertos === 4) contagem.quadra++
            return
          }
          for (let i = de; i < jogo.length; i++) escolhe(i + 1, [...atual, jogo[i]])
        }
        escolhe(0, [])
        // A decomposição do SPEC conta apostas com EXATAMENTE 6, 5 ou 4 acertos (sem somar prêmios
        // "contidos" uns nos outros), então bate direto com a contagem aposta a aposta.
        expect(decomporAcertos(k, h)).toEqual(contagem)
      }
    }
  })

  it('uma aposta simples com 6 acertos é só 1 sena; com 5, só 1 quina; com 4, só 1 quadra', () => {
    expect(decomporAcertos(6, 6)).toEqual({ sena: 1, quina: 0, quadra: 0 })
    expect(decomporAcertos(6, 5)).toEqual({ sena: 0, quina: 1, quadra: 0 })
    expect(decomporAcertos(6, 4)).toEqual({ sena: 0, quina: 0, quadra: 1 })
  })

  it('as apostas premiadas nunca passam de C(k,6) (quantas apostas simples o jogo tem)', () => {
    for (let k = 6; k <= 20; k++) {
      for (let h = 0; h <= 6; h++) {
        const d = decomporAcertos(k, h)
        expect(d.sena + d.quina + d.quadra).toBeLessThanOrEqual(combinacoes(k, 6))
      }
    }
  })
})

describe('8.2 valor: vetor do concurso 2955', () => {
  it('7 dezenas com 5 acertos = 2×R$11.931,42 + 5×R$216,76 = R$24.946,64 bruto', () => {
    expect(brutoDoJogo(7, 5, RATEIO_2955)).toBe(2_494_664)
  })

  it('líquido de R$17.462,65 (IR de 30%, arredondado para o centavo mais próximo)', () => {
    expect(impostoDeRenda(2_494_664, REGRAS)).toBe(748_399)
    expect(liquido(2_494_664, REGRAS)).toBe(1_746_265)
  })

  it('um jogo sem acertos relevantes não vale nada', () => {
    expect(brutoDoJogo(7, 3, RATEIO_2955)).toBe(0)
    expect(brutoDoJogo(6, 0, RATEIO_2955)).toBe(0)
  })

  it('sena de 7 dezenas: 1 sena + 6 quinas', () => {
    expect(brutoDoJogo(7, 6, RATEIO_2955)).toBe(18_189_288_109 + 6 * 1_193_142)
  })
})

describe('imposto de renda: parâmetros editáveis e arredondamento', () => {
  it('meio centavo sobe; abaixo de meio centavo desce', () => {
    expect(impostoDeRenda(1, REGRAS)).toBe(0) // 0,3 centavo
    expect(impostoDeRenda(2, REGRAS)).toBe(1) // 0,6 centavo
    expect(impostoDeRenda(5, REGRAS)).toBe(2) // 1,5 centavo
  })
  it('ir_valor_isento: só incide sobre o que passa do isento [PENDENTE]', () => {
    const r = { ...REGRAS, ir_valor_isento: 1_000 }
    expect(impostoDeRenda(5_000, r)).toBe(1_200) // 30% de 4.000
    expect(impostoDeRenda(900, r)).toBe(0)
  })
  it('a alíquota vem das regras', () => {
    const r = { ...REGRAS, ir_aliquota_bp: 1_000 }
    expect(liquido(100_000, r)).toBe(90_000)
  })
})

describe('conferirRecibo (bruto, líquido e por cota)', () => {
  it('recibo com um jogo de 7 dezenas e 5 acertos, N=10: líquido R$17.462,65 → R$1.746,26 por cota, resto 5 centavos', () => {
    const jogo7 = [9, 13, 21, 32, 33, 40, 41] // 5 das sorteadas (falta a 59)
    const semAcerto = [1, 2, 3, 4, 5, 6, 7]
    const res = conferirRecibo([jogo7, semAcerto], SORTEADAS_2955, RATEIO_2955, 10, REGRAS)
    expect(res.acertosPorJogo).toEqual([5, 0])
    expect(res.apostasPremiadas).toEqual({ sena: 0, quina: 2, quadra: 5 })
    expect(res.brutoCent).toBe(2_494_664)
    expect(res.irCent).toBe(748_399)
    expect(res.liquidoCent).toBe(1_746_265)
    expect(res.porCotaCent).toBe(174_626)
    expect(res.restoCaixinhaCent).toBe(5)
  })

  it('o que o participante recebe somado a todas as cotas + resto = líquido do recibo', () => {
    for (const n of [2, 7, 20, 33, 100]) {
      const res = conferirRecibo([[9, 13, 21, 32, 33, 59, 60]], SORTEADAS_2955, RATEIO_2955, n, REGRAS)
      expect(res.porCotaCent * n + res.restoCaixinhaCent).toBe(res.liquidoCent)
    }
  })

  it('sem prêmio: tudo zero', () => {
    const res = conferirRecibo([[1, 2, 3, 4, 5, 6]], SORTEADAS_2955, RATEIO_2955, 10, REGRAS)
    expect(res).toMatchObject({ brutoCent: 0, irCent: 0, liquidoCent: 0, porCotaCent: 0, restoCaixinhaCent: 0 })
  })
})
