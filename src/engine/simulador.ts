// Simulador do bolão (SPEC 4.4), somente ADM. Funções puras; dinheiro em centavos inteiros.
//
// Modo 1: por número de cotas   → total mínimo de um recibo (4.3).
// Modo 2: por valor             → N e cota-base: melhor composição de até `limite_recibos_simulador`
//                                 recibos, cada um válido para N, com soma ≤ N × cota-base.
// Modo 3: inverso               → dado um orçamento, para cada N viável, a melhor composição.
//
// Programação dinâmica: todo total de recibo é múltiplo do preço da aposta simples, então a DP anda
// de "uma aposta simples" em "uma aposta simples" (índice = total ÷ preço), nunca por força bruta.
import { combinacoes, umEm } from './combinatoria'
import { cotaDeTotal, opcoesValidasParaN, temCentavosQuebrados, totalMinimo, type OpcaoRecibo } from './bolao'
import type { ParamsRegras } from './rules'
import { validarN } from './validacoes'

export type PerfilSimulador = 'menos_recibos' | 'mais_dezenas' | 'mais_jogos'
export type ModoCobranca = 'cota_fixa' | 'cota_teto'

export interface ReciboSimulado extends OpcaoRecibo {
  /** quanto cada cota paga neste recibo (total ÷ N, pela regra de arredondamento), em centavos */
  cotaCent: number
}

/** Uma linha da tabela "composição → gasto, sobra, cota final, jogos, apostas equivalentes, chance". */
export interface LinhaSimulacao {
  n: number
  recibos: ReciboSimulado[]
  /** soma dos recibos: o que será gasto na Caixa */
  gastoCent: number
  /** quantidade de jogos somando todos os recibos */
  jogos: number
  /** gasto ÷ preço da aposta simples: cada R$ 6 compra uma combinação, qualquer que seja k */
  apostasEquivalentes: number
  /** chance de sena: 1 em N (assume jogos sem combinações repetidas) */
  senaUmEm: number
  /** ceil(gasto ÷ N): a "cota final" do cota-teto, pela regra de arredondamento */
  cotaTetoCent: number
  /** algum recibo não divide N em centavos exatos: avisar o ADM (regra de arredondamento) */
  avisoCentavos: boolean
  cobranca: ModoCobranca
  /** cota efetivamente cobrada de cada participante */
  cotaCobradaCent: number
  /** cota cobrada × N */
  arrecadacaoCent: number
  /** orçamento − gasto: é a "sobra" dos vetores do SPEC (R$ 24 no exemplo de N=24 e cota-base R$ 50) */
  sobraOrcamentoCent: number
  /** arrecadação − gasto: vai para a caixinha. Se for negativo, a regra de arredondamento escolhida não cobre o gasto. */
  caixinhaCent: number
}

function montarLinha(
  n: number,
  opcoes: readonly OpcaoRecibo[],
  orcamentoCent: number,
  cobranca: ModoCobranca,
  cotaBaseCent: number | null,
  r: ParamsRegras,
): LinhaSimulacao {
  const recibos = opcoes.map((o) => ({ ...o, cotaCent: cotaDeTotal(o.total, n, r.arredondamento_cota) }))
  const gastoCent = recibos.reduce((s, o) => s + o.total, 0)
  const apostasEquivalentes = gastoCent / r.preco_aposta_simples
  const cotaTetoCent = cotaDeTotal(gastoCent, n, r.arredondamento_cota)
  const cotaCobradaCent = cobranca === 'cota_fixa' && cotaBaseCent !== null ? cotaBaseCent : cotaTetoCent
  const arrecadacaoCent = cotaCobradaCent * n
  return {
    n,
    recibos,
    gastoCent,
    jogos: recibos.reduce((s, o) => s + o.g, 0),
    apostasEquivalentes,
    senaUmEm: umEm(apostasEquivalentes),
    cotaTetoCent,
    avisoCentavos: recibos.some((o) => temCentavosQuebrados(o.total, n)),
    cobranca,
    cotaCobradaCent,
    arrecadacaoCent,
    sobraOrcamentoCent: orcamentoCent - gastoCent,
    caixinhaCent: arrecadacaoCent - gastoCent,
  }
}

