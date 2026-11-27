import { useCallback, useEffect, useRef, useState } from 'react'
import type { ResultadoGeracao } from '../engine/gerador'
import type { EntradaGerador, SaidaGerador } from '../workers/gerador.worker'

export interface EstadoGerador {
  status: 'parado' | 'gerando' | 'pronto' | 'erro'
  fracao: number
  resultado?: ResultadoGeracao
  erro?: string
}

/** Controla o Worker do gerador: iniciar, acompanhar o progresso, cancelar e limpar ao sair da tela. */
export function useGerador() {
  const [estado, setEstado] = useState<EstadoGerador>({ status: 'parado', fracao: 0 })
  const worker = useRef<Worker | null>(null)

  const parar = useCallback(() => {
    worker.current?.terminate()
    worker.current = null
    setEstado((e) => (e.status === 'gerando' ? { status: 'parado', fracao: 0 } : e))
  }, [])

  const executar = useCallback((entrada: EntradaGerador, aoTerminar?: (r: ResultadoGeracao) => void) => {
    worker.current?.terminate()
    const w = new Worker(new URL('../workers/gerador.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    setEstado((e) => ({ status: 'gerando', fracao: 0, resultado: e.resultado }))
    w.onmessage = (ev: MessageEvent<SaidaGerador>) => {
      const m = ev.data
      if (m.tipo === 'progresso') setEstado((e) => (e.status === 'gerando' ? { ...e, fracao: m.fracao } : e))
      else if (m.tipo === 'fim') {
        setEstado({ status: 'pronto', fracao: 1, resultado: m.resultado })
        aoTerminar?.(m.resultado)
        w.terminate()
        if (worker.current === w) worker.current = null
      } else setEstado({ status: 'erro', fracao: 0, erro: m.mensagem })
    }
    w.onerror = () => setEstado({ status: 'erro', fracao: 0, erro: 'A geração falhou. Tente de novo.' })
    w.postMessage(entrada)
  }, [])

  const limpar = useCallback(() => {
    worker.current?.terminate()
    worker.current = null
    setEstado({ status: 'parado', fracao: 0 })
  }, [])

  useEffect(() => () => worker.current?.terminate(), [])

  return { estado, executar, parar, limpar }
}
