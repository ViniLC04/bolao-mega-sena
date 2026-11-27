// Jogos de OUTROS bolões do mesmo concurso, para o cruzamento (SPEC seção 6).
import { supabase } from './supabase'

interface LinhaBolao {
  id: string
  status: 'rascunho' | 'congelado'
  recibos: { jogos: { dezenas: number[] }[] }[]
}

export interface JogosOutros {
  /** jogos de bolões CONGELADOS (valem como cobertura; o banco impede repetir combinação com eles) */
  jogos: number[][]
  congelados: number
  rascunhos: number
}

export async function carregarJogosOutrosBoloes(concursoAlvo: number): Promise<{ dados: JogosOutros; erro: string | null }> {
  const vazio: JogosOutros = { jogos: [], congelados: 0, rascunhos: 0 }
  const { data, error } = await supabase
    .from('bolaos')
    .select('id, status, recibos(jogos(dezenas))')
    .eq('concurso_alvo', concursoAlvo)
  if (error) return { dados: vazio, erro: 'Não consegui ler os outros bolões do concurso.' }
  const dados: JogosOutros = { jogos: [], congelados: 0, rascunhos: 0 }
  for (const b of (data ?? []) as unknown as LinhaBolao[]) {
    if (b.status === 'congelado') {
      dados.congelados++
      for (const r of b.recibos) for (const j of r.jogos) dados.jogos.push([...j.dezenas])
    } else dados.rascunhos++
  }
  return { dados, erro: null }
}
