import { describe, expect, it } from 'vitest'
import { compararComBanco, lerListaNumeros, sugerirViradas } from '../src/data/concursos'
import type { ConcursoPlanilha } from '../src/data/planilha'

const plan = (numero: number, data: string, dezenas: number[]): ConcursoPlanilha => ({
  numero, data, dezenas,
  ganhadoresSena: 0, cidades: '', rateioSenaCent: 0, ganhadoresQuina: 0, rateioQuinaCent: 0,
  ganhadoresQuadra: 0, rateioQuadraCent: 0, acumuladoSenaCent: 0, arrecadacaoCent: 0,
  estimativaProximoCent: 0, acumuladoViradaCent: 0, observacao: '',
})

describe('importação: comparar planilha com o banco', () => {
  const planilha = [plan(1, '1996-03-11', [41, 5, 4, 52, 30, 33]), plan(2, '1996-03-18', [9, 39, 37, 49, 43, 41]), plan(3, '1996-03-25', [10, 11, 29, 30, 36, 47])]
  it('separa novos, já existentes e divergentes (sem ordem das dezenas)', () => {
    const banco = [
      { numero: 1, data: '1996-03-11', dezenas: [4, 5, 30, 33, 41, 52] },
      { numero: 2, data: '1996-03-18', dezenas: [1, 2, 3, 4, 5, 6] },
    ]
    const r = compararComBanco(planilha, banco)
    expect(r.novos.map((c) => c.numero)).toEqual([3])
    expect(r.jaNoBanco).toBe(2)
    expect(r.divergentes).toEqual([2])
  })
  it('banco vazio: tudo é novo', () => {
    expect(compararComBanco(planilha, []).novos.length).toBe(3)
  })
})

describe('lista de Viradas', () => {
  it('lê números e faixas', () => {
    expect(lerListaNumeros('1, 5, 10-12 12')).toEqual([1, 5, 10, 11, 12])
    expect(lerListaNumeros('')).toEqual([])
  })
  it('recusa o que não é número', () => {
    for (const t of ['a', '1,x', '5-3', '0', '1-99999']) expect(lerListaNumeros(t), t).toBeNull()
  })
  it('sugere os sorteios de 31/12', () => {
    expect(sugerirViradas([{ numero: 1, data: '1998-12-31' }, { numero: 2, data: '1999-01-02' }, { numero: 3, data: '2009-12-31' }])).toEqual([1, 3])
  })
})
