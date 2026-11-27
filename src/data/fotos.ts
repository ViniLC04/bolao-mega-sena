// Foto do recibo da Caixa: fica num armazenamento PRIVADO do Supabase (bucket "recibos"); só o ADM vê, envia e apaga.
// A imagem é reduzida no navegador (até 1600 px, JPEG) para caber no plano gratuito.
import { supabase } from './supabase'

const BUCKET = 'recibos'
const LADO_MAX = 1600
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']

/** Reduz a foto: lado maior até 1600 px, JPEG com qualidade 0,8. */
export async function reduzirImagem(arquivo: File): Promise<Blob> {
  if (!TIPOS.includes(arquivo.type)) throw new Error('Use uma foto JPEG, PNG ou WebP.')
  const bmp = await createImageBitmap(arquivo)
  const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * escala))
  const h = Math.max(1, Math.round(bmp.height * escala))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não consegui preparar a foto neste navegador.')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.8))
  if (!blob) throw new Error('Não consegui preparar a foto.')
  return blob
}

function traduzir(texto: string): string {
  if (/row-level security|not authorized|unauthorized|403|401/i.test(texto)) return 'Só o ADM pode mexer nas fotos (entre com o código dos 2 passos).'
  if (/bucket not found|not found/i.test(texto)) return 'O armazenamento das fotos não existe ainda: rode o SQL da Fase 5 no Supabase.'
  if (/too large|payload|size/i.test(texto)) return 'A foto ficou grande demais (limite de 5 MB).'
  return 'Não consegui salvar a foto agora. Tente de novo.'
}

/** Envia (ou troca) a foto do recibo `ordem` do bolão. Devolve a mensagem de erro, ou null se deu certo. */
export async function enviarFoto(bolaoId: string, ordem: number, arquivo: File, caminhoAntigo: string | null): Promise<string | null> {
  let blob: Blob
  try {
    blob = await reduzirImagem(arquivo)
  } catch (e) {
    return e instanceof Error ? e.message : 'Não consegui ler a foto.'
  }
  const caminho = `${bolaoId}/recibo-${ordem}-${Date.now()}.jpg`
  const up = await supabase.storage.from(BUCKET).upload(caminho, blob, { contentType: 'image/jpeg', upsert: false })
  if (up.error) return traduzir(up.error.message)
  const { error } = await supabase.from('recibos').update({ foto_path: caminho }).eq('bolao_id', bolaoId).eq('ordem', ordem)
  if (error) {
    await supabase.storage.from(BUCKET).remove([caminho])
    return 'Não consegui ligar a foto ao recibo. Tente de novo.'
  }
  if (caminhoAntigo) await supabase.storage.from(BUCKET).remove([caminhoAntigo])
  return null
}

export async function removerFoto(bolaoId: string, ordem: number, caminho: string): Promise<string | null> {
  const { error } = await supabase.from('recibos').update({ foto_path: null }).eq('bolao_id', bolaoId).eq('ordem', ordem)
  if (error) return 'Não consegui remover a foto agora.'
  await supabase.storage.from(BUCKET).remove([caminho])
  return null
}

/** Link temporário (60 segundos) para ver a foto. */
export async function linkDaFoto(caminho: string): Promise<{ url: string | null; erro: string | null }> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 60)
  if (error || !data) return { url: null, erro: traduzir(error?.message ?? '') }
  return { url: data.signedUrl, erro: null }
}
