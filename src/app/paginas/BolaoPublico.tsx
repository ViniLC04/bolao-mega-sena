import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { perfilDaConta, salvarPerfil, validarPerfil, vincularMinhaConta } from '../../data/apostador'
import { useAuth } from '../auth'
import { carregarBolaoPorLink, carregarJogosPorLink, inscreverNoBolao, type JogoPublico, type ParticipanteDoLink, type ResumoBolaoPorLink } from '../../data/publico'
import { ChancesBolao } from '../ChancesBolao'
import { ConferenciaBolao } from '../Conferencia'
import { contagemRegressiva, formatarDataHoraSP, formatarInteiro, formatarPct, formatarReais } from '../formato'
import { useRegras } from '../regras'
import { Simbolo } from '../simbolos'

const dezenaTexto = (d: number) => String(d).padStart(2, '0')

const chaveMeuLink = (tokenBolao: string) => `bolao-meu-link-${tokenBolao.slice(0, 16)}`

function lerMeuLink(tokenBolao: string): string | null {
  try {
    const v = localStorage.getItem(chaveMeuLink(tokenBolao))
    return v && /^[0-9a-f]{64}$/.test(v) ? v : null
  } catch {
    return null
  }
}

/** "Quero participar": a pessoa se cadastra sozinha, só para si, e vai para o link pessoal (com o PIX). */
function QueroParticipar({ tokenBolao, resumo }: { tokenBolao: string; resumo: ResumoBolaoPorLink }) {
  const navigate = useNavigate()
  const { sessao, adm } = useAuth()
  const apostador = !!sessao && !adm
  const perfil = apostador ? perfilDaConta(sessao?.user) : null
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState('')
  const [zap, setZap] = useState('')
  const usaPerfil = perfil !== null && !editando
  const nomeFinal = usaPerfil ? perfil.nome : nome
  const zapFinal = usaPerfil ? perfil.whatsapp : zap
  const [qtd, setQtd] = useState(1)
  const [ciente, setCiente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [meuLink] = useState(() => lerMeuLink(tokenBolao))
  const max = Math.max(1, resumo.max_cotas_pessoa)
  const valor = resumo.cota_cent !== null ? resumo.cota_cent * qtd : null

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!ciente) return setErro('Marque a caixa para confirmar que leu o aviso.')
    const erroPerfil = validarPerfil(nomeFinal, zapFinal)
    if (erroPerfil) return setErro(erroPerfil)
    setOcupado(true)
    setErro(null)
    const r = await inscreverNoBolao(tokenBolao, nomeFinal, zapFinal, qtd)
    setOcupado(false)
    if (r.erro || !r.token) return setErro(r.erro)
    if (apostador) {
      await vincularMinhaConta(r.token)
      if (!usaPerfil) await salvarPerfil(nomeFinal, zapFinal) // guarda na conta para a próxima inscrição
    } // se falhar, o link pessoal continua valendo; dá para vincular depois
    try {
      localStorage.setItem(chaveMeuLink(tokenBolao), r.token)
    } catch {
      /* sem armazenamento: a pessoa precisa guardar o link da próxima tela */
    }
    navigate(`/p/${r.token}`)
  }

  return (
    <section className="card" style={{ marginTop: 14 }}>
      <h2>Quero participar</h2>
      {meuLink && (
        <p className="ok">
          Você já se inscreveu neste aparelho. <Link to={`/p/${meuLink}`}>Abrir a minha participação</Link>
        </p>
      )}
      {apostador ? (
        <p className="ok pequeno">Você está com a conta aberta: esta inscrição fica ligada a ela e aparece em “Minha área”.</p>
      ) : (
        <p className="muted pequeno">
          Quer guardar o histórico das suas cotas? <Link to="/apostador">Crie sua conta ou entre</Link> antes de se inscrever.
        </p>
      )}
      <form onSubmit={(e) => void enviar(e)}>
        {usaPerfil && (
          <p>
            Inscrevendo como <strong>{perfil.nome}</strong> · {perfil.whatsapp}{' '}
            <button
              type="button"
              className="secundario pequeno"
              onClick={() => {
                setNome(perfil.nome)
                setZap(perfil.whatsapp)
                setEditando(true)
              }}
            >
              Alterar
            </button>
          </p>
        )}
        <div className="campos">
          {!usaPerfil && (
            <>
              <label className="campo">
                <span>Nome completo</span>
                <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" maxLength={80} required />
              </label>
              <label className="campo">
                <span>WhatsApp (com DDD)</span>
                <input value={zap} onChange={(e) => setZap(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="(11) 91234-5678" maxLength={20} required />
              </label>
            </>
          )}
          <label className="campo">
            <span>Quantas cotas?</span>
            <select value={qtd} onChange={(e) => setQtd(Number(e.target.value))}>
              {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        {valor !== null && (
          <p>
            Valor a pagar: <strong>{formatarReais(valor)}</strong>
          </p>
        )}
        <p className="muted pequeno">
          Você se inscreve só para si mesmo. Seu nome completo e seu WhatsApp ficam visíveis apenas para o organizador; os outros participantes veem só o seu primeiro nome. Depois da inscrição você recebe um link pessoal com o PIX para pagar. A cota só vale depois que o organizador confirma o pagamento. Depois de inscrito, dá para aumentar as cotas, mas não diminuir.
        </p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
          <input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)} style={{ width: 20, minHeight: 20 }} />
          Li e concordo com o uso dos meus dados para organizar o bolão
        </label>
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" className="primario" disabled={ocupado}>
          {ocupado ? 'Enviando…' : 'Me inscrever'}
        </button>
      </form>
    </section>
  )
}

