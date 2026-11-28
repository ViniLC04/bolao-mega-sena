import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { carregarBoloesListados, carregarMinhasParticipacoes, type BolaoListado, type ParticipacaoDaConta } from '../../data/apostador'
import { useAuth } from '../auth'
import { Cartao } from '../CartaoParticipacao'
import { formatarDataHoraSP, formatarReais } from '../formato'

function BoloesParaParticipar({ listados }: { listados: BolaoListado[] }) {
  if (listados.length === 0) return null
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h2>Bolões abertos para participar</h2>
      <p className="muted pequeno">Bolões que o organizador deixou visíveis para quem tem conta.</p>
      {listados.map((b) => (
        <div key={b.bolao_id} style={{ padding: '8px 0', borderTop: '1px solid var(--borda)' }}>
          <strong>{b.nome}</strong>
          <div className="muted pequeno">
            Concurso {b.concurso_alvo} · cota {formatarReais(b.cota_cent)} · {b.cotas_vendidas} de {b.n_cotas} cotas
            {b.inscricoes_ate ? ` · inscrições até ${formatarDataHoraSP(b.inscricoes_ate)}` : ''}
            {!b.inscricao_aberta ? ' · inscrições encerradas' : ''}
          </div>
          <Link to={`/b/${b.token}`}>{b.inscricao_aberta ? 'Ver e participar' : 'Ver o bolão'}</Link>
        </div>
      ))}
    </section>
  )
}

/** Área do apostador: todas as participações ligadas à conta (cotas, pagamento, PIX, jogos). */
export function MinhaArea() {
  const { carregando, sessao, adm, sair } = useAuth()
  const [linhas, setLinhas] = useState<ParticipacaoDaConta[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [listados, setListados] = useState<BolaoListado[]>([])
  const [versao, setVersao] = useState(0)
  const logado = !carregando && !!sessao && !adm

  useEffect(() => {
    if (!logado) return
    let vivo = true
    void Promise.all([carregarMinhasParticipacoes(), carregarBoloesListados()]).then(([r, l]) => {
      if (!vivo) return
      setLinhas(r.linhas)
      setErro(r.erro ?? l.erro)
      setListados(l.boloes)
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
      {linhas !== null && <BoloesParaParticipar listados={listados.filter((b) => !linhas.some((l) => l.bolao_id === b.bolao_id))} />}
      <p className="muted pequeno" style={{ marginTop: 24 }}>
        <Link to="/publico">Página geral dos bolões</Link>
      </p>
    </div>
  )
}
