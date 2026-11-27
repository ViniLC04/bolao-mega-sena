import { describe, expect, it } from 'vitest'
import { confereComSegundaFonte, converterCaixa, paraCentavos, type SegundaFonte } from '../src/data/caixa'

// Resposta real da Caixa para o concurso 3087 (17/11/2026), reduzida aos campos usados.
const CAIXA_3087 = {
  dataApuracao: '17/11/2026',
  dezenasSorteadasOrdemSorteio: ['25', '50', '10', '06', '48', '23'],
  listaDezenas: ['06', '10', '23', '25', '48', '50'],
  listaMunicipioUFGanhadores: [],
  listaRateioPremio: [
    { faixa: 1, numeroDeGanhadores: 0, valorPremio: 0.0 },
    { faixa: 2, numeroDeGanhadores: 53, valorPremio: 24857.75 },
    { faixa: 3, numeroDeGanhadores: 3173, valorPremio: 593.15 },
  ],
  numero: 3087,
  observacao: '',
  valorAcumuladoConcursoEspecial: 155623421.73,
  valorAcumuladoProximoConcurso: 32125746.68,
  valorArrecadado: 42979824.0,
  valorEstimadoProximoConcurso: 40000000.0,
}

describe('conversão da resposta da Caixa', () => {
  it('converte valores para centavos inteiros', () => {
    expect(paraCentavos(24857.75)).toBe(2_485_775)
    expect(paraCentavos(593.15)).toBe(59_315)
    expect(paraCentavos(155623421.73)).toBe(15_562_342_173)
    expect(paraCentavos(0)).toBe(0)
    expect(paraCentavos(-1)).toBeNull()
    expect(paraCentavos('10')).toBeNull()
    expect(paraCentavos(Number.NaN)).toBeNull()
  })
  it('concurso 3087 completo', () => {
    const p = converterCaixa(CAIXA_3087)!
    expect(p.numero).toBe(3087)
    expect(p.data).toBe('2026-11-17')
    expect(p.dezenas).toEqual([6, 10, 23, 25, 48, 50])
    expect(p.ordem_sorteio).toEqual([25, 50, 10, 6, 48, 23])
    expect(p.arrecadacao_cent).toBe(4_297_982_400)
    expect(p.estimativa_prox_cent).toBe(4_000_000_000)
    expect(p.acumulado_virada_cent).toBe(15_562_342_173)
    expect(p.acumulado_prox_cent).toBe(3_212_574_668)
    expect(p.cidades).toBeNull()
    expect(p.observacao).toBeNull()
    expect(p.faixas).toEqual([
      { faixa: 6, ganhadores: 0, valor_cent: 0 },
      { faixa: 5, ganhadores: 53, valor_cent: 2_485_775 },
      { faixa: 4, ganhadores: 3173, valor_cent: 59_315 },
    ])
  })
  it('recusa o que veio incompleto ou inválido (nada é consertado em silêncio)', () => {
    expect(converterCaixa(null)).toBeNull()
    expect(converterCaixa({ ...CAIXA_3087, listaDezenas: ['06', '06', '23', '25', '48', '50'] })).toBeNull()
    expect(converterCaixa({ ...CAIXA_3087, listaDezenas: ['06', '10', '23', '25', '48', '61'] })).toBeNull()
    expect(converterCaixa({ ...CAIXA_3087, dataApuracao: '2026-11-17' })).toBeNull()
    expect(converterCaixa({ ...CAIXA_3087, listaRateioPremio: [] })).toBeNull()
    expect(converterCaixa({ ...CAIXA_3087, valorArrecadado: 'x' })).toBeNull()
  })
  it('ordem de sorteio inválida vira null (o resto continua valendo)', () => {
    expect(converterCaixa({ ...CAIXA_3087, dezenasSorteadasOrdemSorteio: null })!.ordem_sorteio).toBeNull()
  })
})

describe('conferência com a 2ª fonte', () => {
  const p = converterCaixa(CAIXA_3087)!
  const seg = (dezenas: number[], data = '2026-11-17', ultimoFaixas?: Map<number, { ganhadores: number; valor_cent: number }>): SegundaFonte => ({
    sorteios: new Map([[3087, { data, dezenas }]]),
    ultimo: ultimoFaixas ? { numero: 3087, faixas: ultimoFaixas } : null,
  })
  it('bate quando data e dezenas são iguais (em qualquer ordem)', () => {
    expect(confereComSegundaFonte(p, seg([50, 48, 25, 23, 10, 6]))).toBe(true)
  })
  it('não bate com dezena ou data diferente, ou sem 2ª fonte', () => {
    expect(confereComSegundaFonte(p, seg([1, 2, 3, 4, 5, 6]))).toBe(false)
    expect(confereComSegundaFonte(p, seg([6, 10, 23, 25, 48, 50], '2026-11-18'))).toBe(false)
    expect(confereComSegundaFonte(p, null)).toBe(false)
    expect(confereComSegundaFonte({ ...p, numero: 3088 }, seg([6, 10, 23, 25, 48, 50]))).toBe(false)
  })
  it('com o rateio do último concurso, também confere os valores', () => {
    const igual = new Map([[4, { ganhadores: 3173, valor_cent: 59_315 }], [5, { ganhadores: 53, valor_cent: 2_485_775 }], [6, { ganhadores: 0, valor_cent: 0 }]])
    expect(confereComSegundaFonte(p, seg([6, 10, 23, 25, 48, 50], '2026-11-17', igual))).toBe(true)
    const diferente = new Map(igual).set(5, { ganhadores: 53, valor_cent: 2_485_776 })
    expect(confereComSegundaFonte(p, seg([6, 10, 23, 25, 48, 50], '2026-11-17', diferente))).toBe(false)
  })
})
