import { describe, expect, it } from 'vitest'
import { validarConcursoNovo, validarJogo, validarN, validarRecibo, type ConcursoCandidato } from '../../src/engine/validacoes'
import { REGRAS } from './regras-teste'

describe('validarJogo', () => {
  it('aceita 6 a 20 dezenas distintas de 1 a 60', () => {
    expect(validarJogo([1, 2, 3, 4, 5, 6], REGRAS)).toEqual([])
    expect(validarJogo([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60], REGRAS)).toEqual([])
  })
  it('recusa quantidade fora do limite', () => {
    expect(validarJogo([1, 2, 3, 4, 5], REGRAS).length).toBe(1)
    expect(validarJogo(Array.from({ length: 21 }, (_, i) => i + 1), REGRAS).length).toBe(1)
  })
  it('recusa dezena repetida, fora de 1..60 ou não inteira', () => {
    expect(validarJogo([1, 1, 2, 3, 4, 5], REGRAS).join(' ')).toMatch(/repetidas/)
    expect(validarJogo([0, 2, 3, 4, 5, 6], REGRAS).join(' ')).toMatch(/inválida/)
    expect(validarJogo([1, 2, 3, 4, 5, 61], REGRAS).join(' ')).toMatch(/inválida/)
    expect(validarJogo([1, 2, 3, 4, 5, 6.5], REGRAS).join(' ')).toMatch(/inválida/)
  })
})

describe('validarN', () => {
  it('2 a 100, inteiro', () => {
    expect(validarN(2, REGRAS)).toEqual([])
    expect(validarN(100, REGRAS)).toEqual([])
    expect(validarN(1, REGRAS).length).toBe(1)
    expect(validarN(101, REGRAS).length).toBe(1)
    expect(validarN(2.5, REGRAS).length).toBe(1)
  })
})

describe('validarRecibo (SPEC 4.2)', () => {
  it('N=2: 3 jogos de 6 dezenas = R$18 é o mínimo aceito', () => {
    expect(validarRecibo(6, 3, 2, REGRAS)).toEqual([])
    expect(validarRecibo(6, 2, 2, REGRAS).join(' ')).toMatch(/valor mínimo/) // R$12
  })
  it('N=9: 10 jogos de 6 dezenas (R$60) deixam a cota abaixo de R$7', () => {
    expect(validarRecibo(6, 10, 9, REGRAS).join(' ')).toMatch(/abaixo do mínimo/)
    expect(validarRecibo(7, 2, 9, REGRAS)).toEqual([]) // R$84
  })
  it('limites de dezenas e de jogos por recibo', () => {
    expect(validarRecibo(21, 1, 10, REGRAS).join(' ')).toMatch(/dezenas/)
    expect(validarRecibo(7, 11, 10, REGRAS).join(' ')).toMatch(/jogos/)
    expect(validarRecibo(7, 0, 10, REGRAS).join(' ')).toMatch(/jogos/)
  })
  it('N inválido também é recusado', () => {
    expect(validarRecibo(7, 2, 1, REGRAS).length).toBeGreaterThan(0)
  })
})

describe('validarConcursoNovo (SPEC 9.2)', () => {
  // Concurso 3086 (vetor da seção 9.5), valores em centavos.
  const c3087: ConcursoCandidato = {
    numero: 3087,
    data: '2026-11-17',
    dezenas: [3, 20, 35, 38, 43, 46],
    ganhadores: { sena: 0, quina: 44, quadra: 2538 },
    valoresCent: { sena: 0, quina: 3_278_573, quadra: 81_198 },
    arrecadacaoCent: 4_706_136_600,
  }

  it('aceita o próximo da sequência', () => {
    expect(validarConcursoNovo(c3087, 3086)).toEqual([])
  })
  it('recusa quem não é o próximo da sequência (lacuna ou atraso)', () => {
    expect(validarConcursoNovo({ ...c3087, numero: 3088 }, 3086).join(' ')).toMatch(/próximo concurso deveria ser o 3087/)
    expect(validarConcursoNovo({ ...c3087, numero: 3085 }, 3086).join(' ')).toMatch(/próximo concurso/)
  })
  it('NUNCA sobrescreve um concurso que já existe', () => {
    expect(validarConcursoNovo({ ...c3087, numero: 3086 }, 3086, new Set([3086])).join(' ')).toMatch(/nunca é sobrescrito/)
  })
  it('recusa dezenas repetidas, fora de 1..60 ou em quantidade errada', () => {
    expect(validarConcursoNovo({ ...c3087, dezenas: [3, 3, 35, 38, 43, 46] }, 3086).length).toBe(1)
    expect(validarConcursoNovo({ ...c3087, dezenas: [3, 20, 35, 38, 43, 61] }, 3086).length).toBe(1)
    expect(validarConcursoNovo({ ...c3087, dezenas: [3, 20, 35, 38, 43] }, 3086).length).toBe(1)
  })
  it('recusa valores negativos ou não inteiros', () => {
    expect(validarConcursoNovo({ ...c3087, arrecadacaoCent: -1 }, 3086).length).toBe(1)
    expect(validarConcursoNovo({ ...c3087, valoresCent: { ...c3087.valoresCent, quina: 10.5 } }, 3086).length).toBe(1)
    expect(validarConcursoNovo({ ...c3087, ganhadores: { ...c3087.ganhadores, sena: -1 } }, 3086).length).toBe(1)
  })
  it('banco vazio: o primeiro concurso é o 1', () => {
    expect(validarConcursoNovo({ ...c3087, numero: 1 }, 0)).toEqual([])
  })
})
