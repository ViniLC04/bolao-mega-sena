// Formulário da tela "Regras": ida e volta entre os parâmetros (centavos e pontos-base inteiros) e os textos que a
// pessoa digita (R$ 7,00 e 43,79%). Funções puras, testadas.
import type { ArredondamentoCota, ParamsRegras } from '../engine/rules'
import {
  campoLocalSPParaIso,
  formatarBp,
  formatarReaisCampo,
  isoParaCampoLocalSP,
  parsePercentual,
  parseReais,
} from './formato'

export interface FormRegras {
  preco: string
  valorMinimo: string
  cotaMinima: string
  cotasMin: string
  cotasMax: string
  jogosMax: string
  dezMin: string
  dezMax: string
  tarifa: string
  premioBruto: string
  viradaSena: string
  viradaQuina: string
  viradaQuadra: string
  comumSena: string
  comumQuina: string
  comumQuadra: string
  comumFinal: string
  comumVirada: string
  irAliquota: string
  irIsento: string
  arredondamento: string
  limiteRecibos: string
  viradaNumero: string
  viradaData: string
  viradaHora: string
  dataLimite: string
}

export function paraForm(p: ParamsRegras): FormRegras {
  return {
    preco: formatarReaisCampo(p.preco_aposta_simples),
    valorMinimo: formatarReaisCampo(p.bolao_valor_minimo),
    cotaMinima: formatarReaisCampo(p.bolao_cota_minima),
    cotasMin: String(p.bolao_cotas_min),
    cotasMax: String(p.bolao_cotas_max),
    jogosMax: String(p.bolao_jogos_max_por_recibo),
    dezMin: String(p.dezenas_min),
    dezMax: String(p.dezenas_max),
    tarifa: formatarBp(p.tarifa_servico_bolao_bp),
    premioBruto: formatarBp(p.premio_bruto_bp),
    viradaSena: formatarBp(p.virada_distribuicao_bp.sena),
    viradaQuina: formatarBp(p.virada_distribuicao_bp.quina),
    viradaQuadra: formatarBp(p.virada_distribuicao_bp.quadra),
    comumSena: formatarBp(p.comum_distribuicao_bp.sena),
    comumQuina: formatarBp(p.comum_distribuicao_bp.quina),
    comumQuadra: formatarBp(p.comum_distribuicao_bp.quadra),
    comumFinal: formatarBp(p.comum_distribuicao_bp.final_0_5),
    comumVirada: formatarBp(p.comum_distribuicao_bp.virada),
    irAliquota: formatarBp(p.ir_aliquota_bp),
    irIsento: formatarReaisCampo(p.ir_valor_isento),
    arredondamento: p.arredondamento_cota,
    limiteRecibos: String(p.limite_recibos_simulador),
    viradaNumero: String(p.concurso_virada.numero),
    viradaData: p.concurso_virada.data,
    viradaHora: p.concurso_virada.hora,
    dataLimite: isoParaCampoLocalSP(p.data_limite_aposta),
  }
}

const inteiro = (t: string): number | null => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : null)

/** Converte o que foi digitado de volta em parâmetros. Devolve os erros em português (um por campo com problema). */
export function deForm(f: FormRegras): { params: ParamsRegras | null; erros: string[] } {
  const erros: string[] = []
  const reais = (nome: string, t: string): number => {
    const v = parseReais(t)
    if (v === null) erros.push(`${nome}: valor em reais inválido (ex.: 7,00).`)
    return v ?? 0
  }
  const pct = (nome: string, t: string): number => {
    const v = parsePercentual(t)
    if (v === null) erros.push(`${nome}: percentual inválido (ex.: 43,79).`)
    return v ?? 0
  }
  const int = (nome: string, t: string): number => {
    const v = inteiro(t)
    if (v === null) erros.push(`${nome}: use um número inteiro.`)
    return v ?? 0
  }

  const arred = f.arredondamento as ArredondamentoCota
  if (!['cima', 'baixo', 'proximo'].includes(arred)) erros.push('Arredondamento da cota: escolha uma opção.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.viradaData)) erros.push('Data da Virada: use o formato aaaa-mm-dd.')
  if (!/^\d{2}:\d{2}$/.test(f.viradaHora)) erros.push('Hora da Virada: use o formato hh:mm.')
  const limite = campoLocalSPParaIso(f.dataLimite)
  if (!limite) erros.push('Data limite de aposta: informe data e hora.')

  const params: ParamsRegras = {
    preco_aposta_simples: reais('Preço da aposta simples', f.preco),
    bolao_valor_minimo: reais('Valor mínimo do bolão', f.valorMinimo),
    bolao_cota_minima: reais('Cota mínima', f.cotaMinima),
    bolao_cotas_min: int('Mínimo de cotas', f.cotasMin),
    bolao_cotas_max: int('Máximo de cotas', f.cotasMax),
    bolao_jogos_max_por_recibo: int('Jogos por recibo (máximo)', f.jogosMax),
    dezenas_min: int('Dezenas por jogo (mínimo)', f.dezMin),
    dezenas_max: int('Dezenas por jogo (máximo)', f.dezMax),
    tarifa_servico_bolao_bp: pct('Tarifa de serviço do bolão', f.tarifa),
    premio_bruto_bp: pct('Prêmio bruto sobre a arrecadação', f.premioBruto),
    virada_distribuicao_bp: {
      sena: pct('Virada: sena', f.viradaSena),
      quina: pct('Virada: quina', f.viradaQuina),
      quadra: pct('Virada: quadra', f.viradaQuadra),
    },
    comum_distribuicao_bp: {
      sena: pct('Concurso comum: sena', f.comumSena),
      quina: pct('Concurso comum: quina', f.comumQuina),
      quadra: pct('Concurso comum: quadra', f.comumQuadra),
      final_0_5: pct('Concurso comum: final 0 a 5', f.comumFinal),
      virada: pct('Concurso comum: parte da Virada', f.comumVirada),
    },
    ir_aliquota_bp: pct('Imposto de renda', f.irAliquota),
    ir_valor_isento: reais('Valor isento de IR', f.irIsento),
    arredondamento_cota: arred,
    limite_recibos_simulador: int('Limite de recibos no simulador', f.limiteRecibos),
    concurso_virada: { numero: int('Número do concurso da Virada', f.viradaNumero), data: f.viradaData, hora: f.viradaHora },
    data_limite_aposta: limite,
  }
  return { params: erros.length === 0 ? params : null, erros }
}
