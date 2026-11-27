// Formulário das premissas do gerador ↔ objeto `Premissas` do motor. Puro (sem tela), para poder testar.
import { lerListaNumeros } from '../data/concursos'
import type { EscopoMaxIguais, Premissas } from '../engine/gerador'
import { maisSorteadas, type ConcursoHist, type FiltroPeriodo } from '../engine/historico'

export type TipoPeriodo = 'tudo' | 'ultimos_anos' | 'mes' | 'viradas' | 'concursos' | 'datas'

export const NOMES_PERIODO: Record<TipoPeriodo, string> = {
  tudo: 'Todos os concursos',
  ultimos_anos: 'Últimos N anos',
  mes: 'Um mês, de qualquer ano',
  viradas: 'Só as Viradas',
  concursos: 'Faixa de concursos',
  datas: 'Faixa de datas',
}

export interface FormPremissas {
  maxIguaisOn: boolean
  maxIguaisN: string
  maxIguaisEscopo: EscopoMaxIguais
  consecOn: boolean
  consecMax: string
  paresOn: boolean
  paresMin: string
  paresMax: string
  somaOn: boolean
  somaMin: string
  somaMax: string
  linhasOn: boolean
  linhasMax: string
  obrigOn: boolean
  obrigDezenas: string
  /** "todos" ou um número: cada obrigatória em pelo menos M jogos */
  obrigMinJogos: string
  proibOn: boolean
  proibDezenas: string
  freqOn: boolean
  freqX: string
  freqModo: 'restringir' | 'ponderar'
  freqPeso: string
  histOn: boolean
  /** vazio = sem limite */
  histQuinas: string
  histQuadras: string
  periodo: TipoPeriodo
  periodoAnos: string
  periodoMes: string
  periodoConcDe: string
  periodoConcAte: string
  periodoDe: string
  periodoAte: string
}

/** Padrão do SPEC: só "máx. de números iguais = 5, em todo o concurso" (nunca repete combinação de 6). */
export const FORM_PADRAO: FormPremissas = {
  maxIguaisOn: true,
  maxIguaisN: '5',
  maxIguaisEscopo: 'concurso',
  consecOn: false,
  consecMax: '3',
  paresOn: false,
  paresMin: '2',
  paresMax: '4',
  somaOn: false,
  somaMin: '',
  somaMax: '',
  linhasOn: false,
  linhasMax: '3',
  obrigOn: false,
  obrigDezenas: '',
  obrigMinJogos: 'todos',
  proibOn: false,
  proibDezenas: '',
  freqOn: false,
  freqX: '30',
  freqModo: 'ponderar',
  freqPeso: '3',
  histOn: false,
  histQuinas: '0',
  histQuadras: '',
  periodo: 'tudo',
  periodoAnos: '10',
  periodoMes: '12',
  periodoConcDe: '',
  periodoConcAte: '',
  periodoDe: '',
  periodoAte: '',
}

function inteiro(texto: string, min: number, max: number): number | null {
  const t = texto.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return n >= min && n <= max ? n : null
}

/** "5 12, 30" → [5,12,30]; null se houver algo que não é dezena de 1 a 60. */
export function lerDezenas(texto: string): number[] | null {
  const l = lerListaNumeros(texto)
  if (!l || l.length === 0 || l.some((d) => d < 1 || d > 60)) return null
  return l
}

/** Converte a escolha de período da tela no filtro do motor. */
export function periodoDeForm(f: FormPremissas, viradas: readonly number[], referencia: string): { filtro: FiltroPeriodo | null; erro: string | null } {
  switch (f.periodo) {
    case 'tudo':
      return { filtro: { tipo: 'tudo' }, erro: null }
    case 'ultimos_anos': {
      const a = inteiro(f.periodoAnos, 1, 40)
      return a === null ? { filtro: null, erro: 'Período: informe quantos anos (1 a 40).' } : { filtro: { tipo: 'ultimos_anos', anos: a, referencia }, erro: null }
    }
    case 'mes': {
      const m = inteiro(f.periodoMes, 1, 12)
      return m === null ? { filtro: null, erro: 'Período: escolha o mês.' } : { filtro: { tipo: 'mes', mes: m }, erro: null }
    }
    case 'viradas':
      return viradas.length === 0
        ? { filtro: null, erro: 'Período: a lista de Viradas está vazia. Preencha na tela Concursos.' }
        : { filtro: { tipo: 'viradas', numeros: viradas }, erro: null }
    case 'concursos': {
      const de = f.periodoConcDe.trim() === '' ? undefined : inteiro(f.periodoConcDe, 1, 100000)
      const ate = f.periodoConcAte.trim() === '' ? undefined : inteiro(f.periodoConcAte, 1, 100000)
      if (de === null || ate === null) return { filtro: null, erro: 'Período: use números de concurso inteiros.' }
      return { filtro: { tipo: 'concursos', de, ate }, erro: null }
    }
    case 'datas': {
      const de = f.periodoDe || undefined
      const ate = f.periodoAte || undefined
      return { filtro: { tipo: 'datas', de, ate }, erro: null }
    }
  }
}

