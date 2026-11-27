// Conferência do arquivo de backup. Sem nenhuma importação, para o script scripts/conferir-backup.mts usar o mesmo código.

export const TABELAS_DO_BACKUP = [
  'participantes',
  'bolaos',
  'recibos',
  'jogos',
  'cotas',
  'caixinha_mov',
  'combinacoes_cobertas',
  'config',
  'rules_versions',
  'auditoria',
  'fontes_log',
] as const

export type NomeTabelaBackup = (typeof TABELAS_DO_BACKUP)[number] | 'concursos' | 'concurso_faixas'

export interface Backup {
  versao: 1
  gerado_em: string
  tabelas: Partial<Record<NomeTabelaBackup, Record<string, unknown>[]>>
  contagens: Partial<Record<NomeTabelaBackup, number>>
}

/** Confere um backup (já lido do arquivo): formato, contagens e ligações entre tabelas. Devolve os problemas (vazio = ok). */
export function conferirBackup(b: unknown): string[] {
  const erros: string[] = []
  if (typeof b !== 'object' || b === null) return ['O arquivo não é um backup (não é um objeto JSON).']
  const o = b as Partial<Backup>
  if (o.versao !== 1) erros.push('Versão de backup desconhecida.')
  if (!o.tabelas || typeof o.tabelas !== 'object') return [...erros, 'Faltam as tabelas.']
  if (!o.contagens || typeof o.contagens !== 'object') return [...erros, 'Faltam as contagens.']
  for (const t of TABELAS_DO_BACKUP) {
    const linhas = o.tabelas[t]
    if (!Array.isArray(linhas)) erros.push(`Falta a tabela ${t}.`)
    else if (o.contagens[t] !== linhas.length) erros.push(`A tabela ${t} tem ${linhas.length} linha(s), mas a contagem diz ${o.contagens[t]}.`)
  }
  if (erros.length > 0) return erros

  const ids = (t: NomeTabelaBackup) => new Set((o.tabelas![t] ?? []).map((l) => String(l.id)))
  const pessoas = ids('participantes')
  const boloes = ids('bolaos')
  const recibosIds = ids('recibos')
  for (const c of o.tabelas.cotas ?? []) {
    if (!pessoas.has(String(c.participante_id))) erros.push(`Há cotas de um participante que não está no backup (${String(c.participante_id)}).`)
    if (!boloes.has(String(c.bolao_id))) erros.push(`Há cotas de um bolão que não está no backup (${String(c.bolao_id)}).`)
  }
  for (const r of o.tabelas.recibos ?? []) if (!boloes.has(String(r.bolao_id))) erros.push(`Há recibo de um bolão que não está no backup (${String(r.bolao_id)}).`)
  for (const j of o.tabelas.jogos ?? []) if (!recibosIds.has(String(j.recibo_id))) erros.push(`Há jogo de um recibo que não está no backup (${String(j.recibo_id)}).`)
  for (const m of o.tabelas.caixinha_mov ?? []) if (!boloes.has(String(m.bolao_id))) erros.push(`Há lançamento da caixinha de um bolão que não está no backup (${String(m.bolao_id)}).`)
  return [...new Set(erros)].slice(0, 20)
}
