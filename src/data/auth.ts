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

export async function trocarSenha(nova: string): Promise<Resultado> {
  const problemas = validarSenha(nova)
  if (problemas.length > 0) return { ok: false, erro: problemas.join(' ') }
  const { error } = await supabase.auth.updateUser({ password: nova })
  if (error) return { ok: false, erro: /weak|password/i.test(error.message) ? 'O servidor recusou esta senha: use uma mais forte.' : 'Não foi possível trocar a senha agora.' }
  return { ok: true }
}
