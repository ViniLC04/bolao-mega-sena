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

/** Link público do bolão: resumo (só totais). */
export interface ResumoBolaoPorLink {
  bolao_id: string
  nome: string
  concurso_alvo: number
  /** null enquanto as inscrições estão abertas */
  n_cotas: number | null
  cota_cent: number | null
  status: 'aberto' | 'rascunho' | 'congelado'
  congelado_em: string | null
  hash: string | null
  jogos: number
  custo_cent: number
  cotas_vendidas: number
  cotas_pagas: number
  previsto_cent: number
  arrecadado_cent: number
  vias_entregues: number
  inscricoes_ate: string | null
}

/** Quem está no bolão: SÓ o primeiro nome (homônimos numerados) e as cotas. */
export interface ParticipanteDoLink {
  nome: string
  qtd: number
}

/** Tudo do link público de um bolão. Link errado ou desligado = `resumo` nulo. */
export async function carregarBolaoPorLink(token: string): Promise<{ resumo: ResumoBolaoPorLink | null; participantes: ParticipanteDoLink[]; erro: string | null }> {
  const [r, p] = await Promise.all([supabase.rpc('publico_bolao', { p_token: token }), supabase.rpc('publico_bolao_participantes', { p_token: token })])
  if (r.error || p.error) return { resumo: null, participantes: [], erro: 'Não consegui carregar agora. Tente de novo.' }
  const linhas = (r.data ?? []) as ResumoBolaoPorLink[]
  return { resumo: linhas[0] ?? null, participantes: (p.data ?? []) as ParticipanteDoLink[], erro: null }
}

export async function carregarJogosPorLink(token: string): Promise<{ jogos: JogoPublico[]; erro: string | null }> {
  const { data, error } = await supabase.rpc('publico_bolao_jogos', { p_token: token })
  if (error) return { jogos: [], erro: 'Não consegui carregar os jogos agora.' }
  return { jogos: (data ?? []) as JogoPublico[], erro: null }
}

/** Uma linha por bolão em que a pessoa dona do link participa. */
export interface MinhaParticipacaoLinha {
  participante: string
  bolao_id: string
  bolao_nome: string
  concurso_alvo: number
  n_cotas: number | null
  status: 'aberto' | 'rascunho' | 'congelado'
  congelado_em: string | null
  hash: string | null
  qtd: number
  valor_devido_cent: number
  pago: boolean
  via_entregue: boolean
  custo_cent: number
  cota_cent: number | null
  inscricoes_ate: string | null
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
