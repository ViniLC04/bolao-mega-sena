import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { esperaAposFalhas } from '../bloqueio'

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
  const { adm, carregando, entrar } = useAuth()
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [falhas, setFalhas] = useState(lerFalhas)
  const [espera, setEspera] = useState(() => esperaAposFalhas(lerFalhas()))

  useEffect(() => {
    if (espera <= 0) return
    const t = setInterval(() => setEspera((e) => Math.max(0, e - 1)), 1000)
    return () => clearInterval(t)
  }, [espera > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!carregando && adm) return <Navigate to="/" replace />

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

  return (
    <div className="login">
      <form className="card login-caixa" onSubmit={enviar}>
        <h1>Bolão da Mega da Virada</h1>
        <p className="muted">Área do organizador (ADM)</p>
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
      </form>
    </div>
  )
}