/** Página do link público de UM bolão (#/b/<token>): primeiros nomes e cotas, totais e jogos. Sem sobrenome nem contato. */
export function BolaoPublico() {
  const { token = '' } = useParams()
  const { params } = useRegras()
  const [agora] = useState(() => Date.now())
  const [resumo, setResumo] = useState<ResumoBolaoPorLink | null | undefined>(undefined)
  const [gente, setGente] = useState<ParticipanteDoLink[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [jogos, setJogos] = useState<JogoPublico[] | null>(null)
  const [verJogos, setVerJogos] = useState(false)

  useEffect(() => {
    let vivo = true
    void carregarBolaoPorLink(token).then((r) => {
      if (!vivo) return
      setResumo(r.resumo)
      setGente(r.participantes)
      setErro(r.erro)
    })
    return () => {
      vivo = false
    }
  }, [token])

  async function alternarJogos() {
    if (!verJogos && jogos === null) {
      const r = await carregarJogosPorLink(token)
      setJogos(r.jogos)
      if (r.erro) setErro(r.erro)
    }
    setVerJogos(!verJogos)
  }

  if (resumo === undefined) return <p className="carregando">Carregando…</p>
  if (resumo === null) {
    return (
      <section className="card vazio">
        <Simbolo nome="ferradura" />
        <h1>Link não encontrado</h1>
        {erro && <p className="erro">{erro}</p>}
        <p>Este link não é válido ou foi desligado. Peça o link atual ao organizador do bolão.</p>
      </section>
    )
  }

  const c = contagemRegressiva(params.data_limite_aposta, agora)
  const congelado = resumo.status === 'congelado'
  const n = resumo.n_cotas // vazio enquanto as inscrições estão abertas
  const aberto = resumo.status === 'aberto'
  const pct = n !== null && n > 0 ? resumo.cotas_vendidas / n : 0
  const livres = n !== null ? n - resumo.cotas_vendidas : 0
  const aReceber = resumo.previsto_cent - resumo.arrecadado_cent
  const recibos = jogos ? [...new Set(jogos.map((j) => j.recibo_ordem))].sort((x, y) => x - y) : []

  return (
    <>
      <section className="hero" style={{ padding: '22px 16px 18px' }}>
        <Simbolo nome="neko" tamanho={56} />
        <h1>{resumo.nome}</h1>
        <p className="lema">Concurso {resumo.concurso_alvo}</p>
        {aberto && (
          <p className="prazo" style={{ marginTop: 0, marginBottom: 6 }}>
            Inscrições abertas{resumo.inscricoes_ate ? <> até <strong>{formatarDataHoraSP(resumo.inscricoes_ate)}</strong></> : ''}
          </p>
        )}
        <p className="prazo">
          Prazo das apostas: <strong>{formatarDataHoraSP(params.data_limite_aposta)}</strong> · {c.encerrado ? 'encerrado' : `faltam ${c.dias} dia(s) e ${c.horas} h`}
        </p>
      </section>

      {erro && <p className="erro">{erro}</p>}

      {resumo.autoinscricao && <QueroParticipar tokenBolao={token} resumo={resumo} />}

      <div className="grade" style={{ marginTop: 14 }}>
        <section className="card">
          <h2>Cotas vendidas</h2>
          {n === null ? (
            <>
              <p className="grande">{formatarInteiro(resumo.cotas_vendidas)}</p>
              <p className="muted pequeno">Ainda não há número fixo de cotas: ele será definido quando as inscrições fecharem.</p>
            </>
          ) : (
            <>
              <p className="grande">
                {formatarInteiro(resumo.cotas_vendidas)} de {formatarInteiro(n)}
              </p>
              <div className="barra" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={resumo.cotas_vendidas} aria-label="Cotas vendidas">
                <div style={{ width: `${Math.min(100, pct * 100)}%` }} />
              </div>
              <p className="muted pequeno">{livres > 0 ? `${formatarInteiro(livres)} cota(s) ainda livre(s)` : 'Todas as cotas foram vendidas'}</p>
            </>
          )}
        </section>
        <section className="card">
          <h2>Arrecadado</h2>
          <p className="grande">{formatarReais(resumo.arrecadado_cent)}</p>
          <p className="muted pequeno">
            de {formatarReais(resumo.previsto_cent)} das cotas vendidas · falta receber {formatarReais(aReceber)}
          </p>
        </section>
        <section className="card">
          <h2>Valor da cota</h2>
          <p className="grande">{resumo.cota_cent !== null ? formatarReais(resumo.cota_cent) : '—'}</p>
          <p className="muted pequeno">
            Apostas na Caixa: {formatarReais(resumo.custo_cent)} · {formatarInteiro(resumo.jogos)} jogo(s)
          </p>
        </section>
      </div>

      <h2>Quem está no bolão</h2>
      {gente.length === 0 ? (
        <p className="muted">Ainda não há participantes neste bolão.</p>
      ) : (
        <div className="card tabela-rolavel">
          <table>
            <thead>
              <tr>
                <th>Participante</th>
                <th>Cotas</th>
                <th>{aberto ? 'Parte até agora' : 'Parte do bolão'}</th>
              </tr>
            </thead>
            <tbody>
              {gente.map((p) => (
                <tr key={p.nome}>
                  <td>
                    <strong>{p.nome}</strong>
                  </td>
                  <td>{formatarInteiro(p.qtd)}</td>
                  <td>{formatarPct((n ?? resumo.cotas_vendidas) > 0 ? p.qtd / (n ?? resumo.cotas_vendidas) : 0, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted pequeno">Por privacidade, aparece só o primeiro nome de cada pessoa.</p>

      <h2>Jogos</h2>
      {!congelado ? (
        <p className="muted">
          {aberto
            ? 'Os jogos serão gerados depois que as inscrições fecharem (com o número de cotas definido). Quando forem congelados, aparecem aqui.'
            : 'Os jogos ainda estão sendo preparados. Quando forem congelados, aparecem aqui.'}
        </p>
      ) : (
        <section className="card">
          <p className="muted pequeno">
            Jogos congelados em {resumo.congelado_em ? formatarDataHoraSP(resumo.congelado_em) : '—'}. Impressão digital (SHA-256) para conferir que nada mudou:
          </p>
          <p className="pequeno" style={{ wordBreak: 'break-all' }}>
            <code>{resumo.hash}</code>
          </p>
          <button type="button" className="secundario" onClick={() => void alternarJogos()}>
            {verJogos ? 'Esconder os jogos' : 'Ver os jogos, as chances e a conferência'}
          </button>
          {verJogos && jogos && jogos.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {recibos.map((ro, i) => {
                const doRecibo = jogos.filter((j) => j.recibo_ordem === ro)
                return (
                  <div key={ro} style={{ marginBottom: 10 }}>
                    <strong>
                      Recibo {i + 1}: {doRecibo.length} jogo(s) de {doRecibo[0]?.k} dezenas
                    </strong>
                    <ul className="lista-simples">
                      {doRecibo.map((j) => (
                        <li key={j.jogo_ordem} style={{ fontVariantNumeric: 'tabular-nums', padding: '3px 0' }}>
                          {[...j.dezenas].sort((x, y) => x - y).map(dezenaTexto).join(' ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
              <ChancesBolao jogos={jogos.map((j) => ({ recibo: j.recibo_ordem, dezenas: j.dezenas }))} />
              <ConferenciaBolao jogos={jogos.map((j) => ({ recibo: j.recibo_ordem, dezenas: j.dezenas }))} nCotas={n ?? resumo.cotas_vendidas} concursoAlvo={resumo.concurso_alvo} />
            </div>
          )}
        </section>
      )}
    </>
  )
}