/** Modo 1 (SPEC 4.3/4.4): o menor recibo possível para N cotas. null se N for inválido. */
export function simularPorCotas(n: number, r: ParamsRegras): LinhaSimulacao | null {
  if (validarN(n, r).length > 0) return null
  const t = totalMinimo(n, r)
  if (!t) return null
  return montarLinha(n, [t.opcao], t.total, 'cota_teto', null, r)
}

// ---------------------------------------------------------------------------------------------
// Modos 2 e 3: melhor composição por programação dinâmica
// ---------------------------------------------------------------------------------------------

/** Quantas composições empatadas no gasto máximo examinamos para aplicar o perfil (trava de segurança). */
const LIMITE_EMPATES = 50_000

const somaJogos = (c: readonly OpcaoRecibo[]) => c.reduce((s, o) => s + o.g, 0)
const dezenasDesc = (c: readonly OpcaoRecibo[]) => c.map((o) => o.k).sort((a, b) => b - a)
const chave = (c: readonly OpcaoRecibo[]) => c.map((o) => `${o.k}x${o.g}`).join('+')

/** Compara duas listas "maior primeiro": negativo se `a` tem dezenas maiores (é melhor). */
function maiorPrimeiro(a: number[], b: number[]): number {
  const m = Math.min(a.length, b.length)
  for (let i = 0; i < m; i++) if (a[i] !== b[i]) return b[i] - a[i]
  return a.length - b.length // uma lista é prefixo da outra: a mais curta (menos recibos) vence
}

/** Negativo quando `a` é melhor que `b` para o perfil. Desempate final determinístico. */
function comparar(perfil: PerfilSimulador, a: OpcaoRecibo[], b: OpcaoRecibo[]): number {
  const kA = dezenasDesc(a)
  const kB = dezenasDesc(b)
  let c = 0
  if (perfil === 'menos_recibos') c = a.length - b.length || somaJogos(a) - somaJogos(b) || maiorPrimeiro(kA, kB)
  else if (perfil === 'mais_dezenas') c = maiorPrimeiro(kA, kB) || a.length - b.length || somaJogos(a) - somaJogos(b)
  else c = somaJogos(b) - somaJogos(a) || a.length - b.length || maiorPrimeiro(kA, kB)
  if (c !== 0) return c
  const ka = chave(a)
  const kb = chave(b)
  return ka < kb ? -1 : ka > kb ? 1 : 0
}

/**
 * Entre as composições de até `limite_recibos_simulador` recibos, cada um válido para N cotas,
 * com soma ≤ orçamento: a de MAIOR gasto; no empate, a que o perfil prefere. null se nada cabe.
 */
