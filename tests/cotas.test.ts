import { describe, expect, it } from 'vitest'
import { caixinha, resumoCotas, validarQtdCotas, valorDevido, verificarFechamento, type CotaRegistro } from '../src/engine/cotas'
import { REGRAS } from './vectors/regras-teste'

const c = (qtd: number, pago = false, via = false, cota = 10_000): CotaRegistro => ({ qtd, valorDevidoCent: valorDevido(qtd, cota), pago, viaEntregue: via })

describe('cotas e pagamentos (centavos inteiros)', () => {
  it('valor devido', () => {
    expect(valorDevido(3, 10_000)).toBe(30_000)
    expect(valorDevido(1, 700)).toBe(700)
  })
  it('resumo: vendidas, livres, pagas, arrecadado e a receber', () => {
    const r = resumoCotas([c(5, true, true), c(3, false, true), c(2, true), c(4)], 20)
    expect(r.vendidas).toBe(14)
    expect(r.livres).toBe(6)
    expect(r.pagas).toBe(7)
    expect(r.naoPagas).toBe(7)
    expect(r.viasEntregues).toBe(8)
    expect(r.arrecadadoCent).toBe(70_000)
    expect(r.aReceberCent).toBe(70_000)
    expect(r.vendidoCent).toBe(140_000)
    expect(r.registros).toBe(4)
  })
  it('bolão vazio', () => {
    const r = resumoCotas([], 20)
    expect(r.vendidas).toBe(0)
    expect(r.livres).toBe(20)
    expect(r.arrecadadoCent).toBe(0)
  })
  it('não vende mais que N', () => {
    expect(validarQtdCotas(1, 0, 20)).toBeNull()
    expect(validarQtdCotas(20, 0, 20)).toBeNull()
    expect(validarQtdCotas(6, 15, 20)).toMatch(/Só restam 5/)
    expect(validarQtdCotas(1, 20, 20)).toMatch(/Todas as cotas/)
    for (const q of [0, -1, 1.5, Number.NaN]) expect(validarQtdCotas(q, 0, 20), String(q)).toMatch(/inteiro/)
  })
})

describe('fechamento das inscrições de um bolão aberto', () => {
  it('20 cotas de R$ 100: pode fechar (vetor do SPEC: gasto de R$ 1.974)', () => {
    const v = verificarFechamento(20, 10_000, REGRAS)
    expect(v.podeFechar).toBe(true)
    expect(v.motivo).toBeNull()
    expect(v.orcamentoCent).toBe(200_000)
    expect(v.minimoCent).not.toBeNull()
  })
  it('poucas cotas ou cotas demais: N fora dos limites das Regras', () => {
    expect(verificarFechamento(1, 10_000, REGRAS).motivo).toBe('n_invalido')
    expect(verificarFechamento(0, 10_000, REGRAS).motivo).toBe('n_invalido')
    expect(verificarFechamento(101, 10_000, REGRAS).motivo).toBe('n_invalido')
    expect(verificarFechamento(100, 10_000, REGRAS).podeFechar).toBe(true)
  })
  it('orçamento abaixo do mínimo para N cotas', () => {
    // 10 cotas de R$ 3,00 = R$ 30,00: abaixo do mínimo de R$ 70,00 (10 × R$ 7,00)
    const v = verificarFechamento(10, 300, REGRAS)
    expect(v.podeFechar).toBe(false)
    expect(v.motivo).toBe('orcamento_baixo')
    expect(v.orcamentoCent).toBe(3_000)
    expect(v.minimoCent).toBeGreaterThan(3_000)
  })
  it('limite exato: cota igual à cota mínima por recibo ainda fecha quando o orçamento alcança o menor recibo', () => {
    const min = verificarFechamento(10, 10_000, REGRAS).minimoCent!
    expect(verificarFechamento(10, Math.ceil(min / 10), REGRAS).podeFechar).toBe(true)
    expect(verificarFechamento(10, Math.ceil(min / 10) - 1, REGRAS).podeFechar).toBe(false)
  })
})

describe('caixinha', () => {
  it('vetor 20 cotas × R$ 100, apostas de R$ 1.974: sobra R$ 26', () => {
    const k = caixinha(20, 10_000, 197_400, [])
    expect(k.sobraPrevistaCent).toBe(2_600)
    expect(k.saldoCent).toBe(2_600)
  })
  it('soma entradas e saídas manuais', () => {
    const k = caixinha(20, 10_000, 197_400, [1_000, -500])
    expect(k.movimentosCent).toBe(500)
    expect(k.saldoCent).toBe(3_100)
  })
})
