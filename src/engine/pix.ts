// PIX estático (BR Code, padrão do Banco Central): monta o texto do "copia e cola" e do QR code com a chave, o nome do
// recebedor, a cidade e o valor. NÃO há integração com banco: o app só mostra o PIX; quem confirma que o dinheiro
// caiu é o organizador. Funções puras; valor em centavos inteiros (sem float).

export type TipoChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'

export const NOMES_TIPO_CHAVE: Record<TipoChavePix, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Celular',
  aleatoria: 'Chave aleatória',
}

/** Valida e normaliza a chave PIX digitada pelo organizador. */
export function normalizarChavePix(tipo: TipoChavePix, texto: string): { chave: string } | { erro: string } {
  const t = texto.trim()
  switch (tipo) {
    case 'cpf': {
      const d = t.replace(/\D/g, '')
      return d.length === 11 ? { chave: d } : { erro: 'O CPF precisa ter 11 números.' }
    }
    case 'cnpj': {
      const d = t.replace(/\D/g, '')
      return d.length === 14 ? { chave: d } : { erro: 'O CNPJ precisa ter 14 números.' }
    }
    case 'email': {
      const e = t.toLowerCase()
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 77 ? { chave: e } : { erro: 'E-mail inválido.' }
    }
    case 'telefone': {
      const d = t.replace(/\D/g, '')
      const nacional = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d
      return nacional.length === 10 || nacional.length === 11 ? { chave: `+55${nacional}` } : { erro: 'Celular com DDD (10 ou 11 números), por exemplo 11 99999-8888.' }
    }
    case 'aleatoria': {
      const u = t.toLowerCase()
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(u) ? { chave: u } : { erro: 'A chave aleatória tem o formato 123e4567-e89b-12d3-a456-426614174000.' }
    }
  }
}

/** Tira acentos e deixa só caracteres ASCII imprimíveis (o BR Code não aceita acento), limitando o tamanho. */
export function textoPix(s: string, max: number): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function campo(id: string, valor: string): string {
  return id + String(valor.length).padStart(2, '0') + valor
}

/** CRC16/CCITT-FALSE (polinômio 0x1021, início 0xFFFF) em 4 hexadecimais maiúsculos, como o BR Code exige. */
export function crc16(texto: string): string {
  let crc = 0xffff
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Centavos → "123.45" (ponto decimal, como o BR Code pede) sem usar número com vírgula. */
export function valorPix(centavos: number): string {
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`
}

export interface DadosPix {
  /** chave já normalizada (veja normalizarChavePix) */
  chave: string
  /** nome do recebedor (até 25 caracteres, sem acento) */
  nome: string
  /** cidade do recebedor (até 15 caracteres, sem acento) */
  cidade: string
  /** valor em centavos; sem valor (ou 0), a pessoa digita no banco */
  valorCent?: number
  /** identificador (até 25 letras e números); padrão "***" (não informado) */
  txid?: string
}

/** O texto do PIX "copia e cola" (e do QR code). Erro se faltar dado ou o valor for inválido. */
export function gerarPayloadPix(d: DadosPix): string {
  const nome = textoPix(d.nome, 25)
  const cidade = textoPix(d.cidade, 15)
  if (!d.chave) throw new Error('Falta a chave PIX.')
  if (!nome) throw new Error('Falta o nome do recebedor.')
  if (!cidade) throw new Error('Falta a cidade do recebedor.')
  if (d.valorCent !== undefined && (!Number.isInteger(d.valorCent) || d.valorCent < 0 || d.valorCent > 99_999_999_99)) throw new Error('Valor do PIX inválido.')
  const txid = (d.txid ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'

  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', d.chave)
  const corpo =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    (d.valorCent && d.valorCent > 0 ? campo('54', valorPix(d.valorCent)) : '') +
    campo('58', 'BR') +
    campo('59', nome) +
    campo('60', cidade) +
    campo('62', campo('05', txid)) +
    '6304'
  return corpo + crc16(corpo)
}

/** Link do WhatsApp com a mensagem pronta (o número é o do organizador, só dígitos com DDI). */
export function linkWhatsapp(numero: string, mensagem: string): string | null {
  const d = numero.replace(/\D/g, '')
  const completo = d.length === 10 || d.length === 11 ? `55${d}` : d
  if (completo.length < 12 || completo.length > 15) return null
  return `https://wa.me/${completo}?text=${encodeURIComponent(mensagem)}`
}
