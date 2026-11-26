// Validações (SPEC 4.2, 5 e 9.2). Cada função devolve a lista de problemas em português;
// lista vazia = válido. Funções puras: quem chama decide o que fazer com os erros.
import { DEZENAS_SORTEADAS, DEZENAS_UNIVERSO } from './combinatoria'
import { nCotasValido, totalRecibo, totalValidoParaN } from './bolao'
import type { ParamsRegras } from './rules'

const ehInteiro = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

/** Um jogo: k dezenas DISTINTAS entre 1 e 60, com k dentro dos limites da regra (6 a 20). */
export function validarJogo(dezenas: readonly number[], r: ParamsRegras): string[] {
  const erros: string[] = []
  if (!Array.isArray(dezenas)) return ['O jogo deve ser uma lista de dezenas.']
  if (dezenas.length < r.dezenas_min || dezenas.length > r.dezenas_max) {
    erros.push(`O jogo deve ter entre ${r.dezenas_min} e ${r.dezenas_max} dezenas (tem ${dezenas.length}).`)
  }
  for (const d of dezenas) {
    if (!ehInteiro(d) || d < 1 || d > DEZENAS_UNIVERSO) erros.push(`Dezena inválida: ${String(d)} (use de 1 a ${DEZENAS_UNIVERSO}).`)
  }
  if (new Set(dezenas).size !== dezenas.length) erros.push('Há dezenas repetidas no jogo.')
  return erros
}

/** N cotas do bolão: inteiro entre o mínimo e o máximo da regra. */
export function validarN(n: number, r: ParamsRegras): string[] {
  return nCotasValido(n, r) ? [] : [`O número de cotas deve ser um inteiro de ${r.bolao_cotas_min} a ${r.bolao_cotas_max}.`]
}

/** Um recibo (k, g) para N cotas: limites de dezenas e jogos, valor mínimo e cota mínima (SPEC 4.2). */
export function validarRecibo(k: number, g: number, n: number, r: ParamsRegras): string[] {
  const erros = [...validarN(n, r)]
  if (!ehInteiro(k) || k < r.dezenas_min || k > r.dezenas_max) {
    erros.push(`Cada jogo deve ter de ${r.dezenas_min} a ${r.dezenas_max} dezenas.`)
  }
  if (!ehInteiro(g) || g < 1 || g > r.bolao_jogos_max_por_recibo) {
    erros.push(`Um recibo deve ter de 1 a ${r.bolao_jogos_max_por_recibo} jogos.`)
  }
  if (erros.length > 0) return erros
  const total = totalRecibo(k, g, r)
  if (total < r.bolao_valor_minimo) erros.push(`O total do recibo está abaixo do valor mínimo (${r.bolao_valor_minimo} centavos).`)
  if (!totalValidoParaN(total, n, r) && total >= r.bolao_valor_minimo) {
    erros.push(`Com ${n} cotas, cada cota ficaria abaixo do mínimo (${r.bolao_cota_minima} centavos).`)
  }
  return erros
}

/** Dados de um concurso candidato a entrar no banco (já lidos da Caixa, em centavos). */
export interface ConcursoCandidato {
  numero: number
  /** yyyy-mm-dd */
  data: string
  dezenas: readonly number[]
  /** ganhadores por faixa (6, 5 e 4 acertos) */
  ganhadores: { sena: number; quina: number; quadra: number }
  /** valor do prêmio por ganhador, em centavos */
  valoresCent: { sena: number; quina: number; quadra: number }
  arrecadacaoCent: number
}

/**
 * SPEC 9.2, regras que o servidor aplica antes de gravar: é o PRÓXIMO da sequência, 6 dezenas
 * distintas de 1 a 60, valores e ganhadores ≥ 0, e NUNCA sobrescreve um concurso que já existe.
 * `ultimoNumero` = último concurso no banco (0 se o banco estiver vazio).
 */
export function validarConcursoNovo(
  c: ConcursoCandidato,
  ultimoNumero: number,
  jaExistentes: ReadonlySet<number> = new Set(),
): string[] {
  const erros: string[] = []
  if (jaExistentes.has(c.numero)) erros.push(`O concurso ${c.numero} já existe e nunca é sobrescrito.`)
  else if (c.numero !== ultimoNumero + 1) erros.push(`O próximo concurso deveria ser o ${ultimoNumero + 1}, mas veio o ${c.numero}.`)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.data)) erros.push(`Data inválida: "${c.data}".`)

  const distintas = new Set(c.dezenas)
  if (
    c.dezenas.length !== DEZENAS_SORTEADAS ||
    distintas.size !== DEZENAS_SORTEADAS ||
    c.dezenas.some((d) => !ehInteiro(d) || d < 1 || d > DEZENAS_UNIVERSO)
  ) {
    erros.push(`O concurso precisa de ${DEZENAS_SORTEADAS} dezenas distintas de 1 a ${DEZENAS_UNIVERSO}.`)
  }

  const naoNegativos: [string, number][] = [
    ['ganhadores da sena', c.ganhadores.sena], ['ganhadores da quina', c.ganhadores.quina], ['ganhadores da quadra', c.ganhadores.quadra],
    ['valor da sena', c.valoresCent.sena], ['valor da quina', c.valoresCent.quina], ['valor da quadra', c.valoresCent.quadra],
    ['arrecadação', c.arrecadacaoCent],
  ]
  for (const [nome, v] of naoNegativos) {
    if (!ehInteiro(v) || v < 0) erros.push(`O campo "${nome}" deve ser um inteiro ≥ 0 (valores em centavos).`)
  }
  return erros
}
