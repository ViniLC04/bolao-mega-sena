// O "plano" que o Simulador entrega ao Gerador (passado pela navegação): quantas cotas, quais recibos e a cobrança.
import type { LinhaSimulacao, ModoCobranca } from '../engine/simulador'

export interface PlanoBolao {
  n: number
  recibos: { k: number; g: number }[]
  /** cota-base pedida (null quando veio do modo "por cotas" ou "inverso") */
  cotaBaseCent: number | null
  cobranca: ModoCobranca
  gastoCent: number
  cotaCobradaCent: number
}

export function planoDeLinha(l: LinhaSimulacao, cotaBaseCent: number | null): PlanoBolao {
  return {
    n: l.n,
    recibos: l.recibos.map(({ k, g }) => ({ k, g })),
    cotaBaseCent,
    cobranca: l.cobranca,
    gastoCent: l.gastoCent,
    cotaCobradaCent: l.cotaCobradaCent,
  }
}

/** "7 jogos de 8 dezenas" */
export function descreverRecibo(r: { k: number; g: number }): string {
  return `${r.g} ${r.g === 1 ? 'jogo' : 'jogos'} de ${r.k} dezenas`
}
