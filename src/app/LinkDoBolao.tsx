import { useEffect, useState } from 'react'
import { carregarLinkDoBolao, desligarLinkDoBolao, enderecoDoLinkDoBolao, ligarLinkDoBolao, type LinkDoBolao as Link } from '../data/boloes'

/** Cartão do bolão (ADM): liga, copia, renova e desliga o link público do bolão (primeiros nomes e cotas). */
export function LinkDoBolao({ bolaoId }: { bolaoId: string }) {
  const [link, setLink] = useState<Link | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    void carregarLinkDoBolao(bolaoId).then((r) => {
      if (!vivo) return
      setLink(r.link)
      setErro(r.erro)
      setCarregando(false)
    })
    return () => {
      vivo = false
    }
  }, [bolaoId])

  async function copiar(token: string) {
    const url = enderecoDoLinkDoBolao(token)
    try {
      await navigator.clipboard.writeText(url)
      setMsg('Link copiado. Cole no grupo do bolão.')
    } catch {
      setMsg('Não consegui copiar sozinho: selecione o endereço acima e copie.')
    }
  }

  async function ligar(renovar: boolean) {
    if (renovar && !window.confirm('Gerar um link novo? O link antigo deixa de funcionar para todo mundo.')) return
    setOcupado(true)
    setErro(null)
    setMsg(null)
    const r = await ligarLinkDoBolao(bolaoId, link, renovar)
    setOcupado(false)
    if (r.erro || !r.link) return setErro(r.erro)
    setLink(r.link)
    await copiar(r.link.token)
  }

  async function desligar() {
    setOcupado(true)
    setErro(null)
    setMsg(null)
    const e = await desligarLinkDoBolao(bolaoId)
    setOcupado(false)
    if (e) setErro(e)
    else setLink((l) => (l ? { ...l, ativo: false } : l))
  }

  return (
    <section className="card" style={{ marginTop: 12 }}>
      <h2>Link público do bolão</h2>
      <p className="muted pequeno">
        Quem tiver este link vê o bolão: <strong>só o primeiro nome</strong> de cada participante e as cotas dele, o total arrecadado e os jogos (depois de congelado). Não mostra sobrenome, contato nem quem pagou. Mande só para quem participa; se vazar, gere um novo.
      </p>
      {carregando && <p className="muted">Carregando…</p>}
      {erro && <p className="erro">{erro}</p>}
      {msg && <p className="ok">{msg}</p>}
      {!carregando && link?.ativo && (
        <>
          <p className="ok">Link ligado</p>
          <input readOnly value={enderecoDoLinkDoBolao(link.token)} onFocus={(e) => e.currentTarget.select()} aria-label="Endereço do link do bolão" />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <button type="button" className="primario" disabled={ocupado} onClick={() => void copiar(link.token)}>
              Copiar link
            </button>
            <button type="button" className="secundario" disabled={ocupado} onClick={() => void ligar(true)}>
              Gerar link novo
            </button>
            <button type="button" className="secundario" disabled={ocupado} onClick={() => void desligar()}>
              Desligar
            </button>
          </div>
        </>
      )}
      {!carregando && !link?.ativo && (
        <button type="button" className="primario" disabled={ocupado} onClick={() => void ligar(false)}>
          {link ? 'Ligar o link de novo' : 'Gerar link público'}
        </button>
      )}
    </section>
  )
}
