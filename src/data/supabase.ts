// Cliente do Supabase. Só usa a chave PÚBLICA (anon/publishable), que pode ir para o navegador porque o
// banco protege tudo com RLS. A chave secreta (SUPABASE_SERVICE_ROLE_KEY) NUNCA entra aqui nem no build.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chavePublica = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** false quando faltam as chaves em .env.local: a tela mostra uma explicação em vez de quebrar. */
export const configurado = Boolean(url && chavePublica)

export const supabase = createClient(url || 'http://localhost:54321', chavePublica || 'sem-chave', {
  auth: { persistSession: true, autoRefreshToken: true },
})
