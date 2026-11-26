// Leitor da planilha oficial Mega-Sena.xlsx da Caixa (SPEC 9.5).
//
// Por que um leitor próprio: o arquivo oficial usa o prefixo `x:` no XML (<x:row>) e as células das
// linhas de dados NÃO têm endereço (A2, B2...). Bibliotecas comuns (exceljs, read-excel-file) falham.
// Funciona no navegador e no Node (só usa fflate para abrir o zip).
import { strFromU8, unzipSync } from 'fflate'

export interface ConcursoPlanilha {
  numero: number
  /** yyyy-mm-dd */
  data: string
  dezenas: number[]
  ganhadoresSena: number
  cidades: string
  rateioSenaCent: number
  ganhadoresQuina: number
  rateioQuinaCent: number
  ganhadoresQuadra: number
  rateioQuadraCent: number
  acumuladoSenaCent: number
  arrecadacaoCent: number
  estimativaProximoCent: number
  acumuladoViradaCent: number
  observacao: string
}

/** "R$1.234,56" → 123456 (inteiro, sem float). Texto vazio → 0. Formato estranho → erro. */
export function reaisParaCentavos(texto: string): number {
  const t = texto.trim()
  if (t === '') return 0
  const m = /^R\$\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/.exec(t)
  if (!m) throw new Error(`Valor em reais inválido: "${texto}"`)
  const inteiro = Number(m[1].replace(/\./g, ''))
  const centavos = Number((m[2] ?? '').padEnd(2, '0') || '0')
  return inteiro * 100 + centavos
}

/** "15/11/2026" → "2026-11-15" */
export function dataBrParaIso(texto: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim())
  if (!m) throw new Error(`Data inválida: "${texto}"`)
  return `${m[3]}-${m[2]}-${m[1]}`
}

const desescapar = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

const RE_LINHA = /<(?:x:)?row\b[^>]*>([\s\S]*?)<\/(?:x:)?row>/g
const RE_CELULA = /<(?:x:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g
const RE_VALOR = /<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/

/** Lê o sharedStrings.xml (lista de textos usados nos cabeçalhos). */
export function lerTextosCompartilhados(xml: string): string[] {
  const itens: string[] = []
  for (const si of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const partes = [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => desescapar(t[1]))
    itens.push(partes.join(''))
  }
  return itens
}

function letraParaIndice(letras: string): number {
  let n = 0
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

/** Devolve as linhas da planilha como listas de textos (posição = coluna). */
export function lerLinhas(sheetXml: string, textos: string[]): string[][] {
  const linhas: string[][] = []
  for (const l of sheetXml.matchAll(RE_LINHA)) {
    const celulas: string[] = []
    let proxima = 0
    for (const c of l[1].matchAll(RE_CELULA)) {
      const attrs = c[1]
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)
      const col = ref ? letraParaIndice(ref[1]) : proxima
      const tipo = /\bt="([^"]+)"/.exec(attrs)?.[1]
      const bruto = c[2] !== undefined ? RE_VALOR.exec(c[2])?.[1] : undefined
      let valor = ''
      if (bruto !== undefined) {
        valor = tipo === 's' ? (textos[Number(bruto)] ?? '') : desescapar(bruto)
      }
      celulas[col] = valor
      proxima = col + 1
    }
    for (let i = 0; i < celulas.length; i++) celulas[i] ??= ''
    linhas.push(celulas)
  }
  return linhas
}

const COLUNAS = {
  numero: 'Concurso',
  data: 'Data do Sorteio',
  bolas: ['Bola1', 'Bola2', 'Bola3', 'Bola4', 'Bola5', 'Bola6'],
  ganhadoresSena: 'Ganhadores 6 acertos',
  cidades: 'Cidade / UF',
  rateioSena: 'Rateio 6 acertos',
  ganhadoresQuina: 'Ganhadores 5 acertos',
  rateioQuina: 'Rateio 5 acertos',
  ganhadoresQuadra: 'Ganhadores 4 acertos',
  rateioQuadra: 'Rateio 4 acertos',
  acumuladoSena: 'Acumulado 6 acertos',
  arrecadacao: 'Arrecadação Total',
  estimativa: 'Estimativa prêmio',
  acumuladoVirada: 'Acumulado Sorteio Especial Mega da Virada',
  observacao: 'Observação',
} as const

const inteiro = (t: string, nome: string): number => {
  if (t.trim() === '') return 0
  const n = Number(t)
  if (!Number.isInteger(n)) throw new Error(`Número inteiro inválido em "${nome}": "${t}"`)
  return n
}

