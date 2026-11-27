// Formatos do app (PT-BR): R$ 1.234,56 e dd/mm/aaaa. Funções puras. Dinheiro sempre em centavos inteiros:
// nada aqui usa número com vírgula (float) para dinheiro.

const SP = 'America/Sao_Paulo'

/** 1234567 → "1.234.567" */
export function formatarInteiro(n: number): string {
  const sinal = n < 0 ? '-' : ''
  return sinal + String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** 123456 (centavos) → "R$ 1.234,56" */
export function formatarReais(centavos: number): string {
  const sinal = centavos < 0 ? '-' : ''
  const abs = Math.abs(Math.trunc(centavos))
  const reais = Math.floor(abs / 100)
  const cent = String(abs % 100).padStart(2, '0')
  return `${sinal}R$ ${formatarInteiro(reais)},${cent}`
}

/** Para campos de digitação (sem o "R$"): 700 → "7,00" */
export function formatarReaisCampo(centavos: number): string {
  return formatarReais(centavos).replace('R$ ', '')
}

/** "R$ 1.234,56", "1.234,56", "49", "49,5" → centavos. Texto inválido → null. Só aceita vírgula como decimal. */
export function parseReais(texto: string): number | null {
  const t = texto.replace(/R\$/g, '').replace(/[\s ]/g, '')
  const m = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(t)
  if (!m) return null
  const reais = Number(m[1].replace(/\./g, ''))
  const cent = Number((m[2] ?? '').padEnd(2, '0') || '0')
  const total = reais * 100 + cent
  return Number.isSafeInteger(total) ? total : null
}

/** Pontos-base → percentual: 4379 → "43,79"; 3000 → "30"; 4350 → "43,5". */
export function formatarBp(bp: number): string {
  const inteiro = Math.floor(bp / 100)
  const frac = bp % 100
  if (frac === 0) return String(inteiro)
  return `${inteiro},${String(frac).padStart(2, '0').replace(/0$/, '')}`
}

/** Percentual digitado → pontos-base: "43,79" → 4379; "30" → 3000. Inválido → null. */
export function parsePercentual(texto: string): number | null {
  const t = texto.replace(/%/g, '').replace(/\s/g, '')
  const m = /^(\d{1,3})(?:,(\d{1,2}))?$/.exec(t)
  if (!m) return null
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0')
}

/** Probabilidade (fração) → "2,58%". Valores minúsculos viram "menos de 0,001%". */
export function formatarPct(p: number, casas = 2): string {
  const pct = p * 100
  if (pct > 0 && pct < 10 ** -casas) return `menos de ${(10 ** -casas).toFixed(casas).replace('.', ',')}%`
  return `${pct.toFixed(casas).replace('.', ',')}%`
}

/**
 * Probabilidade (fração) → "1 em N": 0,0258 → "1 em 39"; 6,6e-6 → "1 em 152.170". Abaixo de 10 usa uma casa
 * ("1 em 3,8"). Zero (ou inválido) → "—".
 */
export function formatarUmEm(p: number): string {
  if (!(p > 0)) return '—'
  const n = 1 / p
  if (n < 10) return `1 em ${n.toFixed(1).replace('.', ',')}`
  return `1 em ${formatarInteiro(Math.round(n))}`
}

/** "2026-12-31" → "31/12/2026" */
export function formatarDataIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function partesSP(data: Date): Record<string, string> {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SP, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(data)
  const r: Record<string, string> = {}
  for (const p of partes) r[p.type] = p.value
  return r
}

/** Data e hora de Brasília: "2026-12-31T22:00:00-03:00" → "31/12/2026 22:00" */
export function formatarDataHoraSP(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = partesSP(d)
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

/** Para o campo "datetime-local" da tela: "2026-12-31T22:00:00-03:00" → "2026-12-31T22:00" (horário de Brasília). */
export function isoParaCampoLocalSP(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = partesSP(d)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/** Volta do campo da tela para ISO com o fuso de Brasília (sem horário de verão desde 2019). */
export function campoLocalSPParaIso(campo: string): string {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(campo) ? `${campo}:00-03:00` : ''
}

/** Data de hoje em Brasília, yyyy-mm-dd. */
export function hojeIsoSP(agoraMs: number = Date.now()): string {
  const p = partesSP(new Date(agoraMs))
  return `${p.year}-${p.month}-${p.day}`
}

export interface Contagem {
  encerrado: boolean
  dias: number
  horas: number
  minutos: number
}

/** Quanto falta até uma data/hora (ISO). Depois do prazo: encerrado. */
export function contagemRegressiva(ateIso: string, agoraMs: number): Contagem {
  const fim = Date.parse(ateIso)
  const falta = fim - agoraMs
  if (Number.isNaN(fim) || falta <= 0) return { encerrado: true, dias: 0, horas: 0, minutos: 0 }
  const dias = Math.floor(falta / 86_400_000)
  const horas = Math.floor((falta % 86_400_000) / 3_600_000)
  const minutos = Math.floor((falta % 3_600_000) / 60_000)
  return { encerrado: false, dias, horas, minutos }
}
