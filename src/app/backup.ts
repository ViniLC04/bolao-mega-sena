// Funções puras do backup: planilha CSV de pagamentos (a conferência do arquivo está em backupConferir.ts).
import { formatarReaisCampo } from './formato'

export * from './backupConferir'

/** Uma célula de CSV (separador ponto e vírgula, como o Excel em português espera). */
export function celulaCsv(v: string | number | boolean | null | undefined): string {
  const t = v === null || v === undefined ? '' : String(v)
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

/** Linhas → texto CSV (com BOM no começo, para o Excel abrir os acentos certos). */
export function paraCsv(linhas: (string | number | boolean | null | undefined)[][]): string {
  return '﻿' + linhas.map((l) => l.map(celulaCsv).join(';')).join('\r\n') + '\r\n'
}

export interface PagamentoLinha {
  participante: string
  contato: string | null
  bolao: string
  concurso: number
  qtd: number
  valorDevidoCent: number
  pago: boolean
  viaEntregue: boolean
}

/** Planilha de pagamentos: uma linha por pessoa e bolão. */
export function csvPagamentos(linhas: readonly PagamentoLinha[]): string {
  const cab = ['Participante', 'Contato', 'Bolão', 'Concurso', 'Cotas', 'Valor devido (R$)', 'Pago', 'Via entregue']
  const corpo = linhas.map((l) => [l.participante, l.contato ?? '', l.bolao, l.concurso, l.qtd, formatarReaisCampo(l.valorDevidoCent), l.pago ? 'sim' : 'não', l.viaEntregue ? 'sim' : 'não'])
  return paraCsv([cab, ...corpo])
}
