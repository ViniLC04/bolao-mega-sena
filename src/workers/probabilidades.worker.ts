// Worker do Monte Carlo: calcula "pelo menos uma quina/quadra" por recibo e do bolão, sem travar a tela,
// avisando o progresso. Sorteia jogos ALEATÓRIOS (é o que o simulador sabe antes de o gerador criar os jogos).
import { monteCarloGrupos, type ResultadoGrupos } from '../engine/probabilidades'
import { criarRng, sortearDezenas } from '../engine/random'

export interface EntradaProb {
  recibos: { k: number; g: number }[]
  semente: number
  sorteios?: number
  /** jogos REAIS de cada recibo (na mesma ordem de `recibos`); sem isso, sorteia jogos aleatórios */
  jogosReais?: number[][][]
}

export type SaidaProb =
  | { tipo: 'progresso'; fracao: number }
  | { tipo: 'fim'; resultado: ResultadoGrupos }
  | { tipo: 'erro'; mensagem: string }

// Em Worker, `self.postMessage` não tem o formato de janela; este molde diz isso ao TypeScript.
const ctx = self as unknown as { postMessage(m: SaidaProb): void; onmessage: ((e: MessageEvent<EntradaProb>) => void) | null }

ctx.onmessage = (e) => {
  try {
    const { recibos, semente, sorteios, jogosReais } = e.data
    const rng = criarRng(semente)
    const grupos = jogosReais ?? recibos.map((r) => Array.from({ length: r.g }, () => sortearDezenas(rng, r.k)))
    const resultado = monteCarloGrupos(grupos, {
      sorteios,
      rng: criarRng(semente + 1),
      onProgresso: (fracao) => ctx.postMessage({ tipo: 'progresso', fracao }),
    })
    ctx.postMessage({ tipo: 'fim', resultado })
  } catch (erro) {
    ctx.postMessage({ tipo: 'erro', mensagem: String((erro as Error).message ?? erro) })
  }
}
