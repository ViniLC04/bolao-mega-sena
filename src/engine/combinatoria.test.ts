import { describe, expect, it } from 'vitest'
import { combinacoes, precoJogo } from './combinatoria'

// Preço de teste = valor padrão do SPEC seção 3 (600 centavos). Em produção vem de rules.json.
const PRECO_SIMPLES = 600

describe('combinatória', () => {
  it('C(60,6) = 50.063.860 (SPEC seção 3)', () => {
    expect(combinacoes(60, 6)).toBe(50_063_860)
  })

  it('preço por quantidade de dezenas (SPEC 4.1)', () => {
    expect(precoJogo(6, PRECO_SIMPLES)).toBe(600)
    expect(precoJogo(7, PRECO_SIMPLES)).toBe(4_200)
    expect(precoJogo(8, PRECO_SIMPLES)).toBe(16_800)
    expect(precoJogo(9, PRECO_SIMPLES)).toBe(50_400)
    expect(precoJogo(10, PRECO_SIMPLES)).toBe(126_000)
  })

  it('valores inválidos devolvem 0', () => {
    expect(combinacoes(5, 6)).toBe(0)
    expect(combinacoes(-1, 2)).toBe(0)
  })
})
