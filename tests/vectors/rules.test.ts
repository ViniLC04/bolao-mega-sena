import { describe, expect, it } from 'vitest'
import { regrasVigentes, validarRegras, type ArquivoRegras } from '../../src/engine/rules'
import { ARQUIVO_REGRAS, REGRAS } from './regras-teste'

const clone = (): ArquivoRegras => JSON.parse(JSON.stringify(ARQUIVO_REGRAS))

describe('rules.json (SPEC seção 3)', () => {
  it('o arquivo do projeto é válido', () => {
    expect(validarRegras(ARQUIVO_REGRAS)).toEqual([])
  })

  it('valores padrão da seção 3', () => {
    expect(REGRAS.preco_aposta_simples).toBe(600)
    expect(REGRAS.bolao_valor_minimo).toBe(1800)
    expect(REGRAS.bolao_cota_minima).toBe(700)
    expect(REGRAS.bolao_cotas_min).toBe(2)
    expect(REGRAS.bolao_cotas_max).toBe(100)
    expect(REGRAS.bolao_jogos_max_por_recibo).toBe(10)
    expect(REGRAS.dezenas_min).toBe(6)
    expect(REGRAS.dezenas_max).toBe(20)
    expect(REGRAS.tarifa_servico_bolao_bp).toBe(0)
    expect(REGRAS.premio_bruto_bp).toBe(4379) // 43,79%
    expect(REGRAS.ir_aliquota_bp).toBe(3000) // 30%
    expect(REGRAS.ir_valor_isento).toBe(0) // [PENDENTE]
    expect(REGRAS.arredondamento_cota).toBe('cima') // [PREMISSA do ADM]
    expect(REGRAS.limite_recibos_simulador).toBe(4)
    expect(REGRAS.concurso_virada.numero).toBe(3100)
  })

  it('distribuições somam 100%', () => {
    const soma = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)
    expect(soma(REGRAS.virada_distribuicao_bp)).toBe(10000)
    expect(soma(REGRAS.comum_distribuicao_bp)).toBe(10000)
    expect(REGRAS.virada_distribuicao_bp).toEqual({ sena: 9000, quina: 500, quadra: 500 })
  })
})

describe('regrasVigentes (versionadas por vigência)', () => {
  it('usa a versão mais recente com vigência já iniciada', () => {
    const arq = clone()
    const nova = JSON.parse(JSON.stringify(arq.versoes[0]))
    nova.vigencia_inicio = '2027-03-01'
    nova.params.preco_aposta_simples = 700
    arq.versoes.push(nova)
    expect(regrasVigentes(arq, '2026-12-31').preco_aposta_simples).toBe(600)
    expect(regrasVigentes(arq, '2027-03-01').preco_aposta_simples).toBe(700)
    expect(regrasVigentes(arq, '2030-01-01').preco_aposta_simples).toBe(700)
  })

  it('erra com clareza se não há regra em vigor ou a data é inválida', () => {
    expect(() => regrasVigentes(ARQUIVO_REGRAS, '2025-12-31')).toThrow(/Não há regras em vigor/)
    expect(() => regrasVigentes(ARQUIVO_REGRAS, '31/12/2026')).toThrow(/Data inválida/)
  })
})

describe('validarRegras detecta erros de edição', () => {
  it('rejeita arquivo vazio', () => {
    expect(validarRegras({ versoes: [] }).length).toBeGreaterThan(0)
  })
  it('rejeita preço decimal ou negativo (dinheiro é inteiro em centavos)', () => {
    const a = clone()
    a.versoes[0].params.preco_aposta_simples = 6.5
    expect(validarRegras(a).join(' ')).toMatch(/preco_aposta_simples/)
    const b = clone()
    b.versoes[0].params.bolao_cota_minima = -1
    expect(validarRegras(b).join(' ')).toMatch(/bolao_cota_minima/)
  })
  it('rejeita distribuição que não soma 100%', () => {
    const a = clone()
    a.versoes[0].params.virada_distribuicao_bp.sena = 8000
    expect(validarRegras(a).join(' ')).toMatch(/virada_distribuicao_bp/)
  })
  it('rejeita limites de dezenas fora de 6..60 e cotas_min > cotas_max', () => {
    const a = clone()
    a.versoes[0].params.dezenas_max = 61
    expect(validarRegras(a).join(' ')).toMatch(/dezenas_min\/dezenas_max/)
    const b = clone()
    b.versoes[0].params.bolao_cotas_min = 200
    expect(validarRegras(b).join(' ')).toMatch(/bolao_cotas_min/)
  })
  it('rejeita vigência repetida e data fora do formato', () => {
    const a = clone()
    a.versoes.push(JSON.parse(JSON.stringify(a.versoes[0])))
    expect(validarRegras(a).join(' ')).toMatch(/repetida/)
    const b = clone()
    b.versoes[0].vigencia_inicio = '01/01/2026'
    expect(validarRegras(b).join(' ')).toMatch(/yyyy-mm-dd/)
  })
})
