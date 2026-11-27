// Worker do gerador: gera (ou troca um jogo) sem travar a tela, avisando o progresso.
import { gerarJogos, regerarJogo, type ContextoGeracao, type JogoGerado, type Premissas, type ReciboAlvo, type ResultadoGeracao } from '../engine/gerador'

export interface EntradaGerador {
  tipo: 'gerar' | 'regerar'
  recibos: ReciboAlvo[]
  premissas: Premissas
  contexto: ContextoGeracao
  semente: number
  /** gerar: jogos travados que ficam como estão */
  fixos?: JogoGerado[]
  /** regerar: todos os jogos atuais e a posição do que será trocado */
  jogosAtuais?: JogoGerado[]
  indice?: number
}

export type SaidaGerador =
  | { tipo: 'progresso'; fracao: number }
  | { tipo: 'fim'; resultado: ResultadoGeracao }
  | { tipo: 'erro'; mensagem: string }

const ctx = self as unknown as { postMessage(m: SaidaGerador): void; onmessage: ((e: MessageEvent<EntradaGerador>) => void) | null }

ctx.onmessage = (e) => {
  try {
    const d = e.data
    const opcoes = { semente: d.semente, onProgresso: (fracao: number) => ctx.postMessage({ tipo: 'progresso', fracao }) }
    const resultado =
      d.tipo === 'regerar'
        ? regerarJogo(d.recibos, d.jogosAtuais ?? [], d.indice ?? 0, d.premissas, d.contexto, opcoes)
        : gerarJogos(d.recibos, d.premissas, d.contexto, { ...opcoes, fixos: d.fixos })
    ctx.postMessage({ tipo: 'fim', resultado })
  } catch (erro) {
    ctx.postMessage({ tipo: 'erro', mensagem: String((erro as Error).message ?? erro) })
  }
}
