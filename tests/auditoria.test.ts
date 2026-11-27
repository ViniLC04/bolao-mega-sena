import { describe, expect, it } from 'vitest'
import { auditarBoloes } from '../src/engine/auditoria'
import { gerarJogos } from '../src/engine/gerador'

const REC = [{ k: 7, g: 7 }, { k: 8, g: 10 }]
const IGUAIS5 = { maxIguais: { nMax: 5, escopo: 'concurso' as const } }

describe('auditoria do concurso', () => {
  it('um bolão do vetor: 329 combinações, 0 repetidas', () => {
    const r = gerarJogos(REC, IGUAIS5, {}, { semente: 3 })
    const a = auditarBoloes([{ id: 'a', nome: 'A', jogos: r.jogos.map((j) => j.dezenas) }])
    expect(a.combinacoesEsperadas).toBe(329)
    expect(a.combinacoesDistintas).toBe(329)
    expect(a.repetidas).toBe(0)
    expect(a.sobreposicaoMaxima).toBeLessThanOrEqual(5)
    expect(a.senaUmEm).toBeCloseTo(50_063_860 / 329, 6)
  })
  it('dois bolões gerados com cruzamento: continuam sem repetição entre si', () => {
    const r1 = gerarJogos(REC, IGUAIS5, {}, { semente: 3 })
    const j1 = r1.jogos.map((j) => j.dezenas)
    const r2 = gerarJogos(REC, IGUAIS5, { jogosOutrosBoloes: j1 }, { semente: 4 })
    expect(r2.ok).toBe(true)
    expect(r2.relatorio?.repetidasComOutrosBoloes).toBe(0)
    const a = auditarBoloes([
      { id: 'a', nome: 'A', jogos: j1 },
      { id: 'b', nome: 'B', jogos: r2.jogos.map((j) => j.dezenas) },
    ])
    expect(a.combinacoesEsperadas).toBe(658)
    expect(a.repetidas).toBe(0)
    expect(a.boloes).toBe(2)
    expect(a.totalJogos).toBe(34)
  })
  it('detecta repetição e nomeia o par', () => {
    const a = auditarBoloes([
      { id: 'a', nome: 'A', jogos: [[1, 2, 3, 4, 5, 6]] },
      { id: 'b', nome: 'B', jogos: [[1, 2, 3, 4, 5, 6, 7]] },
    ])
    expect(a.combinacoesEsperadas).toBe(8)
    expect(a.repetidas).toBe(1)
    expect(a.sobreposicaoMaxima).toBe(6)
    expect(a.parSobreposicao).toEqual(['A', 'B'])
  })
  it('sem bolões', () => {
    const a = auditarBoloes([])
    expect(a.totalJogos).toBe(0)
    expect(a.senaUmEm).toBeNull()
  })
})