export function melhorComposicao(
  n: number,
  orcamentoCent: number,
  perfil: PerfilSimulador,
  r: ParamsRegras,
): OpcaoRecibo[] | null {
  if (validarN(n, r).length > 0 || !Number.isFinite(orcamentoCent) || orcamentoCent <= 0) return null
  const unidade = r.preco_aposta_simples
  const maxIdx = Math.floor(orcamentoCent / unidade)
  const opcoes = opcoesValidasParaN(n, r)
    .filter((o) => o.total <= orcamentoCent)
    .map((o) => ({ ...o, idx: o.total / unidade }))
    .sort((a, b) => b.idx - a.idx || b.k - a.k || b.g - a.g)
  if (opcoes.length === 0) return null

  const limite = r.limite_recibos_simulador
  // alcanca[j][s] = dá para somar exatamente s apostas simples com NO MÁXIMO j recibos
  const alcanca: Uint8Array[] = [new Uint8Array(maxIdx + 1)]
  alcanca[0][0] = 1
  for (let j = 1; j <= limite; j++) {
    const atual = Uint8Array.from(alcanca[j - 1])
    const anterior = alcanca[j - 1]
    for (let s = 0; s <= maxIdx; s++) {
      if (atual[s]) continue
      for (const o of opcoes) {
        if (o.idx <= s && anterior[s - o.idx]) {
          atual[s] = 1
          break
        }
      }
    }
    alcanca.push(atual)
  }

  let alvo = 0
  for (let s = maxIdx; s >= 1; s--) {
    if (alcanca[limite][s]) {
      alvo = s
      break
    }
  }
  if (alvo === 0) return null

  // Enumera as composições que atingem exatamente o gasto máximo e fica com a melhor pelo perfil.
  let melhor: OpcaoRecibo[] | null = null
  let visitadas = 0
  const atual: OpcaoRecibo[] = []
  const buscar = (de: number, resto: number, recibosRestantes: number): void => {
    if (visitadas >= LIMITE_EMPATES) return
    if (resto === 0) {
      visitadas++
      const candidata = atual.map(({ k, g, total }) => ({ k, g, total }))
      if (melhor === null || comparar(perfil, candidata, melhor) < 0) melhor = candidata
      return
    }
    if (recibosRestantes === 0) return
    for (let i = de; i < opcoes.length; i++) {
      const o = opcoes[i]
      if (o.idx > resto) continue
      if (!alcanca[recibosRestantes - 1][resto - o.idx]) continue
      atual.push(o)
      buscar(i, resto - o.idx, recibosRestantes - 1)
      atual.pop()
    }
  }
  buscar(0, alvo, limite)
  return melhor
}

export interface EntradaPorValor {
  n: number
  /** cota-base que o ADM quer arrecadar de cada participante, em centavos. Orçamento B = N × cota-base. */
  cotaBaseCent: number
  perfil?: PerfilSimulador
  cobranca?: ModoCobranca
}

/** Modo 2 (SPEC 4.4): maximiza o gasto sem passar de N × cota-base. null se nada cabe. */
export function simularPorValor(e: EntradaPorValor, r: ParamsRegras): LinhaSimulacao | null {
  if (!Number.isInteger(e.cotaBaseCent) || e.cotaBaseCent <= 0) return null
  const orcamento = e.n * e.cotaBaseCent
  const comp = melhorComposicao(e.n, orcamento, e.perfil ?? 'menos_recibos', r)
  if (!comp) return null
  return montarLinha(e.n, comp, orcamento, e.cobranca ?? 'cota_fixa', e.cotaBaseCent, r)
}

export interface ResultadoInverso {
  /** uma linha para cada N viável (do menor para o maior) */
  linhas: LinhaSimulacao[]
  /** o maior N que cabe no orçamento (null se nenhum) */
  maiorN: number | null
}

/**
 * Modo 3 (inverso). [PREMISSA — o SPEC é vago]: dado um orçamento total, para cada N de 2 a 100 mostra o
 * melhor gasto ≤ orçamento, respeitando "700 × N por recibo" e "N ≤ 100", e destaca o maior N viável.
 */
export function simularInverso(
  orcamentoCent: number,
  r: ParamsRegras,
  perfil: PerfilSimulador = 'menos_recibos',
): ResultadoInverso {
  const linhas: LinhaSimulacao[] = []
  for (let n = r.bolao_cotas_min; n <= r.bolao_cotas_max; n++) {
    const comp = melhorComposicao(n, orcamentoCent, perfil, r)
    if (comp) linhas.push(montarLinha(n, comp, orcamentoCent, 'cota_teto', null, r))
  }
  return { linhas, maiorN: linhas.length > 0 ? linhas[linhas.length - 1].n : null }
}

/** Quantas combinações de 6 dezenas uma composição cobre (cada jogo de k dezenas cobre C(k,6)). */
export function combinacoesCobertas(recibos: readonly { k: number; g: number }[]): number {
  return recibos.reduce((s, o) => s + combinacoes(o.k, 6) * o.g, 0)
}
