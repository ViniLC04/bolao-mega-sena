// Login por "usuário": o Supabase só entende e-mail, então o usuário vira um e-mail interno fixo.
// Decisão da Fase 2: `usuario@example.com` (domínio aceito pelo Supabase, testado na Fase 0).
// Quem cria o usuário no painel do Supabase usa exatamente este e-mail.

export const DOMINIO_INTERNO = 'example.com'

/** Usuário válido: 2 a 40 caracteres, só letras minúsculas sem acento, números, ponto, hífen e sublinhado. */
export function usuarioValido(usuario: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{1,39}$/.test(usuario.trim().toLowerCase())
}

/** "Vinicius " → "vinicius@example.com". Usuário inválido → null. */
export function usuarioParaEmail(usuario: string): string | null {
  const u = usuario.trim().toLowerCase()
  return usuarioValido(u) ? `${u}@${DOMINIO_INTERNO}` : null
}

/** E-mail interno → usuário (para mostrar na tela). Outros e-mails voltam como estão. */
export function emailParaUsuario(email: string): string {
  const sufixo = `@${DOMINIO_INTERNO}`
  return email.endsWith(sufixo) ? email.slice(0, -sufixo.length) : email
}
