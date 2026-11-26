// Regras oficiais (SPEC seção 3). NADA disto fica fixo no código: vem de rules.json,
// versionado por data de vigência e editável pelo ADM. Dinheiro em centavos; percentuais em
// pontos-base inteiros (1% = 100), para nunca usar decimais em valores monetários.

export type ArredondamentoCota = 'cima' | 'baixo' | 'proximo'

export interface ParamsRegras {
  preco_aposta_simples: number
  bolao_valor_minimo: number
  bolao_cota_minima: number
  bolao_cotas_min: number
  bolao_cotas_max: number
  bolao_jogos_max_por_recibo: number
  dezenas_min: number
  dezenas_max: number
  tarifa_servico_bolao_bp: number
  premio_bruto_bp: number
  virada_distribuicao_bp: { sena: number; quina: number; quadra: number }
  comum_distribuicao_bp: { sena: number; quina: number; quadra: number; final_0_5: number; virada: number }
  ir_aliquota_bp: number
  ir_valor_isento: number
  arredondamento_cota: ArredondamentoCota
  limite_recibos_simulador: number
  concurso_virada: { numero: number; data: string; hora: string }
  data_limite_aposta: string
}

export interface VersaoRegras {
  /** yyyy-mm-dd: a versão vale a partir desta data */
  vigencia_inicio: string
  fonte?: string
  params: ParamsRegras
}

export interface ArquivoRegras {
  versoes: VersaoRegras[]
}

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/

const inteiroNaoNegativo = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

/** Confere um arquivo de regras. Devolve a lista de problemas (vazia = ok). */
export function validarRegras(arquivo: ArquivoRegras): string[] {
  const erros: string[] = []
  if (!arquivo || !Array.isArray(arquivo.versoes) || arquivo.versoes.length === 0) {
    return ['rules.json precisa ter pelo menos uma versão em "versoes".']
  }

  const datas = new Set<string>()
  arquivo.versoes.forEach((ver, i) => {
    const onde = `versão ${i + 1} (${ver?.vigencia_inicio ?? '?'})`
    if (!ver || typeof ver.vigencia_inicio !== 'string' || !RE_DATA.test(ver.vigencia_inicio)) {
      erros.push(`${onde}: vigencia_inicio deve ser yyyy-mm-dd.`)
      return
    }
    if (datas.has(ver.vigencia_inicio)) erros.push(`${onde}: vigencia_inicio repetida.`)
    datas.add(ver.vigencia_inicio)

    const p = ver.params
    if (!p) {
      erros.push(`${onde}: faltam os params.`)
      return
    }

    const inteiros: (keyof ParamsRegras)[] = [
      'preco_aposta_simples', 'bolao_valor_minimo', 'bolao_cota_minima', 'bolao_cotas_min', 'bolao_cotas_max',
      'bolao_jogos_max_por_recibo', 'dezenas_min', 'dezenas_max', 'tarifa_servico_bolao_bp', 'premio_bruto_bp',
      'ir_aliquota_bp', 'ir_valor_isento', 'limite_recibos_simulador',
    ]
    for (const chave of inteiros) {
      if (!inteiroNaoNegativo(p[chave])) erros.push(`${onde}: "${chave}" deve ser um inteiro ≥ 0 (centavos ou pontos-base).`)
    }

    if (p.preco_aposta_simples <= 0) erros.push(`${onde}: preco_aposta_simples deve ser > 0.`)
    if (p.bolao_cotas_min < 1 || p.bolao_cotas_min > p.bolao_cotas_max) {
      erros.push(`${onde}: bolao_cotas_min deve estar entre 1 e bolao_cotas_max.`)
    }
    if (p.bolao_jogos_max_por_recibo < 1) erros.push(`${onde}: bolao_jogos_max_por_recibo deve ser ≥ 1.`)
    if (p.dezenas_min < 6 || p.dezenas_min > p.dezenas_max || p.dezenas_max > 60) {
      erros.push(`${onde}: dezenas_min/dezenas_max devem respeitar 6 ≤ min ≤ max ≤ 60.`)
    }
    if (p.limite_recibos_simulador < 1) erros.push(`${onde}: limite_recibos_simulador deve ser ≥ 1.`)
    if (p.premio_bruto_bp > 10000 || p.ir_aliquota_bp > 10000 || p.tarifa_servico_bolao_bp > 10000) {
      erros.push(`${onde}: percentuais não podem passar de 100% (10000 pontos-base).`)
    }

    const somaV = Object.values(p.virada_distribuicao_bp ?? {}).reduce((a, b) => a + b, 0)
    if (somaV !== 10000) erros.push(`${onde}: virada_distribuicao_bp deve somar 10000 (soma atual ${somaV}).`)
    const somaC = Object.values(p.comum_distribuicao_bp ?? {}).reduce((a, b) => a + b, 0)
    if (somaC !== 10000) erros.push(`${onde}: comum_distribuicao_bp deve somar 10000 (soma atual ${somaC}).`)

    if (!['cima', 'baixo', 'proximo'].includes(p.arredondamento_cota)) {
      erros.push(`${onde}: arredondamento_cota deve ser "cima", "baixo" ou "proximo".`)
    }
    if (!p.concurso_virada || !inteiroNaoNegativo(p.concurso_virada.numero) || !RE_DATA.test(p.concurso_virada.data ?? '')) {
      erros.push(`${onde}: concurso_virada precisa de numero (inteiro) e data (yyyy-mm-dd).`)
    }
    if (typeof p.data_limite_aposta !== 'string' || Number.isNaN(Date.parse(p.data_limite_aposta))) {
      erros.push(`${onde}: data_limite_aposta deve ser uma data/hora válida (ex.: 2026-12-31T22:00:00-03:00).`)
    }
  })
  return erros
}

/** Parâmetros em vigor numa data (yyyy-mm-dd): a versão mais recente com vigencia_inicio ≤ data. */
export function regrasVigentes(arquivo: ArquivoRegras, dataIso: string): ParamsRegras {
  if (!RE_DATA.test(dataIso)) throw new Error(`Data inválida: "${dataIso}" (use yyyy-mm-dd).`)
  const candidatas = arquivo.versoes
    .filter((v) => v.vigencia_inicio <= dataIso)
    .sort((a, b) => (a.vigencia_inicio < b.vigencia_inicio ? 1 : -1))
  if (candidatas.length === 0) throw new Error(`Não há regras em vigor em ${dataIso}.`)
  return candidatas[0].params
}
