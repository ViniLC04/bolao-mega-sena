import { useRef, useState } from 'react'
import { enviarFoto, linkDaFoto, removerFoto } from '../data/fotos'

/** Foto do recibo da Caixa: anexar, trocar, ver e remover. Só o ADM vê (armazenamento privado). */
export function FotoRecibo({ bolaoId, ordem, caminho, aoMudar }: { bolaoId: string; ordem: number; caminho: string | null; aoMudar: () => void }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function aoEscolher(arquivo: File | undefined) {
    if (!arquivo) return
    setErro(null)
    setOcupado(true)
    const e = await enviarFoto(bolaoId, ordem, arquivo, caminho)
    setOcupado(false)
    if (entrada.current) entrada.current.value = ''
    if (e) setErro(e)
    else {
      setUrl(null)
      aoMudar()
    }
  }

  async function ver() {
    if (!caminho) return
    if (url) return setUrl(null)
    setErro(null)
    const r = await linkDaFoto(caminho)
    if (r.erro) setErro(r.erro)
    else setUrl(r.url)
  }

  async function remover() {
    if (!caminho || !window.confirm('Remover a foto deste recibo?')) return
    setOcupado(true)
    const e = await removerFoto(bolaoId, ordem, caminho)
    setOcupado(false)
    if (e) setErro(e)
    else {
      setUrl(null)
      aoMudar()
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void aoEscolher(e.target.files?.[0])} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="muted pequeno">{caminho ? 'Foto do recibo anexada ✓' : 'Sem foto do recibo'}</span>
        <button type="button" className="secundario pequeno" disabled={ocupado} onClick={() => entrada.current?.click()}>
          {ocupado ? 'Enviando…' : caminho ? 'Trocar foto' : 'Anexar foto'}
        </button>
        {caminho && (
          <>
            <button type="button" className="secundario pequeno" disabled={ocupado} onClick={() => void ver()}>
              {url ? 'Esconder' : 'Ver foto'}
            </button>
            <button type="button" className="secundario pequeno" disabled={ocupado} onClick={() => void remover()}>
              Remover
            </button>
          </>
        )}
      </div>
      {erro && <p className="erro">{erro}</p>}
      {url && <img src={url} alt={`Foto do recibo ${ordem + 1}`} style={{ maxWidth: '100%', width: 320, marginTop: 8, borderRadius: 8, border: '1px solid var(--borda)' }} />}
    </div>
  )
}
