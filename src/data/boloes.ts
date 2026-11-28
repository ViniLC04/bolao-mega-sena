// Bolões no banco: salvar rascunho, listar, congelar (hash + combinações cobertas, tudo numa transação no servidor).
import { totalRecibo } from '../engine/bolao'
import type { JogoGerado, Premissas } from '../engine/gerador'
import { hashJogos } from '../engine/hash'
import { paraCadaRank } from '../engine/probabilidades'
import type { ParamsRegras } from '../engine/rules'
import type { PlanoBolao } from '../app/plano'
import { gerarTokenDoLink } from './participantes'
import { supabase } from './supabase'

export interface BolaoLinha {
  id: string
  concurso_alvo: number
  nome: string
  /** null enquanto o bolão está aberto (o número de cotas só existe ao fechar as inscrições) */
  n_cotas: number | null
  cota_base_cent: number | null
  modo_cobranca: 'cota_fixa' | 'cota_teto'
  status: 'aberto' | 'rascunho' | 'congelado'
  semente: number | null
  criado_em: string
  congelado_em: string | null
  hash: string | null
  regras_snapshot: unknown
  /** bolão aberto: até quando se aceitam cotas novas */
  inscricoes_ate: string | null
  inscricoes_encerradas_em: string | null
}

export interface JogoDet {
  ordem: number
  dezenas: number[]
  travado: boolean
}

export interface ReciboDet {
  ordem: number
  k: number
  g: number
  total_cent: number
  /** caminho da foto do recibo no armazenamento privado (null = sem foto) */
  foto_path: string | null
  jogos: JogoDet[]
}

const COLUNAS =
  'id, concurso_alvo, nome, n_cotas, cota_base_cent, modo_cobranca, status, semente, criado_em, congelado_em, hash, regras_snapshot, inscricoes_ate, inscricoes_encerradas_em'

function erroDoBanco(codigo: string | undefined, texto: string, padrao: string): string {
  if (codigo === '42501' || /row-level security|permission denied/i.test(texto)) return 'Só o ADM pode fazer isso.'
  return padrao
}

export async function listarBoloes(): Promise<{ boloes: BolaoLinha[]; erro: string | null }> {
  const { data, error } = await supabase.from('bolaos').select(COLUNAS).order('criado_em', { ascending: false })
  if (error) return { boloes: [], erro: 'Não consegui ler os bolões.' }
  return { boloes: (data ?? []) as BolaoLinha[], erro: null }
}

export async function carregarBolao(id: string): Promise<{ bolao: BolaoLinha | null; recibos: ReciboDet[]; erro: string | null }> {
  const { data, error } = await supabase.from('bolaos').select(`${COLUNAS}, recibos(ordem, k, g, total_cent, foto_path, jogos(ordem, dezenas, travado))`).eq('id', id).maybeSingle()
  if (error) return { bolao: null, recibos: [], erro: 'Não consegui ler este bolão.' }
  if (!data) return { bolao: null, recibos: [], erro: 'Bolão não encontrado.' }
  const { recibos: rs, ...bolao } = data as unknown as BolaoLinha & { recibos: ReciboDet[] }
  const recibos = [...rs].sort((a, b) => a.ordem - b.ordem).map((r) => ({ ...r, jogos: [...r.jogos].sort((a, b) => a.ordem - b.ordem) }))
  return { bolao, recibos, erro: null }
}

export interface DadosRascunho {
  concurso: number
  nome: string
  plano: PlanoBolao
  jogos: JogoGerado[]
  semente: number
  params: ParamsRegras
  vigencia: string
  premissas: Premissas
}

