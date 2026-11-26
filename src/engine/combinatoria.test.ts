import { describe, expect, it } from 'vitest'
import { combinacoes, TOTAL_COMBINACOES } from './combinatoria'

describe('combinatória', () => {
  it('C(60,6) = 50.063.860 (SPEC seção 3)', () => {
    expect(combinacoes(60, 6)).toBe(50_063_860)
    expect(TOTAL_COMBINACOES).toBe(50_063_860)
  })

  it('valores conhecidos de C(k,6) para 6 a 10 dezenas', () => {
    expect([6, 7, 8, 9, 10].map((k) => combinacoes(k, 6))).toEqual([1, 7, 28, 84, 210])
  })

  it('valores inválidos devolvem 0', () => {
    expect(combinacoes(5, 6)).toBe(0)
    expect(combinacoes(-1, 2)).toBe(0)
  })
})
