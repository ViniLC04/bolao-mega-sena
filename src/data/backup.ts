// Backup do organizador: lê as tabelas (só o ADM consegue, pelo banco) e monta o arquivo no navegador.
import { csvPagamentos, TABELAS_DO_BACKUP, type Backup, type NomeTabelaBackup, type PagamentoLinha } from '../app/backup'
import { supabase } from './supabase'

const PAGINA = 1000

async function todasAsLinhas(tabela: string, ordenarPor: string): Promise<Record<string, unknown>[]> {
  const todas: Record<string, unknown>[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase.from(tabela).select('*').order(ordenarPor, { ascending: true }).range(de, de + PAGINA - 1)
    if (error) throw new Error(`Não consegui ler a tabela ${tabela}.`)
    const linhas = (data ?? []) as Record<string, unknown>[]
    todas.push(...linhas)
    if (linhas.length < PAGINA) break
  }
  return todas
}

const ORDEM: Record<string, string> = {
  participantes: 'criado_em',
  bolaos: 'criado_em',
  recibos: 'bolao_id',
  jogos: 'recibo_id',
  cotas: 'criado_em',
  caixinha_mov: 'criado_em',
  combinacoes_cobertas: 'combo_rank',
  config: 'chave',
  rules_versions: 'vigencia_inicio',
  auditoria: 'id',
  fontes_log: 'id',
  concursos: 'numero',
  concurso_faixas: 'concurso',
}

/** Lê tudo e monta o backup. `incluirConcursos` acrescenta os concursos (arquivo bem maior; dá para reimportar da planilha). */
export async function gerarBackup(incluirConcursos: boolean, progresso: (texto: string) => void): Promise<Backup> {
  const lista: NomeTabelaBackup[] = [...TABELAS_DO_BACKUP, ...(incluirConcursos ? (['concursos', 'concurso_faixas'] as const) : [])]
  const tabelas: Backup['tabelas'] = {}
  const contagens: Backup['contagens'] = {}
  for (const t of lista) {
    progresso(`Lendo ${t}…`)
    const linhas = await todasAsLinhas(t, ORDEM[t])
    tabelas[t] = linhas
    contagens[t] = linhas.length
  }
  return { versao: 1, gerado_em: new Date().toISOString(), tabelas, contagens }
}

/** Planilha de pagamentos a partir das cotas e participantes de um backup. */
export function pagamentosDoBackup(b: Backup): string {
  const pessoas = new Map((b.tabelas.participantes ?? []).map((p) => [String(p.id), p]))
  const boloes = new Map((b.tabelas.bolaos ?? []).map((x) => [String(x.id), x]))
  const linhas: PagamentoLinha[] = (b.tabelas.cotas ?? []).map((c) => {
    const p = pessoas.get(String(c.participante_id))
    const bo = boloes.get(String(c.bolao_id))
    return {
      participante: String(p?.nome ?? '?'),
      contato: (p?.contato as string | null | undefined) ?? null,
      bolao: String(bo?.nome ?? '?'),
      concurso: Number(bo?.concurso_alvo ?? 0),
      qtd: Number(c.qtd),
      valorDevidoCent: Number(c.valor_devido_cent),
      pago: c.pago === true,
      viaEntregue: c.via_entregue === true,
    }
  })
  linhas.sort((a, b) => a.participante.localeCompare(b.participante, 'pt-BR') || a.bolao.localeCompare(b.bolao, 'pt-BR'))
  return csvPagamentos(linhas)
}

/** Faz o navegador baixar um arquivo de texto. */
export function baixarArquivo(nome: string, conteudo: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