/** Grava bolão, recibos e jogos como RASCUNHO. Se algo falhar no meio, apaga o que gravou (nada fica pela metade). */
export async function salvarRascunho(d: DadosRascunho): Promise<{ id: string | null; erro: string | null }> {
  const { data: versao } = await supabase.from('rules_versions').select('id').eq('vigencia_inicio', d.vigencia).maybeSingle()
  const { data: b, error } = await supabase
    .from('bolaos')
    .insert({
      concurso_alvo: d.concurso,
      nome: d.nome,
      n_cotas: d.plano.n,
      cota_base_cent: d.plano.cotaBaseCent,
      modo_cobranca: d.plano.cobranca,
      regras_versao_id: (versao as { id: number } | null)?.id ?? null,
      regras_snapshot: { vigencia_inicio: d.vigencia, params: d.params, plano: d.plano, premissas: d.premissas },
      semente: d.semente,
    })
    .select('id')
    .single()
  if (error || !b) return { id: null, erro: erroDoBanco(error?.code, error?.message ?? '', 'Não consegui salvar o bolão agora.') }
  const id = (b as { id: string }).id

  const e = await gravarRecibosEJogos(id, d)
  if (e) {
    await supabase.from('bolaos').delete().eq('id', id)
    return { id: null, erro: e }
  }
  return { id, erro: null }
}

/** Grava os recibos e os jogos de um bolão. Devolve a mensagem de erro (nada fica pela metade), ou null se deu certo. */
async function gravarRecibosEJogos(bolaoId: string, d: DadosRascunho): Promise<string | null> {
  const desfazer = async (motivo: string) => {
    await supabase.from('recibos').delete().eq('bolao_id', bolaoId) // os jogos saem junto (cascata)
    return motivo
  }
  const recibosLinhas = d.plano.recibos.map((r, i) => ({
    bolao_id: bolaoId,
    ordem: i,
    k: r.k,
    g: r.g,
    total_cent: totalRecibo(r.k, r.g, d.params),
    cotas_n: d.plano.n,
  }))
  const r1 = await supabase.from('recibos').insert(recibosLinhas).select('id, ordem')
  if (r1.error || !r1.data) return desfazer('Não consegui salvar os recibos. Nada foi gravado.')
  const idPorOrdem = new Map((r1.data as { id: string; ordem: number }[]).map((r) => [r.ordem, r.id]))

  const contagem = new Map<number, number>()
  const jogosLinhas = d.jogos.map((j) => {
    const ordem = contagem.get(j.recibo) ?? 0
    contagem.set(j.recibo, ordem + 1)
    return { recibo_id: idPorOrdem.get(j.recibo), ordem, dezenas: j.dezenas, travado: j.travado }
  })
  const r2 = await supabase.from('jogos').insert(jogosLinhas)
  if (r2.error) return desfazer('Não consegui salvar os jogos. Nada foi gravado.')
  return null
}

export async function apagarRascunho(id: string): Promise<string | null> {
  const { error } = await supabase.from('bolaos').delete().eq('id', id).in('status', ['aberto', 'rascunho'])
  return error ? erroDoBanco(error.code, error.message, 'Não consegui apagar o bolão. Se ele tem cotas, remova as cotas antes.') : null
}

// ---------- Bolão aberto: inscrições sem número de cotas; N só existe quando o ADM fecha ----------

export interface DadosBolaoAberto {
  concurso: number
  nome: string
  /** valor da cota, em centavos */
  cotaCent: number
  /** até quando aceitar cotas novas (ISO com fuso) */
  inscricoesAte: string
}

export async function criarBolaoAberto(d: DadosBolaoAberto): Promise<{ id: string | null; erro: string | null }> {
  const { data, error } = await supabase
    .from('bolaos')
    .insert({
      concurso_alvo: d.concurso,
      nome: d.nome,
      n_cotas: null,
      cota_base_cent: d.cotaCent,
      modo_cobranca: 'cota_fixa',
      status: 'aberto',
      inscricoes_ate: d.inscricoesAte,
    })
    .select('id')
    .single()
  if (error || !data) return { id: null, erro: erroDoBanco(error?.code, error?.message ?? '', 'Não consegui criar o bolão agora.') }
  return { id: (data as { id: string }).id, erro: null }
}

export async function prorrogarInscricoes(id: string, inscricoesAteIso: string): Promise<string | null> {
  const { error } = await supabase.from('bolaos').update({ inscricoes_ate: inscricoesAteIso }).eq('id', id).eq('status', 'aberto')
  return error ? erroDoBanco(error.code, error.message, 'Não consegui mudar a data agora.') : null
}

function mensagemRegra(codigo: string | undefined, texto: string, padrao: string): string {
  if (codigo === 'P0001' || codigo === 'P0002') return texto.replace(/^.*?ERROR:\s*/, '')
  return erroDoBanco(codigo, texto, padrao)
}

