import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { esperaAposFalhas } from '../bloqueio'
import { Simbolo } from '../simbolos'

const CHAVE_FALHAS = 'bolao.loginFalhas'

function lerFalhas(): number {
  try {
    return Number(sessionStorage.getItem(CHAVE_FALHAS)) || 0
  } catch {
    return 0
  }
}
function gravarFalhas(n: number): void {
  try {
    sessionStorage.setItem(CHAVE_FALHAS, String(n))
  } catch {
    /* sem armazenamento: a espera vale só até recarregar a página */
  }
}

export function Login() {
  const { adm, carregando, entrar, pendenteCodigo, enviarCodigo, sair } = useAuth()
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [falhas, setFalhas] = useState(lerFalhas)
  const [espera, setEspera] = useState(() => esperaAposFalhas(lerFalhas()))

  useEffect(() => {
    if (espera <= 0) return
    const t = setInterval(() => setEspera((e) => Math.max(0, e - 1)), 1000)
    return () => clearInterval(t)
  }, [espera > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!carregando && adm) return <Navigate to="/painel" replace />

  async function enviarOCodigo(e: FormEvent) {
    e.preventDefault()
    if (espera > 0 || enviando) return
    setEnviando(true)
    setErro(null)
    const mensagem = await enviarCodigo(codigo)
    setEnviando(false)
    if (mensagem) {
      const n = falhas + 1
      setFalhas(n)
      gravarFalhas(n)
      setEspera(esperaAposFalhas(n))
      setErro(mensagem)
      setCodigo('')
    } else gravarFalhas(0)
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (espera > 0 || enviando) return
    setEnviando(true)
    setErro(null)
    const mensagem = await entrar(usuario, senha)
    setEnviando(false)
    if (mensagem) {
      const n = falhas + 1
      setFalhas(n)
      gravarFalhas(n)
      setEspera(esperaAposFalhas(n))
      setErro(mensagem)
      setSenha('')
    } else {
      gravarFalhas(0)
    }
  }

  if (pendenteCodigo) {
    return (
      <div className="login">
        <form className="card login-caixa" onSubmit={enviarOCodigo}>
          <h1>Verificação em 2 passos</h1>
          <p className="muted">Abra o aplicativo autenticador no celular e digite o código de 6 números do Bolão da Mega da Virada.</p>
          <label className="campo">
            <span>Código</span>
            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus required />
          </label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          {espera > 0 && <p className="aviso">Muitas tentativas erradas. Aguarde {espera} s para tentar de novo.</p>}
          <button type="submit" className="primario" disabled={enviando || espera > 0}>
            {enviando ? 'Conferindo…' : 'Confirmar'}
          </button>
          <button type="button" className="secundario" onClick={() => void sair()}>
            Cancelar e sair
          </button>
          <p className="muted pequeno">Perdeu o celular? Veja “Se você perder o celular” em docs/seguranca.md (remover o fator no painel do Supabase).</p>
        </form>
      </div>
    )
  }

  return (
    <div className="login">
      <form className="card login-caixa" onSubmit={enviar}>
        <span className="login-simbolo"><Simbolo nome="trevo" /></span>
        <h1>Bolão da Mega da Virada</h1>
        <p className="muted" style={{ textAlign: 'center' }}>Área do organizador (ADM)</p>
        <label className="campo">
          <span>Usuário</span>
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoCapitalize="none" autoComplete="username" autoFocus required />
        </label>
        <label className="campo">
          <span>Senha</span>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        {espera > 0 && <p className="aviso">Muitas tentativas erradas. Aguarde {espera} s para tentar de novo.</p>}
        <button type="submit" className="primario" disabled={enviando || espera > 0}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="muted pequeno">Esqueceu a senha? Quem administra o projeto troca a senha no painel do Supabase (Authentication → Users).</p>
        <p style={{ textAlign: 'center' }}><Link to="/">← Voltar ao início</Link></p>
      </form>
    </div>
  )
}
