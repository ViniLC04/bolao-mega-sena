// Conferência e rateio (SPEC seção 8). Funções puras; dinheiro em centavos inteiros.
//
// Um jogo de k dezenas equivale a C(k,6) apostas simples. Se h das 6 dezenas sorteadas estão no jogo,
// ele contém: sena = C(h,6)·C(k−h,0), quina = C(h,5)·C(k−h,1), quadra = C(h,4)·C(k−h,2) apostas premiadas.
// O VALOR de cada faixa vem SEMPRE do rateio oficial da Caixa (nunca de fórmula ou estimativa).
import { combinacoes } from './combinatoria'
import type { ParamsRegras } from './rules'

export interface Faixas {
  sena: number
  quina: number
  quadra: number
}

/** 8.1: decomposição em apostas simples de um jogo de k dezenas com h acertos (0 ≤ h ≤ 6, h ≤ k). */
export function decomporAcertos(k: number, h: number): Faixas {
  return {
    sena: combinacoes(h, 6) * combinacoes(k - h, 0),
    quina: combinacoes(h, 5) * combinacoes(k - h, 1),
    quadra: combinacoes(h, 4) * combinacoes(k - h, 2),
  }
}

/** Quantas das dezenas sorteadas estão no jogo. */
export function contarAcertos(jogo: readonly number[], sorteadas: readonly number[]): number {
  const noJogo = new Set(jogo)
  let h = 0
  for (const d of sorteadas) if (noJogo.has(d)) h++
  return h
}

/** Valor oficial pago por ganhador de cada faixa no concurso (campo "rateio"), em centavos. */
export interface RateioOficial {
  senaCent: number
  quinaCent: number
  quadraCent: number
}

/** 8.2: bruto de um jogo = sena×valor_sena + quina×valor_quina + quadra×valor_quadra. */
export function brutoDoJogo(k: number, h: number, rateio: RateioOficial): number {
  const d = decomporAcertos(k, h)
  return d.sena * rateio.senaCent + d.quina * rateio.quinaCent + d.quadra * rateio.quadraCent
}

/**
 * Imposto de renda retido na fonte sobre o bruto: alíquota (pontos-base) sobre o que passa do valor isento,
 * arredondado para o centavo mais próximo (meio centavo sobe). Com isento = 0 (padrão), incide sobre tudo.
 * [PENDENTE] confirmar a isenção e o arredondamento oficiais — ver docs/pendencias.md.
 */
export function impostoDeRenda(brutoCent: number, r: ParamsRegras): number {
  const tributavel = Math.max(0, brutoCent - r.ir_valor_isento)
  return Math.floor((tributavel * r.ir_aliquota_bp + 5_000) / 10_000)
}

/** Líquido = bruto − IR. */
export function liquido(brutoCent: number, r: ParamsRegras): number {
  return brutoCent - impostoDeRenda(brutoCent, r)
}

export interface ResultadoRecibo {
  /** acertos de cada jogo, na ordem em que foram passados */
  acertosPorJogo: number[]
  /** apostas simples premiadas somadas em todos os jogos */
  apostasPremiadas: Faixas
  brutoCent: number
  irCent: number
  liquidoCent: number
  /** líquido ÷ N, arredondado PARA BAIXO (o resto vai para a caixinha) */
  porCotaCent: number
  restoCaixinhaCent: number
}

/**
 * 8.2: confere um recibo (vários jogos) contra as 6 dezenas sorteadas, com os valores oficiais.
 * `por_cota = líquido_do_recibo ÷ N`; o participante soma suas cotas em cada recibo.
 * [PREMISSA] o arredondamento para baixo e o resto na caixinha — ver docs/pendencias.md.
 */
export function conferirRecibo(
  jogos: readonly (readonly number[])[],
  sorteadas: readonly number[],
  rateio: RateioOficial,
  n: number,
  r: ParamsRegras,
): ResultadoRecibo {
  const acertosPorJogo = jogos.map((j) => contarAcertos(j, sorteadas))
  const apostasPremiadas: Faixas = { sena: 0, quina: 0, quadra: 0 }
  let brutoCent = 0
  jogos.forEach((j, i) => {
    const d = decomporAcertos(j.length, acertosPorJogo[i])
    apostasPremiadas.sena += d.sena
    apostasPremiadas.quina += d.quina
    apostasPremiadas.quadra += d.quadra
    brutoCent += brutoDoJogo(j.length, acertosPorJogo[i], rateio)
  })
  const irCent = impostoDeRenda(brutoCent, r)
  const liquidoCent = brutoCent - irCent
  const porCotaCent = Math.floor(liquidoCent / n)
  return { acertosPorJogo, apostasPremiadas, brutoCent, irCent, liquidoCent, porCotaCent, restoCaixinhaCent: liquidoCent - porCotaCent * n }
}
