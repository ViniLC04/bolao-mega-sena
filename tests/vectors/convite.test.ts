// Mensagem-convite do bolão (Fase 15).
import { describe, expect, it } from 'vitest'
import { linkEnvioWhatsapp, montarConvite } from '../../src/engine/convite'

const base = {
  nome: '  Bolão da Virada  ',
  descricao: 'Bolão da família. Cota fixa.',
  concurso: 2810,
  cotaTexto: 'R$ 56,00',
  prazoTexto: '20/12/2026 18:00',
  link: 'https://exemplo.pages.dev/#/b/abc',
  aberto: true,
}

describe('convite do bolão', () => {
  it('traz título, descrição, concurso, cota, prazo e link', () => {
    const t = montarConvite(base)
    expect(t).toContain('🍀 *Bolão da Virada*')
    expect(t).toContain('Bolão da família. Cota fixa.')
    expect(t).toContain('Concurso 2810 · Cota: R$ 56,00 · Inscrições até 20/12/2026 18:00')
    expect(t).toContain('definidos ao fechar as inscrições')
    expect(t.endsWith('https://exemplo.pages.dev/#/b/abc')).toBe(true)
  })

  it('sem descrição, sem prazo e bolão não aberto: omite essas partes', () => {
    const t = montarConvite({ ...base, descricao: '  ', prazoTexto: null, aberto: false })
    expect(t).not.toContain('Bolão da família')
    expect(t).not.toContain('Inscrições até')
    expect(t).not.toContain('definidos ao fechar')
    expect(t).toContain('Concurso 2810 · Cota: R$ 56,00')
  })

  it('o link do WhatsApp codifica a mensagem e não leva número de telefone', () => {
    const l = linkEnvioWhatsapp('olá\n*bolão*')
    expect(l.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(l.split('text=')[1])).toBe('olá\n*bolão*')
  })
})
