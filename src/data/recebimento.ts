// Recebimento por PIX do organizador (fica na tabela config, só o ADM lê). O público só recebe estes dados, pela função
// publico_recebimento, quando tem um link pessoal com pagamento pendente.
import { normalizarChavePix, textoPix, type TipoChavePix } from '../engine/pix'
import { supabase } from './supabase'

export interface Recebimento {
  tipo: TipoChavePix
  /** chave já normalizada */
  chave: string
  /** nome do recebedor (até 25 caracteres, sem acento) */
  nome: string
  /** cidade (até 15 caracteres, sem acento) */
  cidade: string
  /** WhatsApp do organizador (só números, com DDD) para a pessoa mandar o comprovante */
  whatsapp: string
}

const CHAVE = 'recebimento'

export async function carregarRecebimento(): Promise<{ recebimento: Recebimento | null; erro: string | null }> {
  const { data, error } = await supabase.from('config').select('valor').eq('chave', CHAVE).maybeSingle()
  if (error) return { recebimento: null, erro: 'Não consegui ler o recebimento por PIX.' }
  return { recebimento: ((data as { valor: Recebimento } | null)?.valor as Recebimento | undefined) ?? null, erro: null }
}

/** Valida e grava. `texto` é o que foi digitado; a chave é normalizada. Devolve os erros (lista vazia = gravou). */
export async function salvarRecebimento(entrada: { tipo: TipoChavePix; chave: string; nome: string; cidade: string; whatsapp: string }): Promise<{ erros: string[]; salvo: Recebimento | null }> {
  const erros: string[] = []
  const c = normalizarChavePix(entrada.tipo, entrada.chave)
  if ('erro' in c) erros.push(c.erro)
  const nome = textoPix(entrada.nome, 25)
  const cidade = textoPix(entrada.cidade, 15)
  if (nome.length < 2) erros.push('Informe o nome de quem recebe (como está no banco).')
  if (cidade.length < 2) erros.push('Informe a cidade.')
  const zap = entrada.whatsapp.replace(/\D/g, '')
  const zapNacional = zap.startsWith('55') && zap.length >= 12 ? zap.slice(2) : zap
  if (zapNacional.length !== 10 && zapNacional.length !== 11) erros.push('Informe o seu WhatsApp com DDD (10 ou 11 números).')
  if (erros.length > 0 || 'erro' in c) return { erros, salvo: null }
  const valor: Recebimento = { tipo: entrada.tipo, chave: c.chave, nome, cidade, whatsapp: zapNacional }
  const { error } = await supabase.from('config').upsert({ chave: CHAVE, valor, atualizado_em: new Date().toISOString() })
  if (error) return { erros: ['Não consegui gravar agora. Tente de novo.'], salvo: null }
  return { erros: [], salvo: valor }
}
