// Participantes, cotas e caixinha (só o ADM acessa; o banco recusa qualquer outra pessoa).
import { supabase } from './supabase'

export interface Participante {
  id: string
  nome: string
  contato: string | null
  /** segredo do link pessoal (64 hexadecimais); só o ADM lê */
  link_token: string | null
  link_ativo: boolean
}

/** 32 bytes aleatórios do navegador em hexadecimal (64 caracteres). */
export function gerarTokenDoLink(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Endereço completo do link pessoal. */
export function enderecoDoLink(token: string): string {
  return `${window.location.origin}/#/p/${token}`
}

/** Liga o link pessoal (cria o segredo se ainda não existe; `renovar` troca por outro e o antigo para de funcionar). */
export async function ligarLink(p: Participante, renovar = false): Promise<{ token: string | null; erro: string | null }> {
  const token = !renovar && p.link_token ? p.link_token : gerarTokenDoLink()
  const { error } = await supabase.from('participantes').update({ link_token: token, link_ativo: true }).eq('id', p.id)
  return error ? { token: null, erro: 'Não consegui ligar o link agora.' } : { token, erro: null }
}

export async function desligarLink(id: string): Promise<string | null> {
  const { error } = await supabase.from('participantes').update({ link_ativo: false }).eq('id', id)
  return error ? 'Não consegui desligar o link agora.' : null
}

export interface CotaLinha {
  id: string
  participante_id: string
  bolao_id: string
  qtd: number
  valor_devido_cent: number
  /** quantas cotas já têm o PIX confirmado */
  qtd_paga: number
  /** 'link' = a própria pessoa se inscreveu pelo link do bolão */
  origem: 'adm' | 'link'
  /** todas as cotas pagas (calculado pelo banco) */
  pago: boolean
  via_entregue: boolean
  criado_em: string
  participantes: { nome: string; contato: string | null } | null
  comprovantes: { id: string; caminho: string; nome_arquivo: string | null }[]
}

export interface MovCaixinha {
  id: string
  valor_cent: number
  motivo: string
  criado_em: string
}

/** Traduz erros do banco (as regras do servidor já vêm em português) para uma frase simples. */
function traduzir(codigo: string | undefined, texto: string, padrao: string): string {
  if (codigo === 'P0001') return texto.replace(/^.*?ERROR:\s*/, '')
  if (codigo === '23503') return 'Não dá para apagar: há cotas ligadas a este participante. Remova as cotas primeiro.'
  if (codigo === '23505') return 'Esta pessoa já tem cotas neste bolão. Remova o registro dela e inclua de novo com a quantidade certa.'
  if (codigo === '42501' || /row-level security|permission denied/i.test(texto)) return 'Só o ADM pode fazer isso.'
  return padrao
}

export async function listarParticipantes(): Promise<{ lista: Participante[]; erro: string | null }> {
  const { data, error } = await supabase.from('participantes').select('id, nome, contato, link_token, link_ativo').order('nome')
  if (error) return { lista: [], erro: 'Não consegui ler os participantes.' }
  return { lista: (data ?? []) as Participante[], erro: null }
}

export async function criarParticipante(nome: string, contato: string): Promise<{ participante: Participante | null; erro: string | null }> {
  const { data, error } = await supabase.from('participantes').insert({ nome: nome.trim(), contato: contato.trim() || null }).select('id, nome, contato, link_token, link_ativo').single()
  if (error || !data) return { participante: null, erro: traduzir(error?.code, error?.message ?? '', 'Não consegui salvar o participante.') }
  return { participante: data as Participante, erro: null }
}

export async function atualizarParticipante(id: string, nome: string, contato: string): Promise<string | null> {
  const { error } = await supabase.from('participantes').update({ nome: nome.trim(), contato: contato.trim() || null }).eq('id', id)
  return error ? traduzir(error.code, error.message, 'Não consegui salvar o participante.') : null
}

export async function apagarParticipante(id: string): Promise<string | null> {
  const { error } = await supabase.from('participantes').delete().eq('id', id)
  return error ? traduzir(error.code, error.message, 'Não consegui apagar o participante.') : null
}

/** Cotas de um bolão, com o nome da pessoa. */
export async function listarCotas(bolaoId: string): Promise<{ lista: CotaLinha[]; erro: string | null }> {
  const { data, error } = await supabase
    .from('cotas')
    .select('id, participante_id, bolao_id, qtd, valor_devido_cent, qtd_paga, origem, pago, via_entregue, criado_em, participantes(nome, contato), comprovantes(id, caminho, nome_arquivo)')
    .eq('bolao_id', bolaoId)
  if (error) return { lista: [], erro: 'Não consegui ler as cotas.' }
  const lista = ((data ?? []) as unknown as CotaLinha[]).sort((a, b) => (a.participantes?.nome ?? '').localeCompare(b.participantes?.nome ?? '', 'pt-BR'))
  return { lista, erro: null }
}

export async function incluirCota(participanteId: string, bolaoId: string, qtd: number, valorDevidoCent: number): Promise<string | null> {
  const { error } = await supabase.from('cotas').insert({ participante_id: participanteId, bolao_id: bolaoId, qtd, valor_devido_cent: valorDevidoCent })
  return error ? traduzir(error.code, error.message, 'Não consegui incluir as cotas.') : null
}

export async function marcarCota(id: string, campo: 'via_entregue', valor: boolean): Promise<string | null> {
  const { error } = await supabase.from('cotas').update({ [campo]: valor }).eq('id', id)
  return error ? traduzir(error.code, error.message, 'Não consegui salvar a marcação.') : null
}

/** Confirma o pagamento de `qtdPaga` das cotas da pessoa (0 desfaz; a quantidade total confirma tudo). */
export async function definirPagas(id: string, qtdPaga: number): Promise<string | null> {
  const { error } = await supabase.from('cotas').update({ qtd_paga: qtdPaga }).eq('id', id)
  return error ? traduzir(error.code, error.message, 'Não consegui confirmar o pagamento.') : null
}

/** O ADM muda a quantidade de cotas de uma pessoa (inclusive para menos). O valor devido acompanha; as pagas nunca passam do total. */
export async function alterarQtdCota(c: { id: string; qtdPaga: number }, novaQtd: number, cotaCent: number): Promise<string | null> {
  const { error } = await supabase
    .from('cotas')
    .update({ qtd_paga: Math.min(c.qtdPaga, novaQtd), qtd: novaQtd, valor_devido_cent: novaQtd * cotaCent })
    .eq('id', c.id)
  return error ? traduzir(error.code, error.message, 'Não consegui alterar a quantidade de cotas.') : null
}

/** Link temporário (60 s) para ver um comprovante enviado pela pessoa. */
export async function linkDoComprovante(caminho: string): Promise<{ url: string | null; erro: string | null }> {
  const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(caminho, 60)
  return error || !data ? { url: null, erro: 'Não consegui abrir o comprovante agora.' } : { url: data.signedUrl, erro: null }
}

export async function removerCota(id: string): Promise<string | null> {
  const { error } = await supabase.from('cotas').delete().eq('id', id)
  return error ? traduzir(error.code, error.message, 'Não consegui remover as cotas.') : null
}

export async function listarCaixinha(bolaoId: string): Promise<{ lista: MovCaixinha[]; erro: string | null }> {
  const { data, error } = await supabase.from('caixinha_mov').select('id, valor_cent, motivo, criado_em').eq('bolao_id', bolaoId).order('criado_em')
  if (error) return { lista: [], erro: 'Não consegui ler a caixinha.' }
  return { lista: (data ?? []) as MovCaixinha[], erro: null }
}

export async function lancarCaixinha(bolaoId: string, valorCent: number, motivo: string): Promise<string | null> {
  const { error } = await supabase.from('caixinha_mov').insert({ bolao_id: bolaoId, valor_cent: valorCent, motivo: motivo.trim() })
  return error ? traduzir(error.code, error.message, 'Não consegui lançar na caixinha.') : null
}

export async function removerLancamento(id: string): Promise<string | null> {
  const { error } = await supabase.from('caixinha_mov').delete().eq('id', id)
  return error ? traduzir(error.code, error.message, 'Não consegui remover o lançamento.') : null
}
