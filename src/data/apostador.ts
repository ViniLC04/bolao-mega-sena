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

/** Nome e WhatsApp guardados no perfil da conta (user_metadata), para não digitar de novo a cada inscrição. */
export interface PerfilDaConta {
  nome: string
  whatsapp: string
}

/** Confere nome completo e WhatsApp com DDD. Devolve a mensagem de erro ou null. */
export function validarPerfil(nome: string, whatsapp: string): string | null {
  const n = nome.trim().replace(/\s+/g, ' ')
  if (n.length < 5 || !n.includes(' ')) return 'Informe o nome completo (nome e sobrenome).'
  if (n.length > 80) return 'O nome é longo demais (máximo 80 letras).'
  let d = whatsapp.replace(/\D/g, '')
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
  if (d.length < 10 || d.length > 11) return 'Informe o WhatsApp com DDD, por exemplo (11) 91234-5678.'
  return null
}

/** Lê o perfil da conta logada (vazio se a conta é antiga e nunca gravou). */
export function perfilDaConta(user: { user_metadata?: Record<string, unknown> } | null | undefined): PerfilDaConta | null {
  const m = user?.user_metadata
  const nome = typeof m?.nome_completo === 'string' ? m.nome_completo : ''
  const whatsapp = typeof m?.whatsapp === 'string' ? m.whatsapp : ''
  return nome && whatsapp ? { nome, whatsapp } : null
}

export async function salvarPerfil(nome: string, whatsapp: string): Promise<string | null> {
  const erro = validarPerfil(nome, whatsapp)
  if (erro) return erro
  const { error } = await supabase.auth.updateUser({ data: { nome_completo: nome.trim().replace(/\s+/g, ' '), whatsapp: whatsapp.trim() } })
  return error ? 'Não consegui salvar os dados agora. Tente de novo.' : null
}

export async function criarConta(email: string, senha: string, nome: string, whatsapp: string): Promise<ResultadoConta> {
  const e = email.trim().toLowerCase()
  const erroPerfil = validarPerfil(nome, whatsapp)
  if (erroPerfil) return { ok: false, erro: erroPerfil }
  if (!EMAIL.test(e)) return { ok: false, erro: 'Informe um e-mail válido.' }
  const problemas = validarSenha(senha)
  if (problemas.length > 0) return { ok: false, erro: problemas[0] }
  const { data, error } = await supabase.auth.signUp({
    email: e,
    password: senha,
    options: { data: { nome_completo: nome.trim().replace(/\s+/g, ' '), whatsapp: whatsapp.trim() } },
  })
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
