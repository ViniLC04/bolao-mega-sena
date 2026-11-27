// Conferência do bolão inteiro (SPEC seção 8): acertos por jogo, bruto/IR/líquido por recibo e valor por cota.
// Funções puras; dinheiro em centavos inteiros. O valor de cada faixa vem SEMPRE do rateio oficial.
import { conferirRecibo, type Faixas, type RateioOficial, type ResultadoRecibo } from './acertos'
import type { ParamsRegras } from './rules'

export interface ReciboParaConferir {
  jogos: readonly (readonly number[])[]
}

export interface ReciboConferido extends ResultadoRecibo {
  /** quantas dezenas tem cada jogo deste recibo */
  k: number
  jogos: number
}

export interface BolaoConferido {
  recibos: ReciboConferido[]
  /** maior número de acertos em qualquer jogo */
  melhorAcerto: number
  apostasPremiadas: Faixas
  brutoCent: number
  irCent: number
  liquidoCent: number
  /** valor líquido de UMA cota: soma, recibo a recibo, de (líquido do recibo ÷ N) arredondado para baixo */
  porCotaCent: number
  /** o que sobra dos arredondamentos (vai para a caixinha) */
  restoCaixinhaCent: number
  /** ganhou algum prêmio (pelo menos uma quadra) */
  ganhou: boolean
}

export function conferirBolao(
  recibos: readonly ReciboParaConferir[],
  sorteadas: readonly number[],
  rateio: RateioOficial,
  nCotas: number,
  regras: ParamsRegras,
): BolaoConferido {
  const conferidos: ReciboConferido[] = recibos.map((r) => ({
    ...conferirRecibo(r.jogos, sorteadas, rateio, nCotas, regras),
    k: r.jogos[0]?.length ?? 0,
    jogos: r.jogos.length,
  }))
  const premiadas: Faixas = { sena: 0, quina: 0, quadra: 0 }
  let bruto = 0, ir = 0, liq = 0, porCota = 0, resto = 0, melhor = 0
  for (const c of conferidos) {
    premiadas.sena += c.apostasPremiadas.sena
    premiadas.quina += c.apostasPremiadas.quina
    premiadas.quadra += c.apostasPremiadas.quadra
    bruto += c.brutoCent
    ir += c.irCent
    liq += c.liquidoCent
    porCota += c.porCotaCent
    resto += c.restoCaixinhaCent
    melhor = Math.max(melhor, ...c.acertosPorJogo)
  }
  return {
    recibos: conferidos,
    melhorAcerto: melhor,
    apostasPremiadas: premiadas,
    brutoCent: bruto,
    irCent: ir,
    liquidoCent: liq,
    porCotaCent: porCota,
    restoCaixinhaCent: resto,
    ganhou: premiadas.quadra + premiadas.quina + premiadas.sena > 0,
  }
}

/** O que cabe a quem tem `qtd` cotas. */
export function valorDoParticipante(qtd: number, conferido: BolaoConferido): number {
  return qtd * conferido.porCotaCent
}
