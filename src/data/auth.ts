// Login do ADM por usuário e senha (Supabase Auth). A senha forte é exigida pelo servidor (provado na Fase 0);
// a tela confere antes só para dar uma mensagem melhor.
import { validarSenha } from '../engine/validacoes'
import { supabase } from './supabase'
import { usuarioParaEmail } from './usuario'

export type Resultado = { ok: true } | { ok: false; erro: string }

function traduzirErro(mensagem: string, status?: number): string {
  if (status === 429 || /rate limit|too many/i.test(mensagem)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
  if (/invalid login credentials/i.test(mensagem)) return 'Usuário ou senha incorretos.'
  return 'Não foi possível entrar agora. Tente de novo em instantes.'
}

export async function entrar(usuario: string, senha: string): Promise<Resultado> {
  const email = usuarioParaEmail(usuario)
  if (!email) return { ok: false, erro: 'Usuário inválido: use letras minúsculas, números, ponto, hífen ou sublinhado.' }
  if (!senha) return { ok: false, erro: 'Digite a senha.' }
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) return { ok: false, erro: traduzirErro(error.message, error.status) }
  return { ok: true }
}

export async function sair(): Promise<void> {
  await supabase.auth.signOut()
}

/** Pergunta ao banco se quem está logado é o ADM (a função is_adm() devolve false para qualquer outro). */
export async function souAdm(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_adm')
  return !error && data === true
}

// ---------- Verificação em 2 passos (código de 6 dígitos de um aplicativo autenticador, TOTP) ----------
// Com um fator ativo, o BANCO só trata a sessão como ADM depois do código (função is_adm(), migração 004).

function traduzirCodigo(mensagem: string): string {
  if (/invalid|incorrect|expired/i.test(mensagem)) return 'Código incorreto ou vencido. Espere o próximo código do aplicativo e tente de novo.'
  if (/rate limit|too many/i.test(mensagem)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
  return 'Não foi possível conferir o código agora. Tente de novo.'
}

/** A senha já foi aceita, mas o banco ainda espera o código dos 2 passos? */
export async function precisaDoCodigo(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  return !error && data.currentLevel === 'aal1' && data.nextLevel === 'aal2'
}

export interface FatorDoisPassos {
  id: string
  nome: string | null
}

/** Fatores de 2 passos já confirmados. */
export async function fatoresConfirmados(): Promise<FatorDoisPassos[]> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error || !data) return []
  return data.totp.map((f) => ({ id: f.id, nome: f.friendly_name ?? null }))
}

/** Confere o código dos 2 passos (sessão passa a valer como ADM). */
export async function enviarCodigoDoisPassos(codigo: string): Promise<Resultado> {
  const limpo = codigo.replace(/\s/g, '')
  if (!/^\d{6}$/.test(limpo)) return { ok: false, erro: 'O código tem 6 números.' }
  const fatores = await fatoresConfirmados()
  if (fatores.length === 0) return { ok: false, erro: 'Nenhuma verificação em 2 passos está ativa nesta conta.' }
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fatores[0].id, code: limpo })
  return error ? { ok: false, erro: traduzirCodigo(error.message) } : { ok: true }
}

export interface InicioAtivacao {
  fatorId: string
  /** imagem do QR code (SVG em data:) */
  qr: string
  /** chave para digitar à mão no aplicativo, se não der para ler o QR */
  chave: string
}

/** Começa a ativação: devolve o QR code e a chave. Só vale depois de confirmar com um código (confirmarAtivacao). */
export async function iniciarAtivacao(): Promise<{ ok: true; inicio: InicioAtivacao } | { ok: false; erro: string }> {
  // restos de uma tentativa anterior que ficou pela metade atrapalham: tira antes
  const { data: lista } = await supabase.auth.mfa.listFactors()
  for (const f of lista?.all ?? []) {
    if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Celular ${new Date().toISOString().slice(0, 10)}` })
  if (error || !data) return { ok: false, erro: 'Não consegui começar a ativação agora. Tente de novo.' }
  return { ok: true, inicio: { fatorId: data.id, qr: data.totp.qr_code, chave: data.totp.secret } }
}

export async function confirmarAtivacao(fatorId: string, codigo: string): Promise<Resultado> {
  const limpo = codigo.replace(/\s/g, '')
  if (!/^\d{6}$/.test(limpo)) return { ok: false, erro: 'O código tem 6 números.' }
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fatorId, code: limpo })
  return error ? { ok: false, erro: traduzirCodigo(error.message) } : { ok: true }
}

export async function cancelarAtivacao(fatorId: string): Promise<void> {
  await supabase.auth.mfa.unenroll({ factorId: fatorId })
}

export async function desativarDoisPassos(fatorId: string): Promise<Resultado> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId: fatorId })
  return error ? { ok: false, erro: 'Não consegui desativar agora. Entre de novo com o código e tente outra vez.' } : { ok: true }
}

export async function trocarSenha(nova: string): Promise<Resultado> {
  const problemas = validarSenha(nova)
  if (problemas.length > 0) return { ok: false, erro: problemas.join(' ') }
  const { error } = await supabase.auth.updateUser({ password: nova })
  if (error) return { ok: false, erro: /weak|password/i.test(error.message) ? 'O servidor recusou esta senha: use uma mais forte.' : 'Não foi possível trocar a senha agora.' }
  return { ok: true }
}
