// Contagens simples para o Painel. Cada uma só funciona para quem tem permissão (RLS decide).
import { supabase } from './supabase'

export type TabelaContavel = 'bolaos' | 'concursos' | 'combinacoes_cobertas'

/** Quantas linhas a tabela tem; null se não foi possível contar. */
export async function contar(tabela: TabelaContavel): Promise<number | null> {
  const { count, error } = await supabase.from(tabela).select('*', { count: 'exact', head: true })
  return error ? null : count
}
