// Mensagem-convite do bolão para o WhatsApp. Função pura: quem chama já entrega valor e prazo formatados.

export interface DadosConvite {
  nome: string
  descricao: string | null
  concurso: number
  /** ex.: "R$ 56,00"; null se o bolão não tem valor de cota definido */
  cotaTexto: string | null
  /** ex.: "20/12/2026 18:00" (horário de Brasília); null se não há prazo */
  prazoTexto: string | null
  link: string
  /** bolão aberto: o número de cotas só é definido ao fechar as inscrições */
  aberto: boolean
}

/** Texto pronto para colar/enviar no WhatsApp (usa *negrito* do WhatsApp). */
export function montarConvite(d: DadosConvite): string {
  const linhas: string[] = [`🍀 *${d.nome.trim()}*`]
  const desc = d.descricao?.trim()
  if (desc) linhas.push('', desc)

  const detalhes = [`Concurso ${d.concurso}`]
  if (d.cotaTexto) detalhes.push(`Cota: ${d.cotaTexto}`)
  if (d.prazoTexto) detalhes.push(`Inscrições até ${d.prazoTexto}`)
  linhas.push('', detalhes.join(' · '))
  if (d.aberto) linhas.push('Cota fixa; o número de cotas e os jogos são definidos ao fechar as inscrições.')

  linhas.push('', 'Para participar: abra o link, entre em “Apostar” (crie sua conta na primeira vez) e escolha as cotas:', d.link)
  return linhas.join('\n')
}

/** Abre o WhatsApp com a mensagem pronta; a pessoa escolhe o contato ou o grupo. */
export function linkEnvioWhatsapp(mensagem: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensagem)}`
}
