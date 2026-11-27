import { describe, expect, it } from 'vitest'
import { deFormPremissas, FORM_PADRAO, lerDezenas, periodoDeForm } from '../src/app/premissasForm'
import { gerarJogos } from '../src/engine/gerador'

const hist = [
  { numero: 1, data: '2020-12-31', dezenas: [1, 2, 3, 4, 5, 6] },
  { numero: 2, data: '2021-01-02', dezenas: [1, 2, 3, 7, 8, 9] },
]

describe('formulário de premissas do gerador', () => {
  it('padrão = só "máx. 5 iguais em todo o concurso"', () => {
    const { premissas, erros } = deFormPremissas(FORM_PADRAO, [])
    expect(erros).toEqual([])
    expect(premissas).toEqual({ maxIguais: { nMax: 5, escopo: 'concurso' } })
  })
  it('só entra o que está ligado', () => {
    const f = { ...FORM_PADRAO, maxIguaisOn: false, paresOn: true, proibOn: true, proibDezenas: '1, 2 3' }
    expect(deFormPremissas(f, []).premissas).toEqual({ paresImpares: { minPares: 2, maxPares: 4 }, proibidos: { dezenas: [1, 2, 3] } })
  })
  it('mais frequentes e histórico usam o período', () => {
    const f = { ...FORM_PADRAO, freqOn: true, freqX: '6', histOn: true, histQuinas: '0', histQuadras: '' }
    const { premissas, erros } = deFormPremissas(f, hist)
    expect(erros).toEqual([])
    expect(premissas.frequentes?.dezenas.slice(0, 3)).toEqual([1, 2, 3])
    expect(premissas.historico).toEqual({ maxQuinas: 0, maxQuadras: undefined })
    expect(deFormPremissas(f, []).erros.length).toBe(2)
  })
  it('aponta os erros em português', () => {
    const f = { ...FORM_PADRAO, maxIguaisN: 'x', paresOn: true, paresMin: '5', paresMax: '2', obrigOn: true, obrigDezenas: '99', proibOn: true, proibDezenas: '7' }
    const e = deFormPremissas(f, []).erros.join(' | ')
    expect(e).toMatch(/Máx. de números iguais/)
    expect(e).toMatch(/Pares e ímpares: o mínimo/)
    expect(e).toMatch(/Obrigatórios/)
  })
  it('dezena obrigatória e proibida ao mesmo tempo é recusada', () => {
    const f = { ...FORM_PADRAO, obrigOn: true, obrigDezenas: '7', proibOn: true, proibDezenas: '7, 8' }
    expect(deFormPremissas(f, []).erros.join(' ')).toMatch(/obrigatória e proibida/)
  })
  it('lê dezenas de 1 a 60', () => {
    expect(lerDezenas('5, 12 30')).toEqual([5, 12, 30])
    for (const t of ['', '0', '61', 'a']) expect(lerDezenas(t), t).toBeNull()
  })
  it('períodos', () => {
    expect(periodoDeForm(FORM_PADRAO, [], '2026-11-26').filtro).toEqual({ tipo: 'tudo' })
    expect(periodoDeForm({ ...FORM_PADRAO, periodo: 'viradas' }, [], '2026-11-26').erro).toMatch(/Viradas/)
    expect(periodoDeForm({ ...FORM_PADRAO, periodo: 'viradas' }, [3], '2026-11-26').filtro).toEqual({ tipo: 'viradas', numeros: [3] })
    expect(periodoDeForm({ ...FORM_PADRAO, periodo: 'ultimos_anos', periodoAnos: '5' }, [], '2026-11-26').filtro).toEqual({ tipo: 'ultimos_anos', anos: 5, referencia: '2026-11-26' })
    expect(periodoDeForm({ ...FORM_PADRAO, periodo: 'mes', periodoMes: '13' }, [], '2026-11-26').erro).toMatch(/mês/)
  })
  it('as premissas do padrão geram o bolão do vetor sem combinação repetida', () => {
    const { premissas } = deFormPremissas(FORM_PADRAO, [])
    const r = gerarJogos([{ k: 7, g: 7 }, { k: 8, g: 10 }], premissas, {}, { semente: 7 })
    expect(r.ok).toBe(true)
    expect(r.relatorio?.combinacoesDistintas).toBe(329)
    expect(r.relatorio?.repetidas).toBe(0)
  })
})
