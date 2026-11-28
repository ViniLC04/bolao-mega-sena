// Conta do apostador (e-mail + senha, Supabase Auth). A conta sozinha não vê nada: só enxerga participações
// cujo link pessoal secreto ela apresentou (função vincular_minha_conta). O ADM é outro fluxo (data/auth.ts).
import { validarSenha } from '../engine/validacoes'
import type { MinhaParticipacaoLinha } from './publico'
import { supabase } from './supabase'

export type ResultadoConta = { ok: true; precisaConfirmar?: boolean } | { ok: false; erro: string }

export type ParticipacaoDaConta = MinhaParticipacaoLinha & { link_token: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function traduzir(mensagem: string, status?: number): string {
  if (status === 429 || /rate limit|too many/i.test(mensagem)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
  if (/invalid login credentials/i.test(mensagem)) return 'E-mail ou senha incorretos.'
  if (/signups? not allowed|signup is disabled/i.test(mensagem)) return 'O cadastro de contas ainda não foi liberado. Fale com o organizador.'
  if (/already registered|already been registered/i.test(mensagem)) return 'Este e-mail já tem conta. Use “Entrar”.'
  if (/password/i.test(mensagem)) return 'A senha não atende às regras: mínimo de 8 caracteres, com maiúscula, minúscula, número e símbolo.'
  return 'Não foi possível agora. Tente de novo em instantes.'
}

export async function criarConta(email: string, senha: string): Promise<ResultadoConta> {
  const e = email.trim().toLowerCase()
  if (!EMAIL.test(e)) return { ok: false, erro: 'Informe um e-mail válido.' }
  const problemas = validarSenha(senha)
  if (problemas.length > 0) return { ok: false, erro: problemas[0] }
  const { data, error } = await supabase.auth.signUp({ email: e, password: senha })
  if (error) return { ok: false, erro: traduzir(error.message, error.status) }
  // e-mail já existente: o Supabase devolve um usuário "falso" sem identidades e sem sessão
  if (data.user && (data.user.identities?.length ?? 0) === 0) return { ok: false, erro: 'Este e-mail já tem conta. Use “Entrar”.' }
  if (!data.session) return { ok: true, precisaConfirmar: true }
  return { ok: true }
}

export async function entrarApostador(email: string, senha: string): Promise<ResultadoConta> {
  const e = email.trim().toLowerCase()
  if (!EMAIL.test(e)) return { ok: false, erro: 'Informe um e-mail válido.' }
  if (!senha) return { ok: false, erro: 'Digite a senha.' }
  const { error } = await supabase.auth.signInWithPassword({ email: e, password: senha })
  if (error) return { ok: false, erro: traduzir(error.message, error.status) }
  return { ok: true }
}

/** Liga o link pessoal à conta logada. Devolve a mensagem de erro, ou null se deu certo. */
export async function vincularMinhaConta(tokenPessoal: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('vincular_minha_conta', { p_token: tokenPessoal })
  if (error) return 'Não consegui vincular agora. Tente de novo.'
  const r = data as { ok: boolean; erro?: string }
  return r?.ok ? null : (r?.erro ?? 'Não consegui vincular agora.')
}

export interface BolaoListado {
  bolao_id: string
  nome: string
  concurso_alvo: number
  n_cotas: number
  cota_cent: number
  cotas_vendidas: number
  inscricoes_ate: string | null
  inscricao_aberta: boolean
  token: string
}

/** Bolões que o organizador deixou visíveis para quem tem conta (abre em #/b/<token>). */
export async function carregarBoloesListados(): Promise<{ boloes: BolaoListado[]; erro: string | null }> {
  const { data, error } = await supabase.rpc('boloes_listados')
  if (error) return { boloes: [], erro: 'Não consegui carregar a lista de bolões agora.' }
  return { boloes: (data ?? []) as BolaoListado[], erro: null }
}

export async function carregarMinhasParticipacoes(): Promise<{ linhas: ParticipacaoDaConta[]; erro: string | null }> {
  const { data, error } = await supabase.rpc('minhas_participacoes')
  if (error) return { linhas: [], erro: 'Não consegui carregar agora. Tente de novo.' }
  return { linhas: (data ?? []) as ParticipacaoDaConta[], erro: null }
}
