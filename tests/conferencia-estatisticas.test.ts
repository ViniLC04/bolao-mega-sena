import { describe, expect, it } from 'vitest'
import { conferirBolao, valorDoParticipante } from '../src/engine/conferencia'
import {
  distribuicaoConsecutivos,
  distribuicaoMaxPorLinha,
  distribuicaoPares,
  maiorSequencia,
  resumoSoma,
  totaisPorLinha,
} from '../src/engine/estatisticas'
import { REGRAS } from './vectors/regras-teste'

// Concurso 2955 (Virada 2025): 09-13-21-32-33-59; quina R$ 11.931,42; quadra R$ 216,76; sena 6 × R$ 181.892.881,09
const C2955 = { dezenas: [9, 13, 21, 32, 33, 59], rateio: { senaCent: 18_189_288_109, quinaCent: 1_193_142, quadraCent: 21_676 } }
// Concurso 3086 (15/11/2026): 03-20-35-38-43-46; quina R$ 32.785,73; quadra R$ 811,98; sena sem ganhador
const C3086 = { dezenas: [3, 20, 35, 38, 43, 46], rateio: { senaCent: 0, quinaCent: 3_278_573, quadraCent: 81_198 } }

describe('conferência do bolão com o rateio oficial', () => {
  it('2955: jogo de 7 dezenas com 5 acertos = R$ 24.946,64 bruto e R$ 17.462,65 líquido', () => {
    const c = conferirBolao([{ jogos: [[9, 13, 21, 32, 33, 1, 2]] }], C2955.dezenas, C2955.rateio, 20, REGRAS)
    expect(c.melhorAcerto).toBe(5)
    expect(c.apostasPremiadas).toEqual({ sena: 0, quina: 2, quadra: 5 })
    expect(c.brutoCent).toBe(2_494_664)
    expect(c.liquidoCent).toBe(1_746_265)
    expect(c.porCotaCent).toBe(87_313) // 1.746.265 ÷ 20, para baixo
    expect(c.restoCaixinhaCent).toBe(5)
    expect(c.ganhou).toBe(true)
    expect(valorDoParticipante(3, c)).toBe(261_939)
  })
  it('3086: quadra de uma aposta simples e quina de outra', () => {
    const quadra = conferirBolao([{ jogos: [[3, 20, 35, 38, 1, 2]] }], C3086.dezenas, C3086.rateio, 10, REGRAS)
    expect(quadra.brutoCent).toBe(81_198)
    expect(quadra.liquidoCent).toBe(56_839) // IR de 30% = 24.359
    const quina = conferirBolao([{ jogos: [[3, 20, 35, 38, 43, 1]] }], C3086.dezenas, C3086.rateio, 10, REGRAS)
    expect(quina.brutoCent).toBe(3_278_573)
  })
  it('vários recibos: soma o valor por cota de cada recibo (cada um arredondado para baixo)', () => {
    const c = conferirBolao(
      [{ jogos: [[3, 20, 35, 38, 1, 2]] }, { jogos: [[3, 20, 35, 38, 1, 2]] }],
      C3086.dezenas, C3086.rateio, 7, REGRAS,
    )
    expect(c.recibos.length).toBe(2)
    expect(c.liquidoCent).toBe(2 * 56_839)
    expect(c.porCotaCent).toBe(2 * Math.floor(56_839 / 7))
    expect(c.restoCaixinhaCent).toBe(c.liquidoCent - c.porCotaCent * 7)
  })
  it('sem acertos premiados: não ganhou', () => {
    const c = conferirBolao([{ jogos: [[1, 2, 4, 5, 6, 7]] }], C3086.dezenas, C3086.rateio, 10, REGRAS)
    expect(c.ganhou).toBe(false)
    expect(c.brutoCent).toBe(0)
    expect(c.porCotaCent).toBe(0)
  })
})

describe('estatísticas do período', () => {
  const hist = [
    { numero: 1, data: '2020-01-01', dezenas: [1, 2, 3, 10, 11, 12] }, // 3 pares: 2,10,12; sequência 3
    { numero: 2, data: '2020-01-02', dezenas: [5, 15, 25, 35, 45, 55] }, // 0 pares; sequência 1; 1 por linha
    { numero: 3, data: '2020-01-03', dezenas: [2, 4, 6, 8, 9, 10] }, // 5 pares; sequência 2 (8-9-10 = 3)
  ]
  it('maior sequência', () => {
    expect(maiorSequencia([1, 2, 3, 10, 11, 12])).toBe(3)
    expect(maiorSequencia([5, 15, 25])).toBe(1)
    expect(maiorSequencia([])).toBe(0)
    expect(maiorSequencia([12, 10, 11, 40])).toBe(3)
  })
  it('pares e ímpares', () => {
    expect(distribuicaoPares(hist)).toEqual([1, 0, 0, 1, 0, 1, 0])
  })
  it('consecutivos', () => {
    expect(distribuicaoConsecutivos(hist)).toEqual([0, 1, 0, 2, 0, 0, 0])
  })
  it('linhas do volante', () => {
    // linha 1–10: 4 + 1 + 6 = 11; linha 11–20: 2 + 1 = 3; as outras 4 linhas: 1 cada (só o sorteio 2)
    expect(totaisPorLinha(hist)).toEqual([11, 3, 1, 1, 1, 1])
    // máximo por linha em cada sorteio: 4, 1 e 6
    expect(distribuicaoMaxPorLinha(hist)).toEqual([0, 1, 0, 0, 1, 0, 1])
  })
  it('soma', () => {
    const s = resumoSoma(hist)!
    // somas: 39, 180 e 39
    expect(s.min).toBe(39)
    expect(s.max).toBe(180)
    expect(s.mediana).toBe(39)
    expect(s.media).toBeCloseTo(86, 6)
    expect(resumoSoma([])).toBeNull()
  })
})