/**
 * Valida o formulário e monta as premissas LIGADAS. `periodoHist` é o histórico já filtrado pelo período
 * escolhido (usado por "mais frequentes" e pelo histórico de quinas/quadras).
 */
export function deFormPremissas(f: FormPremissas, periodoHist: readonly ConcursoHist[]): { premissas: Premissas; erros: string[] } {
  const erros: string[] = []
  const p: Premissas = {}

  if (f.maxIguaisOn) {
    const n = inteiro(f.maxIguaisN, 0, 59)
    if (n === null) erros.push('Máx. de números iguais: informe um número inteiro (0 a 59).')
    else p.maxIguais = { nMax: n, escopo: f.maxIguaisEscopo }
  }
  if (f.consecOn) {
    const n = inteiro(f.consecMax, 1, 60)
    if (n === null) erros.push('Máx. de consecutivos: informe um número inteiro (1 a 60).')
    else p.maxConsecutivos = { max: n }
  }
  if (f.paresOn) {
    const a = inteiro(f.paresMin, 0, 60)
    const b = inteiro(f.paresMax, 0, 60)
    if (a === null || b === null) erros.push('Pares e ímpares: informe o mínimo e o máximo de pares (números inteiros).')
    else if (a > b) erros.push('Pares e ímpares: o mínimo não pode ser maior que o máximo.')
    else p.paresImpares = { minPares: a, maxPares: b }
  }
  if (f.somaOn) {
    const a = inteiro(f.somaMin, 0, 3600)
    const b = inteiro(f.somaMax, 0, 3600)
    if (a === null || b === null) erros.push('Soma: informe a soma mínima e a máxima (números inteiros).')
    else if (a > b) erros.push('Soma: a mínima não pode ser maior que a máxima.')
    else p.soma = { min: a, max: b }
  }
  if (f.linhasOn) {
    const n = inteiro(f.linhasMax, 1, 10)
    if (n === null) erros.push('Linhas do volante: informe o máximo por linha (1 a 10).')
    else p.linhas = { maxPorLinha: n }
  }
  if (f.obrigOn) {
    const d = lerDezenas(f.obrigDezenas)
    const m = f.obrigMinJogos.trim().toLowerCase() === 'todos' ? ('todos' as const) : inteiro(f.obrigMinJogos, 1, 1000)
    if (!d) erros.push('Obrigatórios: escreva dezenas de 1 a 60 separadas por vírgula ou espaço.')
    else if (m === null) erros.push('Obrigatórios: em quantos jogos? Escreva "todos" ou um número.')
    else p.obrigatorios = { dezenas: d, minJogos: m }
  }
  if (f.proibOn) {
    const d = lerDezenas(f.proibDezenas)
    if (!d) erros.push('Proibidos: escreva dezenas de 1 a 60 separadas por vírgula ou espaço.')
    else p.proibidos = { dezenas: d }
  }
  if (p.obrigatorios && p.proibidos && p.obrigatorios.dezenas.some((d) => p.proibidos!.dezenas.includes(d))) {
    erros.push('Há dezena ao mesmo tempo obrigatória e proibida.')
  }
  if (f.freqOn) {
    const x = inteiro(f.freqX, 6, 60)
    const peso = inteiro(f.freqPeso, 1, 100)
    if (x === null) erros.push('Mais frequentes: informe quantos números (6 a 60).')
    else if (f.freqModo === 'ponderar' && peso === null) erros.push('Mais frequentes: o peso deve ser um número inteiro (1 a 100).')
    else if (periodoHist.length === 0) erros.push('Mais frequentes: o período escolhido não tem nenhum concurso.')
    else p.frequentes = { dezenas: maisSorteadas(periodoHist, x), modo: f.freqModo, peso: f.freqModo === 'ponderar' ? (peso ?? 3) : undefined }
  }
  if (f.histOn) {
    const q = f.histQuinas.trim() === '' ? undefined : inteiro(f.histQuinas, 0, 100000)
    const d = f.histQuadras.trim() === '' ? undefined : inteiro(f.histQuadras, 0, 100000)
    if (q === null || d === null) erros.push('Histórico: use números inteiros (ou deixe em branco para não limitar).')
    else if (q === undefined && d === undefined) erros.push('Histórico: informe o máximo de quinas e/ou de quadras.')
    else if (periodoHist.length === 0) erros.push('Histórico: o período escolhido não tem nenhum concurso.')
    else p.historico = { maxQuinas: q, maxQuadras: d }
  }
  return { premissas: p, erros }
}

/** Período efetivo a usar quando alguma premissa depende dele. */
export function dependeDoPeriodo(f: FormPremissas): boolean {
  return f.freqOn || f.histOn
}