/** Fecha as inscrições: N passa a ser o total de cotas cadastradas e o bolão segue para a geração dos jogos. */
export async function fecharInscricoes(id: string, descartarPendentes: boolean): Promise<{ n: number | null; erro: string | null }> {
  const { data, error } = await supabase.rpc('fechar_inscricoes', { p_bolao: id, p_descartar: descartarPendentes })
  if (error) return { n: null, erro: mensagemRegra(error.code, error.message, 'Não consegui fechar as inscrições agora.') }
  return { n: (data as { n_cotas: number }).n_cotas, erro: null }
}

export async function reabrirInscricoes(id: string): Promise<string | null> {
  const { error } = await supabase.rpc('reabrir_inscricoes', { p_bolao: id })
  return error ? mensagemRegra(error.code, error.message, 'Não consegui reabrir as inscrições agora.') : null
}

/**
 * Bolão que já fechou as inscrições: grava os recibos e os jogos NELE (não cria outro bolão).
 * Se já havia jogos salvos (rascunho anterior), eles são substituídos.
 */
export async function anexarJogosAoBolao(bolaoId: string, d: DadosRascunho): Promise<string | null> {
  const atual = await carregarBolao(bolaoId)
  if (!atual.bolao) return atual.erro ?? 'Bolão não encontrado.'
  if (atual.bolao.status !== 'rascunho') return 'Só dá para salvar jogos num bolão que fechou as inscrições e ainda não foi congelado.'
  if (atual.bolao.n_cotas !== d.plano.n) return `Este bolão tem ${atual.bolao.n_cotas} cotas, mas o plano é de ${d.plano.n}. Volte ao bolão e simule de novo.`
  const { data: versao } = await supabase.from('rules_versions').select('id').eq('vigencia_inicio', d.vigencia).maybeSingle()
  const up = await supabase
    .from('bolaos')
    .update({
      regras_versao_id: (versao as { id: number } | null)?.id ?? null,
      regras_snapshot: { vigencia_inicio: d.vigencia, params: d.params, plano: d.plano, premissas: d.premissas },
      semente: d.semente,
      cota_base_cent: d.plano.cotaBaseCent,
      modo_cobranca: d.plano.cobranca,
    })
    .eq('id', bolaoId)
  if (up.error) return erroDoBanco(up.error.code, up.error.message, 'Não consegui atualizar o bolão agora.')
  const del = await supabase.from('recibos').delete().eq('bolao_id', bolaoId)
  if (del.error) return 'Não consegui trocar os jogos antigos agora.'
  return gravarRecibosEJogos(bolaoId, d)
}

/** Mensagem do servidor (já em português) quando é regra de negócio; senão, uma mensagem genérica. */
function mensagemCongelar(codigo: string | undefined, texto: string): string {
  if (codigo === '23505' || codigo === 'P0001' || codigo === '22023' || codigo === 'P0002') return texto.replace(/^.*?ERROR:\s*/, '')
  return erroDoBanco(codigo, texto, 'Não consegui congelar agora.')
}

/**
 * Congela: calcula o hash dos jogos e as combinações de 6 dezenas cobertas e pede ao servidor, que confere tudo
 * (repetição, conflito com outros bolões) e grava numa transação só.
 */
export async function congelarBolao(id: string): Promise<{ ok: boolean; erro: string | null; combinacoes?: number; hash?: string }> {
  const det = await carregarBolao(id)
  if (!det.bolao) return { ok: false, erro: det.erro }
  const jogos = det.recibos.flatMap((r) => r.jogos.map((j) => j.dezenas))
  if (jogos.length === 0) return { ok: false, erro: 'O bolão não tem jogos.' }
  const hash = await hashJogos(jogos)
  const ranks: number[] = []
  for (const j of jogos) paraCadaRank(j, (rank) => void ranks.push(rank))
  const { data, error } = await supabase.rpc('congelar_bolao', { p_bolao: id, p_hash: hash, p_ranks: ranks })
  if (error) return { ok: false, erro: mensagemCongelar(error.code, error.message) }
  return { ok: true, erro: null, combinacoes: (data as { combinacoes: number }).combinacoes, hash }
}

