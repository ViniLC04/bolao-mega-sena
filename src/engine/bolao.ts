// Matemática do bolão (SPEC seção 4.1 a 4.3). Funções puras; dinheiro sempre em centavos inteiros.
import { combinacoes } from './combinatoria'
import type { ArredondamentoCota, ParamsRegras } from './rules'

/** Um recibo: g jogos, todos com k dezenas. */
export interface OpcaoRecibo {
  k: number
  g: number
  /** custo total do recibo, em centavos */
  total: number
}

/** 4.1: preço de UM jogo de k dezenas = C(k,6) × preço da aposta simples. */
export function precoJogo(k: number, r: ParamsRegras): number {
  return combinacoes(k, 6) * r.preco_aposta_simples
}

/** 4.2: total de um recibo T(k,g) = preço(k) × g. */
export function totalRecibo(k: number, g: number, r: ParamsRegras): number {
  return precoJogo(k, r) * g
}

/** Todas as composições possíveis de um recibo (k de dezenas_min a dezenas_max, g de 1 ao máximo por recibo). */
export function opcoesRecibo(r: ParamsRegras): OpcaoRecibo[] {
  const lista: OpcaoRecibo[] = []
  for (let k = r.dezenas_min; k <= r.dezenas_max; k++) {
    for (let g = 1; g <= r.bolao_jogos_max_por_recibo; g++) {
      lista.push({ k, g, total: totalRecibo(k, g, r) })
    }
  }
  return lista
}

/** N cotas é um número aceito? (2 ≤ N ≤ 100, inteiro) */
export function nCotasValido(n: number, r: ParamsRegras): boolean {
  return Number.isInteger(n) && n >= r.bolao_cotas_min && n <= r.bolao_cotas_max
}

/** 4.2: um recibo de total T é válido para N cotas quando T ≥ valor mínimo e T/N ≥ cota mínima. */
export function totalValidoParaN(total: number, n: number, r: ParamsRegras): boolean {
  return nCotasValido(n, r) && total >= r.bolao_valor_minimo && total >= r.bolao_cota_minima * n
}

/** Composições de recibo válidas para N cotas. */
export function opcoesValidasParaN(n: number, r: ParamsRegras): OpcaoRecibo[] {
  return opcoesRecibo(r).filter((o) => totalValidoParaN(o.total, n, r))
}

/** 4.3: Piso(N) = max(valor mínimo, cota mínima × N). */
export function piso(n: number, r: ParamsRegras): number {
  return Math.max(r.bolao_valor_minimo, r.bolao_cota_minima * n)
}

/** Divide total por N em centavos inteiros, pela regra de arredondamento editável (padrão: para cima). */
export function cotaDeTotal(total: number, n: number, modo: ArredondamentoCota): number {
  const q = Math.floor(total / n)
  const resto = total - q * n
  if (resto === 0) return q
  if (modo === 'cima') return q + 1
  if (modo === 'baixo') return q
  return resto * 2 >= n ? q + 1 : q // 'proximo': meio centavo sobe
}

/** Há centavos quebrados? (o total não divide N em centavos exatos) */
export function temCentavosQuebrados(total: number, n: number): boolean {
  return total % n !== 0
}

export interface ResultadoTotalMinimo {
  n: number
  opcao: OpcaoRecibo
  total: number
  /** cota mínima por cota, em centavos, pela regra de arredondamento */
  cotaCent: number
  /** true quando total/N não é exato em centavos: avisar o ADM (regra de arredondamento) */
  avisoCentavos: boolean
}

/**
 * 4.3: total mínimo de UM recibo para N cotas = menor T(k,g) ≥ Piso(N).
 * Desempate: menor total, depois menor k. Devolve null se nenhuma composição serve.
 */
export function totalMinimo(n: number, r: ParamsRegras): ResultadoTotalMinimo | null {
  const candidatas = opcoesValidasParaN(n, r)
  if (candidatas.length === 0) return null
  candidatas.sort((a, b) => a.total - b.total || a.k - b.k)
  const opcao = candidatas[0]
  return {
    n,
    opcao,
    total: opcao.total,
    cotaCent: cotaDeTotal(opcao.total, n, r.arredondamento_cota),
    avisoCentavos: temCentavosQuebrados(opcao.total, n),
  }
}
