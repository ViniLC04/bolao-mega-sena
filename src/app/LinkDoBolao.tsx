import { useEffect, useState } from 'react'
import { carregarLinkDoBolao, definirAutoinscricao, definirListado, desligarLinkDoBolao, enderecoDoLinkDoBolao, ligarLinkDoBolao, type LinkDoBolao as Link } from '../data/boloes'
import { carregarRecebimento } from '../data/recebimento'

/** Cartão do bolão (ADM): liga, copia, renova e desliga o link público do bolão (primeiros nomes e cotas). */
export function LinkDoBolao({ bolaoId, aberto }: { bolaoId: string; aberto: boolean }) {
  const [pixOk, setPixOk] = useState(true)
  const [link, setLink] = useState<Link | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    void Promise.all([carregarLinkDoBolao(bolaoId), carregarRecebimento()]).then(([r, pix]) => {
      if (!vivo) return
      setLink(r.link)
      setErro(r.erro)
      setPixOk(pix.recebimento !== null)
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

  async function salvarAuto(ligada: boolean, max: number) {
    setOcupado(true)
    setErro(null)
    setMsg(null)
    const e = await definirAutoinscricao(bolaoId, ligada, max)
    setOcupado(false)
    if (e) return setErro(e)
    setLink((l) => (l ? { ...l, autoinscricao: ligada, max_cotas_pessoa: max } : l))
    setMsg(ligada ? 'Inscrição pelo link ligada.' : 'Inscrição pelo link desligada.')
  }

  async function salvarListado(v: boolean) {
    setOcupado(true)
    setErro(null)
    setMsg(null)
    const e = await definirListado(bolaoId, v)
    setOcupado(false)
    if (e) return setErro(e)
    setLink((l) => (l ? { ...l, listado: v } : l))
    setMsg(v ? 'Bolão listado para os apostadores cadastrados.' : 'Bolão escondido da lista.')
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

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--borda)' }}>
            <h3 style={{ margin: '0 0 4px' }}>Lista para apostadores cadastrados</h3>
            <p className="muted pequeno">
              Ligado, qualquer pessoa com conta em “Sou apostador” vê este bolão em <strong>Minha área</strong> e abre sem precisar do link (vê o mesmo que o link mostra: primeiro nome e cotas). Só aparece enquanto o bolão está aberto e o link ligado.
            </p>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
              <input type="checkbox" checked={link.listado} disabled={ocupado} onChange={(e) => void salvarListado(e.target.checked)} style={{ width: 20, minHeight: 20 }} />
              Listar para apostadores cadastrados
            </label>
          </div>

          {aberto && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--borda)' }}>
              <h3 style={{ margin: '0 0 4px' }}>Inscrição pelo link</h3>
              <p className="muted pequeno">
                Ligada, quem abre o link pode se cadastrar (nome e WhatsApp), escolher as cotas, ver o seu PIX e enviar o comprovante. A inscrição só vira cota depois que <strong>você confirma o pagamento</strong> em “Cotas e pagamentos”.
              </p>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
                <input type="checkbox" checked={link.autoinscricao} disabled={ocupado} onChange={(e) => void salvarAuto(e.target.checked, link.max_cotas_pessoa)} style={{ width: 20, minHeight: 20 }} />
                Aceitar inscrições pelo link
              </label>
              <label className="campo" style={{ maxWidth: 260 }}>
                <span>Máximo de cotas por pessoa</span>
                <input
                  inputMode="numeric"
                  defaultValue={link.max_cotas_pessoa}
                  onBlur={(e) => {
                    const n = Number(e.target.value)
                    if (n !== link.max_cotas_pessoa) void salvarAuto(link.autoinscricao, n)
                  }}
                />
              </label>
              {link.autoinscricao && !pixOk && <p className="aviso">Cadastre o seu PIX em <strong>Conta → Recebimento por PIX</strong>, senão as pessoas não verão como pagar.</p>}
            </div>
          )}
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
