// Visão pública (sem login): só duas funções do banco, que devolvem totais e jogos de bolões CONGELADOS, sem nomes.
import { supabase } from './supabase'

export interface BolaoPublico {
  id: string
  nome: string
  concurso_alvo: number
  n_cotas: number
  cota_cent: number | null
  congelado_em: string
  hash: string
  jogos: number
  custo_cent: number
  cotas_vendidas: number
  cotas_pagas: number
  arrecadado_cent: number
  vias_entregues: number
}

export interface JogoPublico {
  recibo_ordem: number
  k: number
  g: number
  jogo_ordem: number
  dezenas: number[]
}

/** Uma linha por bolão em que a pessoa dona do link participa. */
export interface MinhaParticipacaoLinha {
  participante: string
  bolao_id: string
  bolao_nome: string
  concurso_alvo: number
  n_cotas: number
  status: 'rascunho' | 'congelado'
  congelado_em: string | null
  hash: string | null
  qtd: number
  valor_devido_cent: number
  pago: boolean
  via_entregue: boolean
  custo_cent: number
  cota_cent: number | null
}

/** Link pessoal: só os bolões da própria pessoa. Link errado ou desligado = lista vazia. */
export async function carregarMinhaParticipacao(token: string): Promise<{ linhas: MinhaParticipacaoLinha[]; erro: string | null }> {
  const { data, error } = await supabase.rpc('publico_participante', { p_token: token })
  if (error) return { linhas: [], erro: 'Não consegui carregar agora. Tente de novo.' }
  return { linhas: (data ?? []) as MinhaParticipacaoLinha[], erro: null }
}

export async function carregarMeusJogos(token: string, bolaoId: string): Promise<{ jogos: JogoPublico[]; erro: string | null }> {
  const { data, error } = await supabase.rpc('publico_participante_jogos', { p_token: token, p_bolao: bolaoId })
  if (error) return { jogos: [], erro: 'Não consegui carregar os jogos agora.' }
  return { jogos: (data ?? []) as JogoPublico[], erro: null }
}

/** Números dos concursos-Virada (lista editada pelo ADM; pública porque só tem números de concurso). */
export async function carregarViradasPublicas(): Promise<number[]> {
  const { data, error } = await supabase.rpc('publico_viradas')
  return error || !Array.isArray(data) ? [] : (data as number[])
}

export async function carregarBoloesPublicos(): Promise<{ boloes: BolaoPublico[]; erro: string | null }> {
  const { data, error } = await supabase.rpc('publico_boloes')
  if (error) return { boloes: [], erro: 'Não consegui carregar os bolões agora.' }
  return { boloes: (data ?? []) as BolaoPublico[], erro: null }
}

export async function carregarJogosPublicos(bolaoId: string): Promise<{ jogos: JogoPublico[]; erro: string | null }> {
  const { data, error } = await supabase.rpc('publico_jogos', { p_bolao: bolaoId })
  if (error) return { jogos: [], erro: 'Não consegui carregar os jogos agora.' }
  return { jogos: (data ?? []) as JogoPublico[], erro: null }
}
