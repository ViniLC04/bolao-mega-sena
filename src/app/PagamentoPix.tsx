import { useEffect, useRef, useState } from 'react'
import { aumentarMinhasCotas, carregarRecebimentoPublico, COMPROVANTE_MAX_BYTES, enviarComprovante, type MinhaParticipacaoLinha, type PixDoOrganizador } from '../data/publico'
import { gerarPayloadPix, linkWhatsapp, NOMES_TIPO_CHAVE, type TipoChavePix } from '../engine/pix'
import { formatarReais } from './formato'
import { QrCode } from './QrCode'

/** Pagamento por PIX no link pessoal: QR code, copia e cola, comprovante e aumento de cotas (nunca diminuir). */
export function PagamentoPix({ l, token, aoMudar }: { l: MinhaParticipacaoLinha; token: string; aoMudar: () => void }) {
  const [pix, setPix] = useState<PixDoOrganizador | null | undefined>(undefined)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [novaQtd, setNovaQtd] = useState(0)
  const arquivo = useRef<HTMLInputElement>(null)

  const cota = l.cota_cent ?? 0
  const pendenteCotas = l.qtd - l.qtd_paga
  const pendenteCent = pendenteCotas * cota
  const quitado = pendenteCotas <= 0

  useEffect(() => {
    let vivo = true
    void carregarRecebimentoPublico(token).then((r) => {
      if (vivo) setPix(r)
    })
    return () => {
      vivo = false
    }
  }, [token, l.qtd, l.qtd_paga])

  const pixVisivel = quitado ? null : pix
  const novaQtdValida = Math.max(novaQtd, l.qtd + 1)

  let payload: string | null = null
  if (pixVisivel && pendenteCent > 0) {
    try {
      payload = gerarPayloadPix({ chave: pixVisivel.chave, nome: pixVisivel.nome, cidade: pixVisivel.cidade, valorCent: pendenteCent })
    } catch {
      payload = null
    }
  }

  async function copiar() {
    if (!payload) return
    try {
      await navigator.clipboard.writeText(payload)
      setMsg('PIX copiado. Abra o app do seu banco e use “PIX copia e cola”.')
    } catch {
      setMsg('Não consegui copiar sozinho: selecione o texto e copie.')
    }
  }

  async function enviar(f: File | undefined) {
    if (!f) return
    setOcupado(true)
    setErro(null)
    setMsg(null)
    const e = await enviarComprovante(token, l.bolao_id, f)
    setOcupado(false)
    if (arquivo.current) arquivo.current.value = ''
    if (e) setErro(e)
    else setMsg('Comprovante enviado. O organizador vai conferir e confirmar o seu pagamento.')
  }

  async function aumentar() {
    setOcupado(true)
    setErro(null)
    setMsg(null)
    const e = await aumentarMinhasCotas(token, l.bolao_id, novaQtdValida)
    setOcupado(false)
    if (e) return setErro(e)
    setMsg(`Pronto: agora são ${novaQtdValida} cotas. Pague a diferença pelo PIX abaixo.`)
    aoMudar()
  }

  const mensagemZap = `Oi! Sou ${l.participante}, do bolão "${l.bolao_nome}". Paguei ${formatarReais(pendenteCent)} (${pendenteCotas} cota${pendenteCotas === 1 ? '' : 's'}) por PIX. Segue o comprovante.`
  const zap = pixVisivel ? linkWhatsapp(pixVisivel.whatsapp, mensagemZap) : null
  const opcoes = Array.from({ length: Math.max(0, l.max_cotas_pessoa - l.qtd) }, (_, i) => l.qtd + 1 + i)

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--borda)' }}>
      {quitado ? (
        <p className="ok">Pagamento confirmado ✓ ({l.qtd} cota{l.qtd === 1 ? '' : 's'}).</p>
      ) : (
        <>
          <h3 style={{ margin: '0 0 4px' }}>Pagar por PIX</h3>
          <p>
            Pagas {l.qtd_paga} de {l.qtd} cotas. Falta pagar <strong>{formatarReais(pendenteCent)}</strong>.
          </p>
          {pixVisivel === undefined && <p className="muted">Carregando o PIX…</p>}
          {pixVisivel === null && <p className="aviso">O organizador ainda não cadastrou o PIX. Fale com ele para pagar.</p>}
          {pixVisivel && payload && (
            <>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <QrCode texto={payload} tamanho={200} rotulo={`QR code do PIX de ${formatarReais(pendenteCent)}`} />
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <p className="pequeno">
                    Recebedor: <strong>{pixVisivel.nome}</strong>
                    <br />
                    {NOMES_TIPO_CHAVE[pixVisivel.tipo as TipoChavePix] ?? 'Chave'}: <strong>{pixVisivel.chave}</strong>
                  </p>
                  <p className="pequeno muted">Aponte a câmera do app do banco para o QR code, ou copie o PIX abaixo. O valor já vai preenchido. Confira o nome do recebedor antes de pagar.</p>
                  <textarea readOnly value={payload} rows={4} onFocus={(e) => e.currentTarget.select()} aria-label="PIX copia e cola" style={{ width: '100%', fontSize: '0.8rem' }} />
                  <button type="button" className="primario" onClick={() => void copiar()}>
                    Copiar PIX
                  </button>
                </div>
              </div>

              <h3 style={{ margin: '14px 0 4px' }}>Depois de pagar</h3>
              <p className="muted pequeno">Mande o comprovante para o organizador conferir (foto ou PDF, até {COMPROVANTE_MAX_BYTES / 1024 / 1024} MB).</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={ocupado} onChange={(e) => void enviar(e.target.files?.[0])} aria-label="Anexar comprovante" />
                {zap && (
                  <a className="secundario botao" href={zap} target="_blank" rel="noopener noreferrer">
                    Enviar pelo WhatsApp
                  </a>
                )}
              </div>
            </>
          )}
          {pixVisivel && !payload && <p className="aviso">Não consegui montar o PIX. Fale com o organizador.</p>}
        </>
      )}

      {l.aumentar_liberado && opcoes.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h3 style={{ margin: '0 0 4px' }}>Aumentar minhas cotas</h3>
          <p className="muted pequeno">Dá para pedir mais cotas, mas não para diminuir. Para diminuir, fale com o organizador.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={novaQtdValida} onChange={(e) => setNovaQtd(Number(e.target.value))} aria-label="Nova quantidade de cotas">
              {opcoes.map((n) => (
                <option key={n} value={n}>
                  {n} cotas ({formatarReais(n * cota)})
                </option>
              ))}
            </select>
            <button type="button" className="secundario" disabled={ocupado} onClick={() => void aumentar()}>
              Aumentar
            </button>
          </div>
        </div>
      )}
      {erro && <p className="erro">{erro}</p>}
      {msg && <p className="ok">{msg}</p>}
    </div>
  )
}