// ---------- Link público do bolão (primeiros nomes e cotas; o segredo fica em bolao_links) ----------
export interface LinkDoBolao {
  token: string
  ativo: boolean
  /** as pessoas podem se inscrever sozinhas pelo link */
  autoinscricao: boolean
  /** máximo de cotas que uma pessoa pode pedir pelo link */
  max_cotas_pessoa: number
  /** aparece na lista de bolões das contas de apostador (sem precisar do link) */
  listado: boolean
}

export function enderecoDoLinkDoBolao(token: string): string {
  return `${window.location.origin}/#/b/${token}`
}

export async function carregarLinkDoBolao(bolaoId: string): Promise<{ link: LinkDoBolao | null; erro: string | null }> {
  const { data, error } = await supabase.from('bolao_links').select('token, ativo, autoinscricao, max_cotas_pessoa, listado').eq('bolao_id', bolaoId).maybeSingle()
  if (error) return { link: null, erro: 'Não consegui ler o link do bolão.' }
  return { link: (data as LinkDoBolao | null) ?? null, erro: null }
}

/** Liga o link (cria o segredo se ainda não há). `renovar` troca por outro: o antigo para de funcionar. */
export async function ligarLinkDoBolao(bolaoId: string, atual: LinkDoBolao | null, renovar: boolean): Promise<{ link: LinkDoBolao | null; erro: string | null }> {
  const token = !renovar && atual ? atual.token : gerarTokenDoLink()
  const { error } = await supabase.from('bolao_links').upsert({ bolao_id: bolaoId, token, ativo: true, atualizado_em: new Date().toISOString() })
  return error
    ? { link: null, erro: 'Não consegui ligar o link agora.' }
    : { link: { token, ativo: true, autoinscricao: atual?.autoinscricao ?? false, max_cotas_pessoa: atual?.max_cotas_pessoa ?? 10, listado: atual?.listado ?? false }, erro: null }
}

/** Mostra (ou esconde) o bolão na lista das contas de apostador. */
export async function definirListado(bolaoId: string, listado: boolean): Promise<string | null> {
  const { error } = await supabase.from('bolao_links').update({ listado, atualizado_em: new Date().toISOString() }).eq('bolao_id', bolaoId)
  return error ? 'Não consegui salvar agora.' : null
}

/** Liga ou desliga a inscrição pelo link e define o máximo de cotas por pessoa. */
export async function definirAutoinscricao(bolaoId: string, ligada: boolean, maxCotasPessoa: number): Promise<string | null> {
  if (!Number.isInteger(maxCotasPessoa) || maxCotasPessoa < 1 || maxCotasPessoa > 100) return 'O máximo por pessoa deve ser um número de 1 a 100.'
  const { error } = await supabase.from('bolao_links').update({ autoinscricao: ligada, max_cotas_pessoa: maxCotasPessoa, atualizado_em: new Date().toISOString() }).eq('bolao_id', bolaoId)
  return error ? 'Não consegui salvar agora.' : null
}

export async function desligarLinkDoBolao(bolaoId: string): Promise<string | null> {
  const { error } = await supabase.from('bolao_links').update({ ativo: false, atualizado_em: new Date().toISOString() }).eq('bolao_id', bolaoId)
  return error ? 'Não consegui desligar o link agora.' : null
}

export interface BolaoCongelado {
  id: string
  nome: string
  jogos: number[][]
}

/** Jogos de todos os bolões congelados de um concurso, para o relatório de auditoria. */
export async function carregarBoloesCongelados(concurso: number): Promise<{ boloes: BolaoCongelado[]; erro: string | null }> {
  const { data, error } = await supabase.from('bolaos').select('id, nome, recibos(jogos(dezenas))').eq('concurso_alvo', concurso).eq('status', 'congelado')
  if (error) return { boloes: [], erro: 'Não consegui ler os bolões congelados.' }
  const boloes = ((data ?? []) as unknown as { id: string; nome: string; recibos: { jogos: { dezenas: number[] }[] }[] }[]).map((b) => ({
    id: b.id,
    nome: b.nome,
    jogos: b.recibos.flatMap((r) => r.jogos.map((j) => [...j.dezenas])),
  }))
  return { boloes, erro: null }
}
