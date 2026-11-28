import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { carregarBoloesListados, carregarMinhasParticipacoes, perfilDaConta, salvarPerfil, type BolaoListado, type ParticipacaoDaConta } from '../../data/apostador'
import { useAuth } from '../auth'
import { Cartao } from '../CartaoParticipacao'
import { formatarDataHoraSP, formatarReais } from '../formato'

function MeusDados({ user }: { user: { user_metadata?: Record<string, unknown> } }) {
  const perfil = perfilDaConta(user)
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState('')
  const [zap, setZap] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setErro(null)
    const r = await salvarPerfil(nome, zap)
    setOcupado(false)
    if (r) return setErro(r)
    setEditando(false)
    setMsg('Dados salvos.')
  }

  return (
    <section className="card" style={{ marginBottom: 12 }}>
      <h2>Meus dados</h2>
      {msg && <p className="ok">{msg}</p>}
      {!editando ? (
        <p>
          {perfil ? (
            <>
              {perfil.nome} · {perfil.whatsapp}
            </>
          ) : (
            <span className="muted">Ainda não há nome e WhatsApp na conta. Preencha uma vez e você não precisa digitar nas próximas inscrições.</span>
          )}{' '}
          <button
            type="button"
            className="secundario pequeno"
            onClick={() => {
              setNome(perfil?.nome ?? '')
              setZap(perfil?.whatsapp ?? '')
              setMsg(null)
              setEditando(true)
            }}
          >
            {perfil ? 'Editar dados' : 'Preencher'}
          </button>
        </p>
      ) : (
        <form onSubmit={(e) => void salvar(e)}>
          <div className="campos">
            <label className="campo">
              <span>Nome completo</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" maxLength={80} required />
            </label>
            <label className="campo">
              <span>WhatsApp (com DDD)</span>
              <input value={zap} onChange={(e) => setZap(e.target.value)} inputMode="tel" autoComplete="tel" maxLength={20} required />
            </label>
          </div>
          {erro && <p className="erro">{erro}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="primario" disabled={ocupado}>
              Salvar
            </button>
            <button type="button" className="secundario" onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

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
      <MeusDados user={sessao.user} />
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
