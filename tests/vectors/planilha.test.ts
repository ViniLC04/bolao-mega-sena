import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  dataBrParaIso,
  lerLinhas,
  lerPlanilhaXlsx,
  linhasParaConcursos,
  reaisParaCentavos,
  validarConcursos,
  type ConcursoPlanilha,
} from '../../src/data/planilha'

describe('reaisParaCentavos (SPEC 9.5: planilha traz R$ como texto)', () => {
  it('converte para centavos inteiros', () => {
    expect(reaisParaCentavos('R$1.234,56')).toBe(123_456)
    expect(reaisParaCentavos('R$32.785,73')).toBe(3_278_573)
    expect(reaisParaCentavos('R$811,98')).toBe(81_198)
    expect(reaisParaCentavos('R$0,00')).toBe(0)
    expect(reaisParaCentavos('R$47.061.366,00')).toBe(4_706_136_600)
    expect(reaisParaCentavos('R$181.892.881,09')).toBe(18_189_288_109)
  })
  it('aceita sem centavos, com 1 casa e vazio', () => {
    expect(reaisParaCentavos('R$20')).toBe(2_000)
    expect(reaisParaCentavos('R$20,5')).toBe(2_050)
    expect(reaisParaCentavos('')).toBe(0)
  })
  it('recusa formato inválido', () => {
    expect(() => reaisParaCentavos('1234,56')).toThrow()
    expect(() => reaisParaCentavos('R$12.34,56')).toThrow()
    expect(() => reaisParaCentavos('abc')).toThrow()
  })
})

describe('datas', () => {
  it('dd/mm/aaaa → ISO', () => {
    expect(dataBrParaIso('15/11/2026')).toBe('2026-11-15')
    expect(() => dataBrParaIso('2026-11-15')).toThrow()
  })
})

describe('lerLinhas (formato estranho da Caixa)', () => {
  it('lê prefixo x: e células SEM endereço', () => {
    const xml =
      '<x:sheetData><x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c><x:c r="B1" t="s"><x:v>1</x:v></x:c></x:row>' +
      '<x:row><x:c t="n"><x:v>7</x:v></x:c><x:c t="str"><x:v>R$1,00</x:v></x:c><x:c t="str"><x:v></x:v></x:c></x:row></x:sheetData>'
    expect(lerLinhas(xml, ['Concurso', 'Valor'])).toEqual([
      ['Concurso', 'Valor'],
      ['7', 'R$1,00', ''],
    ])
  })
  it('lê também XML sem prefixo, com endereço e célula vazia', () => {
    const xml = '<row r="2"><c r="A2" t="n"><v>1</v></c><c r="C2" t="n"><v>3</v></c><c r="D2"/></row>'
    expect(lerLinhas(xml, [])).toEqual([['1', '', '3', '']])
  })
})

describe('linhasParaConcursos', () => {
  it('acha colunas pelo nome e falha se faltar uma', () => {
    expect(() => linhasParaConcursos([['Concurso']])).toThrow(/Coluna não encontrada/)
  })
})

describe('validarConcursos', () => {
  const base: ConcursoPlanilha = {
    numero: 1, data: '1996-03-11', dezenas: [4, 5, 30, 33, 41, 52], ganhadoresSena: 0, cidades: '',
    rateioSenaCent: 0, ganhadoresQuina: 17, rateioQuinaCent: 3_915_892, ganhadoresQuadra: 2016,
    rateioQuadraCent: 33_021, acumuladoSenaCent: 0, arrecadacaoCent: 0, estimativaProximoCent: 0,
    acumuladoViradaCent: 0, observacao: '',
  }
  it('aceita um concurso válido', () => {
    expect(validarConcursos([base])).toEqual([])
  })
  it('detecta lacuna, dezena repetida, dezena fora de 1..60 e valor negativo', () => {
    expect(validarConcursos([{ ...base, numero: 2 }]).length).toBe(1)
    expect(validarConcursos([{ ...base, dezenas: [4, 4, 30, 33, 41, 52] }]).length).toBe(1)
    expect(validarConcursos([{ ...base, dezenas: [0, 5, 30, 33, 41, 52] }]).length).toBe(1)
    expect(validarConcursos([{ ...base, dezenas: [4, 5, 30, 33, 41, 61] }]).length).toBe(1)
    expect(validarConcursos([{ ...base, arrecadacaoCent: -1 }]).length).toBe(1)
  })
})

// A planilha real tem nomes? Não, mas é ignorada pelo Git (*.xlsx), então no CI ela não existe.
const ARQUIVO = 'Dados/Mega-Sena.xlsx'
describe.skipIf(!existsSync(ARQUIVO))('planilha oficial real (SPEC 9.5)', () => {
  const concursos = existsSync(ARQUIVO) ? lerPlanilhaXlsx(readFileSync(ARQUIVO)) : []

  it('3.086 concursos, de 1 a 3086, sem lacunas nem duplicatas, tudo válido', () => {
    expect(concursos.length).toBe(3086)
    expect(concursos[0].numero).toBe(1)
    expect(concursos[concursos.length - 1].numero).toBe(3086)
    expect(new Set(concursos.map((c) => c.numero)).size).toBe(3086)
    expect(validarConcursos(concursos)).toEqual([])
  })

  it('vetor do SPEC: concurso 3086 (15/11/2026)', () => {
    const c = concursos.find((x) => x.numero === 3086)!
    expect(c.data).toBe('2026-11-15')
    expect(c.dezenas).toEqual([3, 20, 35, 38, 43, 46])
    expect(c.ganhadoresSena).toBe(0)
    expect(c.ganhadoresQuina).toBe(44)
    expect(c.rateioQuinaCent).toBe(3_278_573)
    expect(c.ganhadoresQuadra).toBe(2538)
    expect(c.rateioQuadraCent).toBe(81_198)
    expect(c.arrecadacaoCent).toBe(4_706_136_600)
  })

  it('vetor do SPEC: concurso 2955 (Virada 01/01/2026)', () => {
    const c = concursos.find((x) => x.numero === 2955)!
    expect(c.data).toBe('2026-01-01')
    expect(c.dezenas).toEqual([9, 13, 21, 32, 33, 59])
    expect(c.ganhadoresSena).toBe(6)
    expect(c.rateioSenaCent).toBe(18_189_288_109)
    expect(c.ganhadoresQuina).toBe(3921)
    expect(c.rateioQuinaCent).toBe(1_193_142)
    expect(c.ganhadoresQuadra).toBe(308_315)
    expect(c.rateioQuadraCent).toBe(21_676)
    expect(c.arrecadacaoCent).toBe(305_243_172_000)
  })
})
