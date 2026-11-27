import { describe, expect, it } from 'vitest'
import { caixinha, resumoCotas, validarQtdCotas, valorDevido, type CotaRegistro } from '../src/engine/cotas'

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
