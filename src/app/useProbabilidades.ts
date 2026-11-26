import { useCallback, useEffect, useRef, useState } from 'react'
import type { ResultadoGrupos } from '../engine/probabilidades'
import type { EntradaProb, SaidaProb } from '../workers/probabilidades.worker'

export interface EstadoCalculo {
  status: 'parado' | 'calculando' | 'pronto' | 'erro'
  fracao: number
  resultado?: ResultadoGrupos
  erro?: string
}

/** Controla o Worker do Monte Carlo: iniciar, acompanhar o progresso, cancelar e limpar ao sair da tela. */
export function useProbabilidades() {
  const [estado, setEstado] = useState<EstadoCalculo>({ status: 'parado', fracao: 0 })
  const worker = useRef<Worker | null>(null)

  const parar = useCallback(() => {
    worker.current?.terminate()
    worker.current = null
    setEstado((e) => (e.status === 'calculando' ? { status: 'parado', fracao: 0 } : e))
  }, [])

  const calcular = useCallback((entrada: EntradaProb) => {
    worker.current?.terminate()
    const w = new Worker(new URL('../workers/probabilidades.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    setEstado({ status: 'calculando', fracao: 0 })
    w.onmessage = (ev: MessageEvent<SaidaProb>) => {
      const m = ev.data
      if (m.tipo === 'progresso') setEstado((e) => (e.status === 'calculando' ? { ...e, fracao: m.fracao } : e))
      else if (m.tipo === 'fim') {
        setEstado({ status: 'pronto', fracao: 1, resultado: m.resultado })
        w.terminate()
        if (worker.current === w) worker.current = null
      } else setEstado({ status: 'erro', fracao: 0, erro: m.mensagem })
    }
    w.onerror = () => setEstado({ status: 'erro', fracao: 0, erro: 'O cálculo falhou. Tente de novo.' })
    w.postMessage(entrada)
  }, [])

  const limpar = useCallback(() => {
    worker.current?.terminate()
    worker.current = null
    setEstado({ status: 'parado', fracao: 0 })
  }, [])

  useEffect(() => () => worker.current?.terminate(), [])

  return { estado, calcular, parar, limpar }
}
