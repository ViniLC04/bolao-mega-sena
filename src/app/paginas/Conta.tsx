import { useState, type FormEvent } from 'react'
import { trocarSenha } from '../../data/auth'
import { emailParaUsuario } from '../../data/usuario'
import { validarSenha } from '../../engine/validacoes'
import { useAuth } from '../auth'
import { DoisPassos } from '../DoisPassos'
import { RecebimentoPix } from '../RecebimentoPix'

export function Conta() {
  const { sessao } = useAuth()
  const [nova, setNova] = useState('')
  const [repetir, setRepetir] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const problemas = nova ? validarSenha(nova) : []

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setOk(false)
    if (nova !== repetir) return setErro('As duas senhas não são iguais.')
    setOcupado(true)
    const r = await trocarSenha(nova)
    setOcupado(false)
    if (r.ok) {
      setErro(null)
      setOk(true)
      setNova('')
      setRepetir('')
    } else setErro(r.erro)
  }

  return (
    <>
      <h1>Minha conta</h1>
      <p>
        Usuário: <strong>{emailParaUsuario(sessao?.user.email ?? '')}</strong>
      </p>
      <DoisPassos />
      <RecebimentoPix />
      <form className="card" onSubmit={enviar}>
        <h2>Trocar a senha</h2>
        <p className="muted">Mínimo de 8 caracteres, com letra maiúscula, minúscula, número e símbolo. O servidor confere de novo.</p>
        <label className="campo">
          <span>Nova senha</span>
          <input type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" required />
        </label>
        {problemas.length > 0 && (
          <ul className="aviso pequeno">
            {problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <label className="campo">
          <span>Repita a nova senha</span>
          <input type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" required />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        {ok && <p className="ok">Senha trocada.</p>}
        <button type="submit" className="primario" disabled={ocupado || problemas.length > 0 || !nova}>
          {ocupado ? 'Trocando…' : 'Trocar senha'}
        </button>
      </form>
    </>
  )
}
