import { useEffect, useState } from 'react'
import { carregarRecebimento, salvarRecebimento, type Recebimento } from '../data/recebimento'
import { gerarPayloadPix, NOMES_TIPO_CHAVE, type TipoChavePix } from '../engine/pix'
import { QrCode } from './QrCode'

const TIPOS = Object.keys(NOMES_TIPO_CHAVE) as TipoChavePix[]

/** Quadro da tela Conta: a chave PIX do organizador, que as pessoas veem depois de se inscreverem. */
export function RecebimentoPix() {
  const [tipo, setTipo] = useState<TipoChavePix>('email')
  const [chave, setChave] = useState('')
  const [nome, setNome] = useState('')
  const [cidade, setCidade] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [salvo, setSalvo] = useState<Recebimento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erros, setErros] = useState<string[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    void carregarRecebimento().then((r) => {
      if (!vivo) return
      if (r.recebimento) {
        setSalvo(r.recebimento)
        setTipo(r.recebimento.tipo)
        setChave(r.recebimento.chave)
        setNome(r.recebimento.nome)
        setCidade(r.recebimento.cidade)
        setWhatsapp(r.recebimento.whatsapp)
      }
      if (r.erro) setErros([r.erro])
      setCarregando(false)
    })
    return () => {
      vivo = false
    }
  }, [])

  async function gravar() {
    setOcupado(true)
    setErros([])
    setMsg(null)
    const r = await salvarRecebimento({ tipo, chave, nome, cidade, whatsapp })
    setOcupado(false)
    if (r.salvo) {
      setSalvo(r.salvo)
      setChave(r.salvo.chave)
      setNome(r.salvo.nome)
      setCidade(r.salvo.cidade)
      setMsg('Recebimento gravado. Confira o QR de exemplo abaixo com o app do seu banco (leia sem pagar).')
    } else setErros(r.erros)
  }

  let exemplo: string | null = null
  if (salvo) {
    try {
      exemplo = gerarPayloadPix({ chave: salvo.chave, nome: salvo.nome, cidade: salvo.cidade, valorCent: 100 })
    } catch {
      exemplo = null
    }
  }

  return (
    <section className="card" style={{ marginBottom: 14 }}>
      <h2>Recebimento por PIX</h2>
      <p className="muted">
        É a chave que cada pessoa vê <strong>depois de se inscrever pelo link do bolão</strong>, junto com o valor certo. O app só mostra o PIX: você confere no seu banco que o dinheiro caiu e confirma o pagamento no bolão.
      </p>
      {carregando && <p className="muted">Carregando…</p>}
      <div className="campos">
        <label className="campo">
          <span>Tipo da chave</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoChavePix)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {NOMES_TIPO_CHAVE[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Chave PIX</span>
          <input value={chave} onChange={(e) => setChave(e.target.value)} autoComplete="off" />
        </label>
        <label className="campo">
          <span>Nome de quem recebe</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={25} />
          <small className="muted">Como aparece no banco (até 25 letras, sem acento).</small>
        </label>
        <label className="campo">
          <span>Cidade</span>
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} maxLength={15} />
        </label>
        <label className="campo">
          <span>Seu WhatsApp (para o comprovante)</span>
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="(11) 99999-8888" />
        </label>
      </div>
      {erros.length > 0 && (
        <ul className="erro">
          {erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {msg && <p className="ok">{msg}</p>}
      <button type="button" className="primario" disabled={ocupado} onClick={() => void gravar()}>
        {ocupado ? 'Gravando…' : 'Gravar recebimento'}
      </button>

      {exemplo && (
        <div style={{ marginTop: 14 }}>
          <p className="muted pequeno">
            <strong>Teste antes de divulgar:</strong> abra o app do seu banco, escolha pagar com QR code e leia este quadrado. Deve aparecer o seu nome e o valor de R$ 1,00. <strong>Não precisa pagar.</strong>
          </p>
          <QrCode texto={exemplo} tamanho={200} rotulo="QR code de exemplo do PIX, valor R$ 1,00" />
          <p className="pequeno" style={{ wordBreak: 'break-all' }}>
            <code>{exemplo}</code>
          </p>
        </div>
      )}
    </section>
  )
}
