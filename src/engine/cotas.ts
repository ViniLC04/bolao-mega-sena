// Cotas, pagamentos e caixinha de um bolão (SPEC seções 2, 11 e 12). Funções puras; dinheiro sempre em centavos inteiros.
import { nCotasValido, totalMinimo } from './bolao'
import type { ParamsRegras } from './rules'
import { simularPorValor } from './simulador'

export interface CotaRegistro {
  /** quantas cotas esta pessoa tem neste bolão */
  qtd: number
  /** quanto ela deve, em centavos (qtd × cota cobrada na época do registro) */
  valorDevidoCent: number
  pago: boolean
  viaEntregue: boolean
}

/** Valor devido por `qtd` cotas. */
export function valorDevido(qtd: number, cotaCobradaCent: number): number {
  return qtd * cotaCobradaCent
}

/** Quantas cotas ainda podem ser vendidas; recusa pedido de quantidade inválida ou acima do que sobra. */
export function validarQtdCotas(qtd: number, jaVendidas: number, nCotas: number): string | null {
  if (!Number.isInteger(qtd) || qtd < 1) return 'A quantidade de cotas deve ser um número inteiro, de 1 em diante.'
  const livres = nCotas - jaVendidas
  if (qtd > livres) return livres <= 0 ? 'Todas as cotas deste bolão já foram vendidas.' : `Só restam ${livres} cota(s) neste bolão.`
  return null
}

export interface ResumoCotas {
  nCotas: number
  vendidas: number
  livres: number
  /** cotas já pagas / ainda não pagas */
  pagas: number
  naoPagas: number
  /** vias entregues, em cotas */
  viasEntregues: number
  /** quanto já entrou (cotas pagas) e quanto falta receber das vendidas, em centavos */
  arrecadadoCent: number
  aReceberCent: number
  /** valor total das cotas vendidas */
  vendidoCent: number
  /** quantos participantes (registros) o bolão tem */
  registros: number
}

export function resumoCotas(cotas: readonly CotaRegistro[], nCotas: number): ResumoCotas {
  let vendidas = 0, pagas = 0, vias = 0, arrecadado = 0, vendido = 0
  for (const c of cotas) {
    vendidas += c.qtd
    vendido += c.valorDevidoCent
    if (c.pago) {
      pagas += c.qtd
      arrecadado += c.valorDevidoCent
    }
    if (c.viaEntregue) vias += c.qtd
  }
  return {
    nCotas,
    vendidas,
    livres: nCotas - vendidas,
    pagas,
    naoPagas: vendidas - pagas,
    viasEntregues: vias,
    arrecadadoCent: arrecadado,
    aReceberCent: vendido - arrecadado,
    vendidoCent: vendido,
    registros: cotas.length,
  }
}

export type MotivoFechamento = 'n_invalido' | 'sem_recibo' | 'orcamento_baixo'

export interface VerificacaoFechamento {
  /** número de cotas que o bolão teria ao fechar (= cotas cadastradas) */
  n: number
  /** orçamento = N × valor da cota, em centavos */
  orcamentoCent: number
  /** menor total de recibo possível para N cotas (null se N é inválido ou não há recibo) */
  minimoCent: number | null
  podeFechar: boolean
  /** por que não pode fechar (null quando pode) */
  motivo: MotivoFechamento | null
}

/**
 * Bolão aberto: dá para fechar as inscrições com as cotas de hoje? N precisa estar entre os limites das Regras e
 * o orçamento (N × cota) precisa alcançar o menor recibo possível para N cotas. Dinheiro em centavos inteiros.
 */
export function verificarFechamento(vendidas: number, cotaCent: number, r: ParamsRegras): VerificacaoFechamento {
  const orcamentoCent = vendidas * cotaCent
  if (!nCotasValido(vendidas, r)) return { n: vendidas, orcamentoCent, minimoCent: null, podeFechar: false, motivo: 'n_invalido' }
  const min = totalMinimo(vendidas, r)
  if (!min) return { n: vendidas, orcamentoCent, minimoCent: null, podeFechar: false, motivo: 'sem_recibo' }
  if (!simularPorValor({ n: vendidas, cotaBaseCent: cotaCent, cobranca: 'cota_fixa' }, r)) {
    return { n: vendidas, orcamentoCent, minimoCent: min.total, podeFechar: false, motivo: 'orcamento_baixo' }
  }
  return { n: vendidas, orcamentoCent, minimoCent: min.total, podeFechar: true, motivo: null }
}

export interface ResumoCaixinha {
  /** N × cota cobrada − custo das apostas (o excesso do arredondamento da cota; zero ou positivo) */
  sobraPrevistaCent: number
  /** soma dos lançamentos manuais (entradas positivas, saídas negativas) */
  movimentosCent: number
  saldoCent: number
}

/**
 * Caixinha = sobra prevista do arredondamento da cota + lançamentos manuais.
 * `custoApostasCent` é o que o bolão paga à Caixa (soma dos totais dos recibos).
 */
export function caixinha(nCotas: number, cotaCobradaCent: number, custoApostasCent: number, movimentosCent: readonly number[]): ResumoCaixinha {
  const sobra = nCotas * cotaCobradaCent - custoApostasCent
  const mov = movimentosCent.reduce((s, v) => s + v, 0)
  return { sobraPrevistaCent: sobra, movimentosCent: mov, saldoCent: sobra + mov }
}
