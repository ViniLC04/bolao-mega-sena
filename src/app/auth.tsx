// Sessão do ADM para o app inteiro: quem está logado e se é mesmo o ADM (o banco é quem responde).
// Com a verificação em 2 passos ativa, a senha sozinha NÃO basta: a sessão fica "pendente" até o código.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { entrar as entrarNoBanco, enviarCodigoDoisPassos, precisaDoCodigo, sair as sairDoBanco, souAdm } from '../data/auth'
import { configurado, supabase } from '../data/supabase'

interface ContextoAuth {
  carregando: boolean
  sessao: Session | null
  adm: boolean
  /** a senha foi aceita, falta o código dos 2 passos */
  pendenteCodigo: boolean
  /** Devolve a mensagem de erro, ou null se entrou (ou se agora falta só o código). */
  entrar: (usuario: string, senha: string) => Promise<string | null>
  /** Confere o código dos 2 passos. Devolve a mensagem de erro, ou null se deu certo. */
  enviarCodigo: (codigo: string) => Promise<string | null>
  sair: () => Promise<void>
}

const Ctx = createContext<ContextoAuth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [adm, setAdm] = useState(false)
  const [pendenteCodigo, setPendenteCodigo] = useState(false)
  const [carregando, setCarregando] = useState(configurado)

  const aplicar = useCallback(async (s: Session | null) => {
    const ehAdm = s ? await souAdm() : false
    const falta = s && !ehAdm ? await precisaDoCodigo() : false
    setSessao(s)
    setAdm(ehAdm)
    setPendenteCodigo(falta)
    setCarregando(false)
  }, [])

  useEffect(() => {
    if (!configurado) return
    let vivo = true
    const seguro = (s: Session | null) => {
      if (vivo) void aplicar(s)
    }
    void supabase.auth.getSession().then(({ data }) => seguro(data.session))
    // O Supabase pede para não chamar o banco dentro deste aviso: adia para o próximo ciclo.
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => {
      setTimeout(() => seguro(s), 0)
    })
    return () => {
      vivo = false
      data.subscription.unsubscribe()
    }
  }, [aplicar])

  const entrar = useCallback(
    async (usuario: string, senha: string) => {
      const r = await entrarNoBanco(usuario, senha)
      if (!r.ok) return r.erro
      if (await souAdm()) return null
      if (await precisaDoCodigo()) {
        setPendenteCodigo(true)
        return null
      }
      await sairDoBanco()
      return 'Este usuário não é o ADM do bolão.'
    },
    [],
  )

  const enviarCodigo = useCallback(
    async (codigo: string) => {
      const r = await enviarCodigoDoisPassos(codigo)
      if (!r.ok) return r.erro
      const { data } = await supabase.auth.getSession()
      await aplicar(data.session)
      return null
    },
    [aplicar],
  )

  const sair = useCallback(async () => {
    await sairDoBanco()
    setSessao(null)
    setAdm(false)
    setPendenteCodigo(false)
  }, [])

  const valor = useMemo(
    () => ({ carregando, sessao, adm, pendenteCodigo, entrar, enviarCodigo, sair }),
    [carregando, sessao, adm, pendenteCodigo, entrar, enviarCodigo, sair],
  )
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useAuth(): ContextoAuth {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return c
}
