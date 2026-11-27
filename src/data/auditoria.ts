// Histórico de alterações (tabela auditoria): só o ADM lê.
import { supabase } from './supabase'

export interface EventoAuditoria {
  id: number
  quando: string
  usuario: string | null
  acao: string
  tabela: string | null
  registro: string | null
  detalhe: Record<string, unknown> | null
}

export const TABELAS_AUDITADAS = ['bolaos', 'participantes', 'cotas', 'caixinha_mov', 'concursos', 'rules_versions', 'config', 'admins'] as const

const POR_PAGINA = 50

/** Eventos do mais novo para o mais antigo. `antesDoId` continua de onde parou. */
export async function carregarAuditoria(tabela: string | null, antesDoId: number | null): Promise<{ eventos: EventoAuditoria[]; fim: boolean; erro: string | null }> {
  let q = supabase.from('auditoria').select('id, quando, usuario, acao, tabela, registro, detalhe').order('id', { ascending: false }).limit(POR_PAGINA)
  if (tabela) q = q.eq('tabela', tabela)
  if (antesDoId !== null) q = q.lt('id', antesDoId)
  const { data, error } = await q
  if (error) return { eventos: [], fim: true, erro: 'Não consegui ler o histórico.' }
  const eventos = (data ?? []) as EventoAuditoria[]
  return { eventos, fim: eventos.length < POR_PAGINA, erro: null }
}
