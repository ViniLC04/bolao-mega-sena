import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  cancelarAtivacao,
  confirmarAtivacao,
  desativarDoisPassos,
  fatoresConfirmados,
  iniciarAtivacao,
  type FatorDoisPassos,
  type InicioAtivacao,
} from '../data/auth'

/** Cartão da tela Conta: ativar ou desativar a verificação em 2 passos (código de 6 dígitos no celular). */
export function DoisPassos() {
  const [fatores, setFatores] = useState<FatorDoisPassos[] | null>(null)
  const [inicio, setInicio] = useState<InicioAtivacao | null>(null)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const recarregar = useCallback(async () => setFatores(await fatoresConfirmados()), [])

  useEffect(() => {
    let vivo = true
    void fatoresConfirmados().then((f) => {
      if (vivo) setFatores(f)
    })
    return () => {
      vivo = false
    }
  }, [])

  async function comecar() {
    setErro(null)
    setMsg(null)
    setOcupado(true)
    const r = await iniciarAtivacao()
    setOcupado(false)
    if (r.ok) {
      setInicio(r.inicio)
      setCodigo('')
    } else setErro(r.erro)
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault()
    if (!inicio) return
    setErro(null)
    setOcupado(true)
    const r = await confirmarAtivacao(inicio.fatorId, codigo)
    setOcupado(false)
    if (r.ok) {
      setInicio(null)
      setMsg('Verificação em 2 passos ativada. Da próxima vez que entrar, o app vai pedir o código.')
      await recarregar()
    } else setErro(r.erro)
  }

  async function desistir() {
    if (inicio) await cancelarAtivacao(inicio.fatorId)
    setInicio(null)
    setErro(null)
  }

  async function desativar(f: FatorDoisPassos) {
    if (!window.confirm('Desativar a verificação em 2 passos? O login volta a pedir só a senha, o que é menos seguro.')) return
    setErro(null)
    setOcupado(true)
    const r = await desativarDoisPassos(f.id)
    setOcupado(false)
    if (r.ok) {
      setMsg('Verificação em 2 passos desativada.')
      await recarregar()
    } else setErro(r.erro)
  }

  const ativa = fatores !== null && fatores.length > 0

  return (
    <section className="card" style={{ marginBottom: 14 }}>
      <h2>Verificação em 2 passos</h2>
      <p className="muted">
        Além da senha, o app pede um código de 6 números que muda a cada 30 segundos, gerado por um aplicativo no seu celular (Google Authenticator, Microsoft Authenticator ou parecido). Mesmo que alguém descubra a sua senha, sem o celular não consegue abrir nada.
      </p>
      {fatores === null && <p className="muted">Carregando…</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      {msg && <p className="ok">{msg}</p>}

      {ativa && !inicio && (
        <>
          <p className="ok">Ativada ✓</p>
          {fatores.map((f) => (
            <p key={f.id}>
              <button type="button" className="secundario" disabled={ocupado} onClick={() => void desativar(f)}>
                Desativar
              </button>
            </p>
          ))}
          <p className="muted pequeno">Perdeu o celular? Veja “Se você perder o celular” em docs/seguranca.md (ou no manual, tela <Link to="/ajuda">Ajuda</Link>).</p>
        </>
      )}

      {fatores !== null && !ativa && !inicio && (
        <>
          <p className="aviso">Ainda não está ativada. Recomendo ativar antes de abrir o bolão para os participantes.</p>
          <button type="button" className="primario" disabled={ocupado} onClick={() => void comecar()}>
            Ativar verificação em 2 passos
          </button>
        </>
      )}

      {inicio && (
        <form onSubmit={confirmar}>
          <ol>
            <li>No celular, abra o aplicativo autenticador e escolha <strong>adicionar conta</strong> (o sinal de +).</li>
            <li>Aponte a câmera para o quadrado abaixo:</li>
          </ol>
          <p>
            <img src={inicio.qr} alt="QR code para o aplicativo autenticador" width={200} height={200} style={{ background: '#fff', padding: 8, borderRadius: 8 }} />
          </p>
          <p className="muted pequeno">
            Não consegue ler o quadrado? No aplicativo, escolha “digitar uma chave” e use esta: <code style={{ wordBreak: 'break-all' }}>{inicio.chave}</code>
          </p>
          <ol start={3}>
            <li>Digite aqui o código de 6 números que o aplicativo mostrar:</li>
          </ol>
          <label className="campo">
            <span>Código</span>
            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" className="primario" disabled={ocupado}>
              {ocupado ? 'Conferindo…' : 'Confirmar e ativar'}
            </button>
            <button type="button" className="secundario" disabled={ocupado} onClick={() => void desistir()}>
              Desistir
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

/** Aviso no Painel enquanto a verificação em 2 passos não estiver ativa. */
export function AvisoDoisPassos() {
  const [fatores, setFatores] = useState<FatorDoisPassos[] | null>(null)
  useEffect(() => {
    let vivo = true
    void fatoresConfirmados().then((f) => {
      if (vivo) setFatores(f)
    })
    return () => {
      vivo = false
    }
  }, [])
  if (fatores === null || fatores.length > 0) return null
  return (
    <p className="aviso">
      A verificação em 2 passos ainda não está ativa. <Link to="/conta">Ative em Minha conta</Link> antes de abrir o bolão.
    </p>
  )
}
