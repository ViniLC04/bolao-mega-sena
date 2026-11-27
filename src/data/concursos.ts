// Concursos da Mega-Sena no banco (dados públicos). Só se insere: NUNCA se sobrescreve (SPEC 9.2).
import type { ConcursoPlanilha } from './planilha'
import { supabase } from './supabase'

export interface ConcursoResumo {
  numero: number
  /** yyyy-mm-dd */
  data: string
  dezenas: number[]
}

const PAGINA = 1000
const BLOCO = 200
export const FONTE_PLANILHA = 'Planilha oficial da Caixa (Mega-Sena.xlsx)'

/** Lê todos os concursos já gravados (número, data e dezenas), de 1000 em 1000. */
export async function carregarConcursos(): Promise<{ concursos: ConcursoResumo[]; erro: string | null }> {
  const todos: ConcursoResumo[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from('concursos')
      .select('numero, data, dezenas')
      .order('numero', { ascending: true })
      .range(de, de + PAGINA - 1)
    if (error) return { concursos: [], erro: 'Não consegui ler os concursos do banco.' }
    const linhas = (data ?? []) as ConcursoResumo[]
    todos.push(...linhas)
    if (linhas.length < PAGINA) break
  }
  return { concursos: todos, erro: null }
}

export interface ComparacaoPlanilha {
  /** concursos da planilha que ainda não estão no banco */
  novos: ConcursoPlanilha[]
  jaNoBanco: number
  /** concursos que existem nos dois lados mas com dezenas ou data diferentes (nunca são alterados) */
  divergentes: number[]
}

const mesmasDezenas = (a: number[], b: number[]) => [...a].sort((x, y) => x - y).join('-') === [...b].sort((x, y) => x - y).join('-')

export function compararComBanco(planilha: ConcursoPlanilha[], banco: ConcursoResumo[]): ComparacaoPlanilha {
  const porNumero = new Map(banco.map((c) => [c.numero, c]))
  const novos: ConcursoPlanilha[] = []
  const divergentes: number[] = []
  let jaNoBanco = 0
  for (const c of planilha) {
    const b = porNumero.get(c.numero)
    if (!b) {
      novos.push(c)
      continue
    }
    jaNoBanco++
    if (b.data !== c.data || !mesmasDezenas(b.dezenas, c.dezenas)) divergentes.push(c.numero)
  }
  return { novos, jaNoBanco, divergentes }
}

function linhaConcurso(c: ConcursoPlanilha) {
  return {
    numero: c.numero,
    data: c.data,
    dezenas: c.dezenas,
    arrecadacao_cent: c.arrecadacaoCent,
    estimativa_prox_cent: c.estimativaProximoCent,
    acumulado_virada_cent: c.acumuladoViradaCent,
    acumulado_sena_cent: c.acumuladoSenaCent,
    cidades: c.cidades || null,
    observacao: c.observacao || null,
    fonte: FONTE_PLANILHA,
    status: 'oficial_importado',
  }
}

function linhasFaixas(c: ConcursoPlanilha) {
  return [
    { concurso: c.numero, faixa: 6, ganhadores: c.ganhadoresSena, valor_cent: c.rateioSenaCent },
    { concurso: c.numero, faixa: 5, ganhadores: c.ganhadoresQuina, valor_cent: c.rateioQuinaCent },
    { concurso: c.numero, faixa: 4, ganhadores: c.ganhadoresQuadra, valor_cent: c.rateioQuadraCent },
  ]
}

function mensagemErro(codigo: string | undefined, texto: string): string {
  if (codigo === '23505') return 'Algum concurso já existe no banco (não sobrescrevo). Recarregue a página e confira de novo.'
  if (codigo === '42501' || /row-level security|permission/i.test(texto)) return 'Só o ADM pode importar concursos.'
  return 'Não consegui gravar os concursos agora.'
}

/**
 * Grava só os concursos NOVOS (e o rateio de cada um), em blocos. Devolve quantos gravou e o erro, se houve.
 * `progresso(feitos, total)` é chamado a cada bloco.
 */
export async function inserirConcursos(
  novos: ConcursoPlanilha[],
  progresso: (feitos: number, total: number) => void,
): Promise<{ gravados: number; erro: string | null }> {
  let gravados = 0
  progresso(0, novos.length)
  for (let i = 0; i < novos.length; i += BLOCO) {
    const bloco = novos.slice(i, i + BLOCO)
    const r1 = await supabase.from('concursos').insert(bloco.map(linhaConcurso))
    if (r1.error) return { gravados, erro: mensagemErro(r1.error.code, r1.error.message) }
    const r2 = await supabase.from('concurso_faixas').insert(bloco.flatMap(linhasFaixas))
    if (r2.error) return { gravados, erro: mensagemErro(r2.error.code, r2.error.message) }
    gravados += bloco.length
    progresso(gravados, novos.length)
  }
  return { gravados, erro: null }
}

// ---------- Lista de Viradas (editável; guardada na tabela config) ----------
const CHAVE_VIRADAS = 'viradas'

export async function carregarViradas(): Promise<{ numeros: number[]; erro: string | null }> {
  const { data, error } = await supabase.from('config').select('valor').eq('chave', CHAVE_VIRADAS).maybeSingle()
  if (error) return { numeros: [], erro: 'Não consegui ler a lista de Viradas.' }
  const v = (data as { valor: unknown } | null)?.valor
  const numeros = Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x)) : []
  return { numeros, erro: null }
}

export async function salvarViradas(numeros: number[]): Promise<string | null> {
  const { error } = await supabase.from('config').upsert({ chave: CHAVE_VIRADAS, valor: numeros, atualizado_em: new Date().toISOString() })
  return error ? 'Não consegui gravar a lista de Viradas.' : null
}

/** "1, 5, 10-12" → [1,5,10,11,12]; null se houver algo que não é número. */
export function lerListaNumeros(texto: string): number[] | null {
  const saida = new Set<number>()
  for (const parte of texto.split(/[\s,;]+/).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(parte)
    if (!m) return null
    const a = Number(m[1])
    const b = m[2] ? Number(m[2]) : a
    if (a < 1 || b < a || b - a > 5000) return null
    for (let n = a; n <= b; n++) saida.add(n)
  }
  return [...saida].sort((x, y) => x - y)
}

/** Sugestão: concursos sorteados em 31/12 (a planilha não marca quais são Virada; o ADM confere). */
export function sugerirViradas(concursos: { numero: number; data: string }[]): number[] {
  return concursos.filter((c) => c.data.endsWith('-12-31')).map((c) => c.numero)
}
