import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { criarConta, entrarApostador } from '../../data/apostador'
import { useAuth } from '../auth'

/** Entrar ou criar conta de apostador (e-mail + senha). A conta mostra o histórico de cotas e bolões da pessoa. */
export function Apostador() {
  const { carregando, sessao, adm } = useAuth()
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [nome, setNome] = useState('')
  const [zap, setZap] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  if (!carregando && sessao && !adm) return <Navigate to="/minha-area" replace />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (ocupado) return
    setErro(null)
    setAviso(null)
    if (modo === 'criar' && senha !== senha2) return setErro('As duas senhas não são iguais.')
    setOcupado(true)
    const r = modo === 'criar' ? await criarConta(email, senha, nome, zap) : await entrarApostador(email, senha)
    setOcupado(false)
    if (!r.ok) return setErro(r.erro)
    if (r.precisaConfirmar) setAviso('Conta criada. Confirme pelo e-mail que enviamos e depois entre.')
  }

  return (
    <div style={{ maxWidth: 460, margin: '0 auto' }}>
      <h1>Sou apostador</h1>
      <p className="muted">Entre ou crie a sua conta para escolher um bolão e apostar, e para ver as suas cotas e os bolões de que você participa.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" className={modo === 'entrar' ? 'primario' : 'secundario'} onClick={() => setModo('entrar')}>
          Entrar
        </button>
        <button type="button" className={modo === 'criar' ? 'primario' : 'secundario'} onClick={() => setModo('criar')}>
          Criar conta
        </button>
      </div>
      <form className="card" onSubmit={(e) => void enviar(e)}>
        {modo === 'criar' && (
          <>
            <label className="campo">
              <span>Nome completo</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" maxLength={80} required />
            </label>
            <label className="campo">
              <span>WhatsApp (com DDD)</span>
              <input value={zap} onChange={(e) => setZap(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="(11) 91234-5678" maxLength={20} required />
            </label>
            <p className="muted pequeno">Seu nome completo e WhatsApp ficam visíveis só para o organizador e servem para você se inscrever nos bolões sem digitar de novo.</p>
          </>
        )}
        <label className="campo">
          <span>E-mail</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="campo">
          <span>Senha</span>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} required />
        </label>
        {modo === 'criar' && (
          <>
            <label className="campo">
              <span>Repita a senha</span>
              <input type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} autoComplete="new-password" required />
            </label>
            <p className="muted pequeno">
              Mínimo de 8 caracteres, com letra maiúscula, minúscula, número e símbolo. Guarde bem: não há recuperação por e-mail; se esquecer, fale com o organizador.
            </p>
            <p className="muted pequeno">
              Depois de criar a conta, inscreva-se pelo link do bolão (ou abra o seu link pessoal) já com a conta aberta: a participação fica ligada a ela.
            </p>
          </>
        )}
        {erro && <p className="erro">{erro}</p>}
        {aviso && <p className="ok">{aviso}</p>}
        <button type="submit" className="primario" disabled={ocupado}>
          {ocupado ? 'Aguarde…' : modo === 'criar' ? 'Criar conta' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