/** Converte as linhas (cabeçalho + dados) em concursos. Acha as colunas pelo NOME do cabeçalho. */
export function linhasParaConcursos(linhas: string[][]): ConcursoPlanilha[] {
  if (linhas.length === 0) throw new Error('Planilha vazia.')
  const cab = linhas[0].map((t) => t.trim())
  const col = (nome: string): number => {
    const i = cab.indexOf(nome)
    if (i < 0) throw new Error(`Coluna não encontrada na planilha: "${nome}"`)
    return i
  }
  const idx = {
    numero: col(COLUNAS.numero),
    data: col(COLUNAS.data),
    bolas: COLUNAS.bolas.map(col),
    ganhadoresSena: col(COLUNAS.ganhadoresSena),
    cidades: col(COLUNAS.cidades),
    rateioSena: col(COLUNAS.rateioSena),
    ganhadoresQuina: col(COLUNAS.ganhadoresQuina),
    rateioQuina: col(COLUNAS.rateioQuina),
    ganhadoresQuadra: col(COLUNAS.ganhadoresQuadra),
    rateioQuadra: col(COLUNAS.rateioQuadra),
    acumuladoSena: col(COLUNAS.acumuladoSena),
    arrecadacao: col(COLUNAS.arrecadacao),
    estimativa: col(COLUNAS.estimativa),
    acumuladoVirada: col(COLUNAS.acumuladoVirada),
    observacao: col(COLUNAS.observacao),
  }

  return linhas.slice(1).map((l) => {
    const v = (i: number) => (l[i] ?? '').trim()
    return {
      numero: inteiro(v(idx.numero), 'Concurso'),
      data: dataBrParaIso(v(idx.data)),
      dezenas: idx.bolas.map((i) => inteiro(v(i), 'Bola')),
      ganhadoresSena: inteiro(v(idx.ganhadoresSena), 'Ganhadores 6 acertos'),
      cidades: v(idx.cidades),
      rateioSenaCent: reaisParaCentavos(v(idx.rateioSena)),
      ganhadoresQuina: inteiro(v(idx.ganhadoresQuina), 'Ganhadores 5 acertos'),
      rateioQuinaCent: reaisParaCentavos(v(idx.rateioQuina)),
      ganhadoresQuadra: inteiro(v(idx.ganhadoresQuadra), 'Ganhadores 4 acertos'),
      rateioQuadraCent: reaisParaCentavos(v(idx.rateioQuadra)),
      acumuladoSenaCent: reaisParaCentavos(v(idx.acumuladoSena)),
      arrecadacaoCent: reaisParaCentavos(v(idx.arrecadacao)),
      estimativaProximoCent: reaisParaCentavos(v(idx.estimativa)),
      acumuladoViradaCent: reaisParaCentavos(v(idx.acumuladoVirada)),
      observacao: v(idx.observacao),
    }
  })
}

/** Lê o arquivo .xlsx inteiro (bytes) e devolve os concursos. */
export function lerPlanilhaXlsx(bytes: Uint8Array): ConcursoPlanilha[] {
  const arquivos = unzipSync(bytes, {
    filter: (f) => f.name === 'xl/worksheets/sheet1.xml' || f.name === 'xl/sharedStrings.xml',
  })
  const sheet = arquivos['xl/worksheets/sheet1.xml']
  if (!sheet) throw new Error('Arquivo não parece a planilha oficial (falta xl/worksheets/sheet1.xml).')
  const shared = arquivos['xl/sharedStrings.xml']
  const textos = shared ? lerTextosCompartilhados(strFromU8(shared)) : []
  return linhasParaConcursos(lerLinhas(strFromU8(sheet), textos))
}

/** Validações do SPEC 9.2: sequência sem lacunas, 6 dezenas distintas 1..60, valores ≥ 0. */
export function validarConcursos(concursos: ConcursoPlanilha[]): string[] {
  const erros: string[] = []
  concursos.forEach((c, i) => {
    if (c.numero !== i + 1) erros.push(`Sequência quebrada: posição ${i + 1} tem concurso ${c.numero}`)
    const distintas = new Set(c.dezenas)
    if (c.dezenas.length !== 6 || distintas.size !== 6 || c.dezenas.some((d) => d < 1 || d > 60)) {
      erros.push(`Concurso ${c.numero}: dezenas inválidas (${c.dezenas.join('-')})`)
    }
    const cents = [
      c.rateioSenaCent, c.rateioQuinaCent, c.rateioQuadraCent, c.acumuladoSenaCent,
      c.arrecadacaoCent, c.estimativaProximoCent, c.acumuladoViradaCent,
    ]
    if (cents.some((x) => x < 0)) erros.push(`Concurso ${c.numero}: valor negativo`)
    if ([c.ganhadoresSena, c.ganhadoresQuina, c.ganhadoresQuadra].some((x) => x < 0)) {
      erros.push(`Concurso ${c.numero}: ganhadores negativo`)
    }
  })
  return erros
}
