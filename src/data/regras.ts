// Regras versionadas no banco (tabela rules_versions). Leitura pública; só o ADM insere, e nunca se edita:
// cada mudança é uma NOVA versão com data de vigência.
import type { ParamsRegras, VersaoRegras } from '../engine/rules'
import { supabase } from './supabase'

interface LinhaRegras {
  vigencia_inicio: string
  json: { fonte?: string; params?: ParamsRegras } | null
}

export async function carregarVersoes(): Promise<{ versoes: VersaoRegras[]; erro: string | null }> {
  const { data, error } = await supabase.from('rules_versions').select('vigencia_inicio, json').order('vigencia_inicio', { ascending: false })
  if (error) return { versoes: [], erro: 'Não consegui ler as regras do banco.' }
  const versoes: VersaoRegras[] = []
  for (const l of (data ?? []) as LinhaRegras[]) {
    if (l.json?.params) versoes.push({ vigencia_inicio: l.vigencia_inicio, fonte: l.json.fonte, params: l.json.params })
  }
  return { versoes, erro: null }
}

/** Grava uma nova versão. Devolve a mensagem de erro, ou null se deu certo. */
export async function inserirVersao(v: VersaoRegras): Promise<string | null> {
  const { error } = await supabase.from('rules_versions').insert({ vigencia_inicio: v.vigencia_inicio, json: { fonte: v.fonte, params: v.params } })
  if (!error) return null
  if (error.code === '23505') return 'Já existe uma versão com esta data de vigência: escolha outra data.'
  if (error.code === '42501' || /row-level security|permission/i.test(error.message)) return 'Só o ADM pode gravar regras.'
  return 'Não consegui gravar as regras agora.'
}
