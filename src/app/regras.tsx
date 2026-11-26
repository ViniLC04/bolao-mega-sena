// Regras em uso no app: lidas do banco (versionadas); se o banco ainda não tem nenhuma versão (ou não responde),
// usa o rules.json que vem junto com o app. O motor recebe sempre o conjunto de parâmetros vigentes hoje.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import regrasPadraoJson from '../../rules.json'
import { regrasVigentes, type ArquivoRegras, type ParamsRegras, type VersaoRegras } from '../engine/rules'
import { carregarVersoes } from '../data/regras'
import { configurado } from '../data/supabase'
import { hojeIsoSP } from './formato'

export const REGRAS_PADRAO = regrasPadraoJson as unknown as ArquivoRegras

interface ContextoRegras {
  /** versões gravadas no banco (da mais nova para a mais antiga); vazio se o banco ainda não tem */
  versoes: VersaoRegras[]
  /** o que está valendo: do banco, ou o rules.json padrão */
  arquivo: ArquivoRegras
  /** parâmetros vigentes hoje (data de Brasília) */
  params: ParamsRegras
  /** vigência da versão em uso */
  vigenciaEmUso: string
  origem: 'banco' | 'padrao'
  carregando: boolean
  erro: string | null
  recarregar: () => Promise<void>
}

const Ctx = createContext<ContextoRegras | null>(null)

function escolher(arquivo: ArquivoRegras): { params: ParamsRegras; vigencia: string } {
  const hoje = hojeIsoSP()
  try {
    const params = regrasVigentes(arquivo, hoje)
    const vigencia = [...arquivo.versoes].filter((v) => v.vigencia_inicio <= hoje).sort((a, b) => (a.vigencia_inicio < b.vigencia_inicio ? 1 : -1))[0].vigencia_inicio
    return { params, vigencia }
  } catch {
    const v = REGRAS_PADRAO.versoes[0]
    return { params: v.params, vigencia: v.vigencia_inicio }
  }
}

export function RegrasProvider({ children }: { children: ReactNode }) {
  const [versoes, setVersoes] = useState<VersaoRegras[]>([])
  const [carregando, setCarregando] = useState(configurado)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    if (!configurado) return
    const r = await carregarVersoes()
    setVersoes(r.versoes)
    setErro(r.erro)
    setCarregando(false)
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  const valor = useMemo<ContextoRegras>(() => {
    const usaBanco = versoes.length > 0
    const arquivo = usaBanco ? { versoes } : REGRAS_PADRAO
    const { params, vigencia } = escolher(arquivo)
    return { versoes, arquivo, params, vigenciaEmUso: vigencia, origem: usaBanco ? 'banco' : 'padrao', carregando, erro, recarregar }
  }, [versoes, carregando, erro, recarregar])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useRegras(): ContextoRegras {
  const c = useContext(Ctx)
  if (!c) throw new Error('useRegras precisa estar dentro de RegrasProvider')
  return c
}
