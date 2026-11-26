// Sessão do ADM para o app inteiro: quem está logado e se é mesmo o ADM (o banco é quem responde).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { entrar as entrarNoBanco, sair as sairDoBanco, souAdm } from '../data/auth'
import { configurado, supabase } from '../data/supabase'

interface ContextoAuth {
  carregando: boolean
  sessao: Session | null
  adm: boolean
  /** Devolve a mensagem de erro, ou null se entrou. */
  entrar: (usuario: string, senha: string) => Promise<string | null>
  sair: () => Promise<void>
}

const Ctx = createContext<ContextoAuth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [adm, setAdm] = useState(false)
  const [carregando, setCarregando] = useState(configurado)

  useEffect(() => {
    if (!configurado) return
    let vivo = true
    const aplicar = async (s: Session | null) => {
      const ehAdm = s ? await souAdm() : false
      if (!vivo) return
      setSessao(s)
      setAdm(ehAdm)
      setCarregando(false)
    }
    void supabase.auth.getSession().then(({ data }) => aplicar(data.session))
    // O Supabase pede para não chamar o banco dentro deste aviso: adia para o próximo ciclo.
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => {
      setTimeout(() => void aplicar(s), 0)
    })
    return () => {
      vivo = false
      data.subscription.unsubscribe()
    }
  }, [])

  const entrar = useCallback(async (usuario: string, senha: string) => {
    const r = await entrarNoBanco(usuario, senha)
    if (!r.ok) return r.erro
    if (!(await souAdm())) {
      await sairDoBanco()
      return 'Este usuário não é o ADM do bolão.'
    }
    return null
  }, [])

  const sair = useCallback(async () => {
    await sairDoBanco()
    setSessao(null)
    setAdm(false)
  }, [])

  const valor = useMemo(() => ({ carregando, sessao, adm, entrar, sair }), [carregando, sessao, adm, entrar, sair])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useAuth(): ContextoAuth {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return c
}
