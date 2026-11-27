// Auditoria do concurso (SPEC seção 6): reúne os jogos de TODOS os bolões congelados do mesmo concurso e confere
// repetição de combinações, sobreposição máxima e a chance de sena de todos juntos. Função pura.
import { combinacoes, mascaraBits, popcount32, TOTAL_COMBINACOES } from './combinatoria'
import { combinacoesDistintas } from './probabilidades'

export interface BolaoParaAuditar {
  id: string
  nome: string
  jogos: readonly (readonly number[])[]
}

export interface RelatorioAuditoria {
  boloes: number
  totalJogos: number
  /** soma de C(k,6) de todos os jogos */
  combinacoesEsperadas: number
  combinacoesDistintas: number
  /** esperadas − distintas: precisa ser 0 */
  repetidas: number
  /** maior nº de dezenas iguais entre dois jogos quaisquer (do mesmo bolão ou de bolões diferentes) */
  sobreposicaoMaxima: number
  /** onde acontece a maior sobreposição (nome dos bolões) */
  parSobreposicao: [string, string] | null
  /** chance de sena de todos os bolões juntos: 1 em N */
  senaUmEm: number | null
}

export function auditarBoloes(boloes: readonly BolaoParaAuditar[]): RelatorioAuditoria {
  const todos: { bolao: string; mascara: [number, number]; dezenas: readonly number[] }[] = []
  for (const b of boloes) for (const j of b.jogos) todos.push({ bolao: b.nome, mascara: mascaraBits(j), dezenas: j })

  let esperadas = 0
  for (const t of todos) esperadas += combinacoes(t.dezenas.length, 6)
  const distintas = combinacoesDistintas(todos.map((t) => t.dezenas))

  let sobMax = 0
  let par: [string, string] | null = null
  for (let i = 0; i < todos.length; i++) {
    for (let j = i + 1; j < todos.length; j++) {
      const s = popcount32(todos[i].mascara[0] & todos[j].mascara[0]) + popcount32(todos[i].mascara[1] & todos[j].mascara[1])
      if (s > sobMax) {
        sobMax = s
        par = [todos[i].bolao, todos[j].bolao]
      }
    }
  }

  return {
    boloes: boloes.length,
    totalJogos: todos.length,
    combinacoesEsperadas: esperadas,
    combinacoesDistintas: distintas,
    repetidas: esperadas - distintas,
    sobreposicaoMaxima: sobMax,
    parSobreposicao: par,
    senaUmEm: distintas > 0 ? TOTAL_COMBINACOES / distintas : null,
  }
}
