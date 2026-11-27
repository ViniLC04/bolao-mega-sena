import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apagarRascunho, carregarBolao, carregarBoloesCongelados, congelarBolao, criarBolaoAberto, listarBoloes, type BolaoLinha, type ReciboDet } from '../../data/boloes'
import { auditarBoloes, type RelatorioAuditoria } from '../../engine/auditoria'
import { FaseDoBolao } from '../BolaoAberto'
import { ChanceExpansivel } from '../Chance'
import { campoLocalSPParaIso, formatarDataHoraSP, formatarInteiro, formatarReais, parseReais } from '../formato'
import { descreverRecibo } from '../plano'
import { useRegras } from '../regras'
import { ChancesBolao } from '../ChancesBolao'
import { FotoRecibo } from '../FotoRecibo'
import { LinkDoBolao } from '../LinkDoBolao'
import { ConferenciaBolao, type ParticipanteConferencia } from '../Conferencia'
import { listarCotas } from '../../data/participantes'
import { CotasBolao } from './CotasBolao'

const dezenaTexto = (d: number) => String(d).padStart(2, '0')

function Status({ s }: { s: BolaoLinha['status'] }) {
  const rotulo = s === 'aberto' ? 'inscrições abertas' : s === 'rascunho' ? 'rascunho' : 'congelado'
  return <span className="tag" style={s !== 'congelado' ? { background: s === 'aberto' ? 'var(--ouro)' : 'var(--muted)' } : undefined}>{rotulo}</span>
}

/** Formulário "Novo bolão aberto": só o valor da cota e a data limite de inscrição; o número de cotas vem depois. */
function NovoBolaoAberto({ concursoPadrao }: { concursoPadrao: number }) {
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [cota, setCota] = useState('100,00')
  const [ate, setAte] = useState('')
  const [concurso, setConcurso] = useState(String(concursoPadrao))
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function criar() {
    const cotaCent = parseReais(cota)
    const iso = campoLocalSPParaIso(ate)
    const conc = /^\d+$/.test(concurso.trim()) ? Number(concurso.trim()) : NaN
    if (nome.trim().length < 2) return setErro('Dê um nome ao bolão.')
    if (cotaCent === null || cotaCent <= 0) return setErro('Informe o valor da cota em reais (ex.: 100,00).')
    if (!iso) return setErro('Escolha a data e a hora até quando as inscrições ficam abertas.')
    if (!Number.isInteger(conc) || conc < 1) return setErro('Informe o número do concurso.')
    setOcupado(true)
    setErro(null)
    const r = await criarBolaoAberto({ concurso: conc, nome: nome.trim(), cotaCent, inscricoesAte: iso })
    setOcupado(false)
    if (r.erro || !r.id) setErro(r.erro)
    else navigate(`/boloes/${r.id}`)
  }

  if (!aberto) {
    return (
      <p>
        <button type="button" className="primario" onClick={() => setAberto(true)}>
          + Novo bolão aberto (só o valor da cota)
        </button>
      </p>
    )
  }
  return (
    <section className="card" style={{ marginBottom: 14 }}>
      <h2>Novo bolão aberto</h2>
      <p className="muted pequeno">
        Você ainda não sabe quantas cotas serão. Defina só o <strong>valor da cota</strong> e até quando as pessoas podem entrar. Depois da data, você fecha as inscrições e o app calcula os recibos e gera os jogos com o número de cotas que foi vendido.
      </p>
      <div className="campos">
        <label className="campo">
          <span>Nome do bolão</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} placeholder="Bolão da Virada 3100" />
        </label>
        <label className="campo">
          <span>Valor da cota (R$)</span>
          <input value={cota} onChange={(e) => setCota(e.target.value)} inputMode="decimal" />
        </label>
        <label className="campo">
          <span>Inscrições até</span>
          <input type="datetime-local" value={ate} onChange={(e) => setAte(e.target.value)} />
        </label>
        <label className="campo">
          <span>Concurso</span>
          <input value={concurso} onChange={(e) => setConcurso(e.target.value)} inputMode="numeric" />
        </label>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="primario" disabled={ocupado} onClick={() => void criar()}>
          {ocupado ? 'Criando…' : 'Criar bolão aberto'}
        </button>
        <button type="button" className="secundario" disabled={ocupado} onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </section>
  )
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
      <p className="muted">
        Dois jeitos de criar: <strong>bolão aberto</strong> (você só sabe o valor da cota; cadastra as pessoas e depois fecha as inscrições) ou o caminho direto: simule em <Link to="/simulador">Simulador</Link>, gere os jogos em <Link to="/gerador">Gerador</Link> e clique em “Salvar como rascunho”.
      </p>
      <NovoBolaoAberto concursoPadrao={concurso} />
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
                  <td>{b.n_cotas ?? '—'}</td>
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
  const [partic, setPartic] = useState<ParticipanteConferencia[]>([])
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
    void Promise.all([carregarBolao(id), listarCotas(id)]).then(([r, c]) => {
      if (!vivo) return
      setBolao(r.bolao)
      setRecibos(r.recibos)
      setErro(r.erro)
      setPartic(c.lista.map((x) => ({ nome: x.participantes?.nome ?? '—', qtd: x.qtd })))
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
  const temJogos = recibos.length > 0

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
          {bolao.n_cotas === null ? (
            <li>Cota de <strong>{bolao.cota_base_cent !== null ? formatarReais(bolao.cota_base_cent) : '—'}</strong> · o número de cotas e os jogos serão definidos ao fechar as inscrições</li>
          ) : (
            <li>Cotas: <strong>{bolao.n_cotas}</strong> · jogos: <strong>{totalJogos}</strong> · custo das apostas: <strong>{formatarReais(totalCent)}</strong></li>
          )}
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

      <FaseDoBolao bolao={bolao} temJogos={temJogos} aoMudar={() => void recarregar()} />

      {!congelado && temJogos && (
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

      <LinkDoBolao bolaoId={bolao.id} />

      <CotasBolao bolao={bolao} custoCent={totalCent} />

      {temJogos && bolao.n_cotas !== null && (
        <>
          <ChancesBolao jogos={recibos.flatMap((r, i) => r.jogos.map((j) => ({ recibo: i, dezenas: j.dezenas })))} />

          <ConferenciaBolao
            jogos={recibos.flatMap((r, i) => r.jogos.map((j) => ({ recibo: i, dezenas: j.dezenas })))}
            nCotas={bolao.n_cotas}
            concursoAlvo={bolao.concurso_alvo}
            participantes={partic}
          />
        </>
      )}

      {temJogos && <h2>Jogos</h2>}
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
          <FotoRecibo bolaoId={bolao.id} ordem={r.ordem} caminho={r.foto_path} aoMudar={() => void recarregar()} />
        </section>
      ))}
    </>
  )
}
