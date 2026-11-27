import { describe, expect, it } from 'vitest'
import { crc16, gerarPayloadPix, linkWhatsapp, normalizarChavePix, textoPix, valorPix } from '../src/engine/pix'

describe('PIX estático (BR Code)', () => {
  it('monta os campos na ordem do padrão (exemplo do manual: chave aleatória, Fulano de Tal, BRASILIA)', () => {
    const p = gerarPayloadPix({ chave: '123e4567-e89b-12d3-a456-426614174000', nome: 'Fulano de Tal', cidade: 'BRASILIA' })
    const semCrc = '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-4266141740005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304'
    expect(p.slice(0, -4)).toBe(semCrc)
    // o CRC fecha com uma segunda implementação, por tabela (independente da usada no app)
    const tabela = Array.from({ length: 256 }, (_, i) => {
      let c = i << 8
      for (let b = 0; b < 8; b++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff
      return c
    })
    let crc = 0xffff
    for (const ch of semCrc) crc = ((crc << 8) & 0xffff) ^ tabela[((crc >> 8) ^ ch.charCodeAt(0)) & 0xff]
    expect(p.slice(-4)).toBe(crc.toString(16).toUpperCase().padStart(4, '0'))
  })
  it('CRC16 CCITT-FALSE: vetor clássico "123456789" = 29B1', () => {
    expect(crc16('123456789')).toBe('29B1')
  })
  it('valor em centavos vira texto com ponto, sem float', () => {
    expect(valorPix(10_000)).toBe('100.00')
    expect(valorPix(5)).toBe('0.05')
    expect(valorPix(123_456)).toBe('1234.56')
  })
  it('com valor: campo 54 entra antes do 58 e o CRC fecha', () => {
    const p = gerarPayloadPix({ chave: 'teste@exemplo.com', nome: 'Maria da Silva', cidade: 'Sao Paulo', valorCent: 20_050 })
    expect(p).toContain('5406200.50')
    expect(p.indexOf('5406200.50')).toBeLessThan(p.indexOf('5802BR'))
    const semCrc = p.slice(0, -4)
    expect(p.endsWith(crc16(semCrc))).toBe(true)
    expect(semCrc.endsWith('6304')).toBe(true)
  })
  it('tira acentos e corta o tamanho do nome e da cidade', () => {
    expect(textoPix('José Álvaro São João', 25)).toBe('Jose Alvaro Sao Joao')
    expect(textoPix('Nome muito comprido de mais para caber', 25).length).toBe(25)
    const p = gerarPayloadPix({ chave: 'a@b.co', nome: 'João Conceição', cidade: 'Brasília' })
    expect(p).toContain('Joao Conceicao'.normalize('NFD').replace(/[̀-ͯ]/g, ''))
    expect(p).toContain('Brasilia')
  })
  it('recusa dado faltando ou valor inválido', () => {
    expect(() => gerarPayloadPix({ chave: '', nome: 'A', cidade: 'B' })).toThrow()
    expect(() => gerarPayloadPix({ chave: 'x', nome: '', cidade: 'B' })).toThrow()
    expect(() => gerarPayloadPix({ chave: 'x', nome: 'A', cidade: '' })).toThrow()
    expect(() => gerarPayloadPix({ chave: 'x', nome: 'A', cidade: 'B', valorCent: -1 })).toThrow()
    expect(() => gerarPayloadPix({ chave: 'x', nome: 'A', cidade: 'B', valorCent: 1.5 })).toThrow()
  })
})

describe('chave PIX', () => {
  it('CPF, CNPJ, e-mail, celular e chave aleatória', () => {
    expect(normalizarChavePix('cpf', '123.456.789-09')).toEqual({ chave: '12345678909' })
    expect(normalizarChavePix('cpf', '123')).toHaveProperty('erro')
    expect(normalizarChavePix('cnpj', '12.345.678/0001-95')).toEqual({ chave: '12345678000195' })
    expect(normalizarChavePix('email', ' Ana@Exemplo.COM ')).toEqual({ chave: 'ana@exemplo.com' })
    expect(normalizarChavePix('email', 'sem-arroba')).toHaveProperty('erro')
    expect(normalizarChavePix('telefone', '(11) 99999-8888')).toEqual({ chave: '+5511999998888' })
    expect(normalizarChavePix('telefone', '+55 11 99999-8888')).toEqual({ chave: '+5511999998888' })
    expect(normalizarChavePix('telefone', '999')).toHaveProperty('erro')
    expect(normalizarChavePix('aleatoria', '123E4567-E89B-12D3-A456-426614174000')).toEqual({ chave: '123e4567-e89b-12d3-a456-426614174000' })
    expect(normalizarChavePix('aleatoria', 'abc')).toHaveProperty('erro')
  })
})

describe('link do WhatsApp', () => {
  it('monta o link com DDI e mensagem codificada', () => {
    expect(linkWhatsapp('(11) 99999-8888', 'Oi! Paguei R$ 100,00')).toBe('https://wa.me/5511999998888?text=Oi!%20Paguei%20R%24%20100%2C00')
    expect(linkWhatsapp('+55 11 99999-8888', 'x')).toBe('https://wa.me/5511999998888?text=x')
    expect(linkWhatsapp('123', 'x')).toBeNull()
  })
})
