import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { carregarMinhasParticipacoes, type ParticipacaoDaConta } from '../../data/apostador'
import { useAuth } from '../auth'
import { Cartao } from '../CartaoParticipacao'

/** Área do apostador: todas as participações ligadas à conta (cotas, pagamento, PIX, jogos). */
export function MinhaArea() {
  const { carregando, sessao, adm, sair } = useAuth()
  const [linhas, setLinhas] = useState<ParticipacaoDaConta[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)
  const logado = !carregando && !!sessao && !adm

  useEffect(() => {
    if (!logado) return
    let vivo = true
    void carregarMinhasParticipacoes().then((r) => {
      if (!vivo) return
      setLinhas(r.linhas)
      setErro(r.erro)
    })
    return () => {
      vivo = false
    }
  }, [logado, versao])

  if (carregando) return <p className="carregando">Carregando…</p>
  if (!sessao || adm) return <Navigate to="/apostador" replace />

  return (
    <div>
      <h1>Minha área</h1>
      <p className="muted pequeno">
        Conta: <strong>{sessao.user.email}</strong>{' '}
        <button type="button" className="secundario pequeno" onClick={() => void sair()}>
          Sair
        </button>
      </p>
      {erro && <p className="erro">{erro}</p>}
      {linhas === null ? (
        <p className="muted">Carregando…</p>
      ) : linhas.length === 0 ? (
        <section className="card">
          <p>
            Você ainda não tem participações nesta conta. Abra o <strong>link do bolão</strong> e clique em “Quero participar”, ou abra o seu <strong>link pessoal</strong> (o que começa com <code>#/p/</code>): ele é ligado à conta automaticamente.
          </p>
          <p className="muted pequeno">Perdeu o link pessoal? Peça ao organizador do bolão.</p>
        </section>
      ) : (
        linhas.map((l) => <Cartao key={l.bolao_id + l.link_token} l={l} token={l.link_token} aoMudar={() => setVersao((v) => v + 1)} />)
      )}
      <p className="muted pequeno" style={{ marginTop: 24 }}>
        <Link to="/publico">Página geral dos bolões</Link>
      </p>
    </div>
  )
}
