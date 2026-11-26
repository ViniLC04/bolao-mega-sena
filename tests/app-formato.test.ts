import { describe, expect, it } from 'vitest'
import { esperaAposFalhas } from '../src/app/bloqueio'
import {
  campoLocalSPParaIso,
  contagemRegressiva,
  formatarBp,
  formatarDataHoraSP,
  formatarDataIso,
  formatarInteiro,
  formatarReais,
  formatarReaisCampo,
  hojeIsoSP,
  isoParaCampoLocalSP,
  parsePercentual,
  parseReais,
} from '../src/app/formato'
import { deForm, paraForm } from '../src/app/regrasForm'
import { emailParaUsuario, usuarioParaEmail, usuarioValido } from '../src/data/usuario'
import { REGRAS } from './vectors/regras-teste'

describe('dinheiro em R$ (centavos inteiros, sem float)', () => {
  it('formata com ponto de milhar e vírgula', () => {
    expect(formatarReais(123_456)).toBe('R$ 1.234,56')
    expect(formatarReais(0)).toBe('R$ 0,00')
    expect(formatarReais(5)).toBe('R$ 0,05')
    expect(formatarReais(4_706_136_600)).toBe('R$ 47.061.366,00')
    expect(formatarReais(-1_050)).toBe('-R$ 10,50')
    expect(formatarReaisCampo(700)).toBe('7,00')
    expect(formatarInteiro(1_234_567)).toBe('1.234.567')
  })
  it('lê o que a pessoa digita', () => {
    expect(parseReais('R$ 1.234,56')).toBe(123_456)
    expect(parseReais('49')).toBe(4_900)
    expect(parseReais('49,5')).toBe(4_950)
    expect(parseReais('7,00')).toBe(700)
    expect(parseReais('1.234')).toBe(123_400)
  })
  it('recusa o que não é dinheiro', () => {
    for (const t of ['', 'abc', '49.5', '1,234,56', '-5', '7,001', '12.34,56']) expect(parseReais(t), t).toBeNull()
  })
  it('ida e volta: formatar e ler dá o mesmo valor', () => {
    for (const c of [0, 1, 99, 100, 700, 4_200, 123_456, 4_706_136_600]) expect(parseReais(formatarReais(c))).toBe(c)
  })
})

describe('percentuais em pontos-base', () => {
  it('formata e lê', () => {
    expect(formatarBp(4379)).toBe('43,79')
    expect(formatarBp(3000)).toBe('30')
    expect(formatarBp(4350)).toBe('43,5')
    expect(formatarBp(0)).toBe('0')
    expect(parsePercentual('43,79')).toBe(4379)
    expect(parsePercentual('30')).toBe(3000)
    expect(parsePercentual('43,5%')).toBe(4350)
    expect(parsePercentual('abc')).toBeNull()
    expect(parsePercentual('43.79')).toBeNull()
  })
  it('ida e volta', () => {
    for (const bp of [0, 1, 500, 2500, 4379, 9000, 10000]) expect(parsePercentual(formatarBp(bp))).toBe(bp)
  })
})

describe('datas (dd/mm/aaaa e horário de Brasília)', () => {
  it('formata', () => {
    expect(formatarDataIso('2026-12-31')).toBe('31/12/2026')
    expect(formatarDataHoraSP('2026-12-31T22:00:00-03:00')).toBe('31/12/2026 22:00')
    expect(formatarDataHoraSP('2027-01-01T01:00:00Z')).toBe('31/12/2026 22:00')
  })
  it('campo da tela ↔ ISO com fuso de Brasília', () => {
    expect(isoParaCampoLocalSP('2026-12-31T22:00:00-03:00')).toBe('2026-12-31T22:00')
    expect(campoLocalSPParaIso('2026-12-31T22:00')).toBe('2026-12-31T22:00:00-03:00')
    expect(campoLocalSPParaIso('31/12/2026')).toBe('')
    expect(isoParaCampoLocalSP(campoLocalSPParaIso('2027-01-01T00:00'))).toBe('2027-01-01T00:00')
  })
  it('"hoje" é a data de Brasília, não a do UTC', () => {
    expect(hojeIsoSP(Date.parse('2026-12-31T23:30:00-03:00'))).toBe('2026-12-31')
    expect(hojeIsoSP(Date.parse('2027-01-01T01:30:00Z'))).toBe('2026-12-31')
  })
  it('contagem regressiva', () => {
    const fim = '2026-12-31T22:00:00-03:00'
    const agora = Date.parse('2026-12-29T19:30:00-03:00')
    expect(contagemRegressiva(fim, agora)).toEqual({ encerrado: false, dias: 2, horas: 2, minutos: 30 })
    expect(contagemRegressiva(fim, Date.parse(fim)).encerrado).toBe(true)
    expect(contagemRegressiva(fim, Date.parse('2027-01-01T00:00:00-03:00')).encerrado).toBe(true)
    expect(contagemRegressiva('lixo', agora).encerrado).toBe(true)
  })
})

describe('login por usuário (e-mail interno fixo)', () => {
  it('usuário vira usuario@example.com', () => {
    expect(usuarioParaEmail('Vinicius ')).toBe('vinicius@example.com')
    expect(usuarioParaEmail('ana.souza-1')).toBe('ana.souza-1@example.com')
    expect(emailParaUsuario('vinicius@example.com')).toBe('vinicius')
    expect(emailParaUsuario('outro@dominio.com')).toBe('outro@dominio.com')
  })
  it('recusa usuário inválido', () => {
    for (const u of ['', 'a', 'com espaço', 'com@arroba', 'ç', '-x', 'x'.repeat(41)]) {
      expect(usuarioValido(u), u).toBe(false)
      expect(usuarioParaEmail(u), u).toBeNull()
    }
  })
})

describe('espera depois de senhas erradas', () => {
  it('0 nas duas primeiras; depois cresce até 60 s', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 20].map(esperaAposFalhas)).toEqual([0, 0, 0, 2, 4, 8, 16, 32, 60, 60])
  })
})

describe('formulário de regras', () => {
  it('ida e volta devolve exatamente os mesmos parâmetros', () => {
    const { params, erros } = deForm(paraForm(REGRAS))
    expect(erros).toEqual([])
    expect(params).toEqual(REGRAS)
  })
  it('mostra os campos como a pessoa lê', () => {
    const f = paraForm(REGRAS)
    expect(f.preco).toBe('6,00')
    expect(f.valorMinimo).toBe('18,00')
    expect(f.cotaMinima).toBe('7,00')
    expect(f.premioBruto).toBe('43,79')
    expect(f.irAliquota).toBe('30')
    expect(f.dataLimite).toBe('2026-12-31T22:00')
  })
  it('aponta cada campo com erro, em português', () => {
    const f = { ...paraForm(REGRAS), preco: 'seis', premioBruto: '4x', cotasMax: '1,5', dataLimite: '' }
    const { params, erros } = deForm(f)
    expect(params).toBeNull()
    expect(erros.length).toBe(4)
    expect(erros.join(' ')).toMatch(/Preço da aposta simples/)
    expect(erros.join(' ')).toMatch(/Prêmio bruto/)
    expect(erros.join(' ')).toMatch(/Máximo de cotas/)
    expect(erros.join(' ')).toMatch(/Data limite/)
  })
})
