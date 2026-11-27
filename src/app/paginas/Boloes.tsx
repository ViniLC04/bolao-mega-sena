import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apagarRascunho, carregarBolao, carregarBoloesCongelados, congelarBolao, listarBoloes, type BolaoLinha, type ReciboDet } from '../../data/boloes'
import { auditarBoloes, type RelatorioAuditoria } from '../../engine/auditoria'
import { ChanceExpansivel } from '../Chance'
import { formatarDataHoraSP, formatarInteiro, formatarReais } from '../formato'
import { descreverRecibo } from '../plano'
import { useRegras } from '../regras'
import { CotasBolao } from './CotasBolao'

const dezenaTexto = (d: number) => String(d).padStart(2, '0')

function Status({ s }: { s: BolaoLinha['status'] }) {
  return <span className="tag" style={s === 'rascunho' ? { background: 'var(--muted)' } : undefined}>{s === 'rascunho' ? 'rascunho' : 'congelado'}</span>
}

export function Boloes() {
  const { params } = useRegras()
  const concurso = params.concurso_virada.numero
  const [lista, setLista] = useState<BolaoLinha[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [auditoria, setAuditoria] = useState<RelatorioAuditoria | null>(null)
  const [auditando, setAuditando] = useState(false)

  useEffect(() => {
    let vivo = true
    void listarBoloes().then((r) => {
      if (!vivo) return
      setErro(r.erro)
      setLista(r.boloes)
    })
    return () => {
      vivo = false
    }
  }, [])

  async function auditar() {
    setAuditando(true)
    setErro(null)
    const r = await carregarBoloesCongelados(concurso)
    if (r.erro) setErro(r.erro)
    else setAuditoria(auditarBoloes(r.boloes))
    setAuditando(false)
  }

  return (
    <>
      <h1>Bolões</h1>
      <p className="muted">Para criar um bolão: simule em <Link to="/simulador">Simulador</Link>, gere os jogos em <Link to="/gerador">Gerador</Link> e clique em “Salvar como rascunho”.</p>
      {erro && <p className="erro">{erro}</p>}

      {lista === null ? (
        <p className="muted">Carregando…</p>
      ) : lista.length === 0 ? (
        <p>Nenhum bolão criado ainda.</p>
      ) : (
        <div className="tabela-rolavel">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Concurso</th>
                <th>Cotas</th>
                <th>Situação</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link to={`/boloes/${b.id}`}>{b.nome}</Link>
                  </td>
                  <td>{b.concurso_alvo}</td>
                  <td>{b.n_cotas}</td>
                  <td>
                    <Status s={b.status} />
                  </td>
                  <td>{formatarDataHoraSP(b.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Auditoria do concurso {concurso}</h2>
        <p className="muted pequeno">Junta os jogos de todos os bolões congelados deste concurso e confere repetições, sobreposição e a chance de sena de todos juntos.</p>
        <button type="button" className="secundario" disabled={auditando} onClick={() => void auditar()}>
          {auditando ? 'Calculando…' : 'Gerar relatório de auditoria'}
        </button>
        {auditoria && <RelatorioAud r={auditoria} />}
      </section>
    </>
  )
}

function RelatorioAud({ r }: { r: RelatorioAuditoria }) {
  if (r.boloes === 0) return <p>Ainda não há bolão congelado neste concurso.</p>
  return (
    <ul className="lista-simples" style={{ marginTop: 10 }}>
      <li>
        Bolões congelados: <strong>{r.boloes}</strong> · jogos: <strong>{formatarInteiro(r.totalJogos)}</strong>
      </li>
      <li>
        Combinações de 6 dezenas: <strong>{formatarInteiro(r.combinacoesDistintas)}</strong> distintas de {formatarInteiro(r.combinacoesEsperadas)} esperadas
      </li>
      <li className={r.repetidas === 0 ? 'ok' : 'erro'}>Repetidas: {formatarInteiro(r.repetidas)} {r.repetidas === 0 ? '✓' : '(precisa ser 0)'}</li>
      <li>
        Maior sobreposição entre dois jogos: {r.sobreposicaoMaxima} dezenas iguais
        {r.parSobreposicao && ` (${r.parSobreposicao[0] === r.parSobreposicao[1] ? `dentro de “${r.parSobreposicao[0]}”` : `“${r.parSobreposicao[0]}” e “${r.parSobreposicao[1]}”`})`}
      </li>
      {r.senaUmEm !== null && (
        <li>
          Chance de sena de todos os bolões juntos: <ChanceExpansivel p={1 / r.senaUmEm} />
        </li>
      )}
    </ul>
  )
}

export function BolaoDetalhe() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [bolao, setBolao] = useState<BolaoLinha | null>(null)
  const [recibos, setRecibos] = useState<ReciboDet[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [confirmou, setConfirmou] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    const r = await carregarBolao(id)
    setBolao(r.bolao)
    setRecibos(r.recibos)
    setErro(r.erro)
    setCarregando(false)
  }, [id])

  useEffect(() => {
    let vivo = true
    void carregarBolao(id).then((r) => {
      if (!vivo) return
      setBolao(r.bolao)
      setRecibos(r.recibos)
      setErro(r.erro)
      setCarregando(false)
    })
    return () => {
      vivo = false
    }
  }, [id])

  async function congelar() {
    setOcupado(true)
    setMensagem(null)
    setErro(null)
    const r = await congelarBolao(id)
    setOcupado(false)
    if (!r.ok) setErro(r.erro)
    else {
      setMensagem(`Bolão congelado. ${formatarInteiro(r.combinacoes ?? 0)} combinações de 6 dezenas registradas.`)
      setConfirmou(false)
      await recarregar()
    }
  }

  async function apagar() {
    if (!window.confirm('Apagar este rascunho? Não dá para desfazer.')) return
    setOcupado(true)
    const e = await apagarRascunho(id)
    setOcupado(false)
    if (e) setErro(e)
    else navigate('/boloes')
  }

  if (carregando) return <p className="carregando">Carregando…</p>
  if (!bolao) {
    return (
      <>
        <p className="erro">{erro ?? 'Bolão não encontrado.'}</p>
        <Link to="/boloes">Voltar para Bolões</Link>
      </>
    )
  }

  const totalCent = recibos.reduce((s, r) => s + r.total_cent, 0)
  const totalJogos = recibos.reduce((s, r) => s + r.jogos.length, 0)
  const congelado = bolao.status === 'congelado'

  return (
    <>
      <p>
        <Link to="/boloes">← Bolões</Link>
      </p>
      <h1>
        {bolao.nome} <Status s={bolao.status} />
      </h1>

      <section className="card">
        <ul className="lista-simples">
          <li>Concurso-alvo: <strong>{bolao.concurso_alvo}</strong></li>
          <li>Cotas: <strong>{bolao.n_cotas}</strong> · jogos: <strong>{totalJogos}</strong> · custo das apostas: <strong>{formatarReais(totalCent)}</strong></li>
          <li>Criado em {formatarDataHoraSP(bolao.criado_em)}{bolao.semente !== null && ` · semente ${bolao.semente}`}</li>
          {congelado && bolao.congelado_em && <li>Congelado em <strong>{formatarDataHoraSP(bolao.congelado_em)}</strong></li>}
          {congelado && bolao.hash && (
            <li>
              Hash SHA-256 dos jogos: <code style={{ wordBreak: 'break-all' }}>{bolao.hash}</code>
            </li>
          )}
        </ul>
      </section>

      {erro && <p className="erro">{erro}</p>}
      {mensagem && <p className="ok">{mensagem}</p>}

      {!congelado && (
        <section className="card" style={{ marginTop: 12 }}>
          <h2>Congelar o bolão</h2>
          <p className="aviso">
            Depois de congelado, os jogos <strong>não podem mais ser alterados nem apagados</strong>, e as combinações deles ficam reservadas neste concurso. Antes, confira os jogos abaixo e faça as apostas na lotérica ou no app da Caixa com exatamente estes números.
          </p>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
            <input type="checkbox" checked={confirmou} onChange={(e) => setConfirmou(e.target.checked)} style={{ width: 20, minHeight: 20 }} />
            Conferi os jogos e quero congelar
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="primario" disabled={!confirmou || ocupado} onClick={() => void congelar()}>
              {ocupado ? 'Congelando…' : 'Congelar bolão'}
            </button>
            <button type="button" className="secundario" disabled={ocupado} onClick={() => void apagar()}>
              Apagar rascunho
            </button>
          </div>
        </section>
      )}

      <CotasBolao bolao={bolao} custoCent={totalCent} />

      <h2>Jogos</h2>
      {recibos.map((r) => (
        <section className="card" key={r.ordem} style={{ marginBottom: 12 }}>
          <h2>
            Recibo {r.ordem + 1}: {descreverRecibo(r)} · {formatarReais(r.total_cent)}
          </h2>
          <ul className="lista-simples">
            {r.jogos.map((j) => (
              <li key={j.ordem} style={{ padding: '4px 0', fontVariantNumeric: 'tabular-nums' }}>
                <strong>{j.dezenas.map(dezenaTexto).join(' ')}</strong>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
