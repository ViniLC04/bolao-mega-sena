import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { salvarRascunho } from '../../data/boloes'
import { carregarConcursos, carregarViradas, type ConcursoResumo } from '../../data/concursos'
import { carregarJogosOutrosBoloes, type JogosOutros } from '../../data/jogos'
import { AVISO_RESTRICAO, type JogoGerado, type Premissas, type Relatorio, type ResultadoGeracao } from '../../engine/gerador'
import { filtrarPeriodo, mascarasDe, sugestaoSoma } from '../../engine/historico'
import { formatarInteiro, hojeIsoSP } from '../formato'
import { descreverRecibo, type PlanoBolao } from '../plano'
import { deFormPremissas, dependeDoPeriodo, FORM_PADRAO, NOMES_PERIODO, periodoDeForm, type FormPremissas, type TipoPeriodo } from '../premissasForm'
import { useRegras } from '../regras'
import { useGerador } from '../useGerador'

const CHAVE_PLANO = 'bolao.plano'

function lerPlanoSalvo(): PlanoBolao | null {
  try {
    const t = sessionStorage.getItem(CHAVE_PLANO)
    return t ? (JSON.parse(t) as PlanoBolao) : null
  } catch {
    return null
  }
}

function salvarPlano(p: PlanoBolao) {
  try {
    sessionStorage.setItem(CHAVE_PLANO, JSON.stringify(p))
  } catch {
    /* sem armazenamento: tudo bem, o plano continua na navegação */
  }
}

const dezenaTexto = (d: number) => String(d).padStart(2, '0')
const novaSemente = () => 1 + Math.floor(Math.random() * 2_000_000_000)

function Bloco({ ligado, onLigar, titulo, children }: { ligado: boolean; onLigar: (v: boolean) => void; titulo: string; children?: ReactNode }) {
  return (
    <fieldset className="card" style={{ marginBottom: 10 }}>
      <legend>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={ligado} onChange={(e) => onLigar(e.target.checked)} style={{ width: 20, minHeight: 20 }} />
          {titulo}
        </label>
      </legend>
      {ligado && <div className="campos">{children}</div>}
    </fieldset>
  )
}

function Campo({ rotulo, valor, onChange, dica }: { rotulo: string; valor: string; onChange: (v: string) => void; dica?: string }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      <input value={valor} onChange={(e) => onChange(e.target.value)} />
      {dica && <small className="muted">{dica}</small>}
    </label>
  )
}

interface Atual {
  jogos: JogoGerado[]
  relatorio: Relatorio
  semente: number
  premissas: Premissas
}

export function Gerador() {
  const location = useLocation()
  const navigate = useNavigate()
  const { params, vigenciaEmUso } = useRegras()
  const concursoAlvo = params.concurso_virada.numero
  const [nome, setNome] = useState(() => `Bolão da Virada ${params.concurso_virada.numero}`)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)

  const [plano] = useState<PlanoBolao | null>(() => {
    const doEstado = (location.state as { plano?: PlanoBolao } | null)?.plano
    if (doEstado) {
      salvarPlano(doEstado)
      return doEstado
    }
    return lerPlanoSalvo()
  })

  const [historico, setHistorico] = useState<ConcursoResumo[] | null>(null)
  const [viradas, setViradas] = useState<number[]>([])
  const [outros, setOutros] = useState<JogosOutros | null>(null)
  const [erroDados, setErroDados] = useState<string | null>(null)

  const [form, setForm] = useState<FormPremissas>(FORM_PADRAO)
  const [semente, setSemente] = useState(() => String(novaSemente()))
  const [erros, setErros] = useState<string[]>([])
  const [atual, setAtual] = useState<Atual | null>(null)
  const [falha, setFalha] = useState<ResultadoGeracao | null>(null)
  const { estado, executar, parar } = useGerador()

  useEffect(() => {
    let vivo = true
    void (async () => {
      const [c, v, o] = await Promise.all([carregarConcursos(), carregarViradas(), carregarJogosOutrosBoloes(concursoAlvo)])
      if (!vivo) return
      setErroDados(c.erro ?? v.erro ?? o.erro)
      setHistorico(c.erro ? null : c.concursos)
      setViradas(v.numeros)
      setOutros(o.erro ? null : o.dados)
    })()
    return () => {
      vivo = false
    }
  }, [concursoAlvo])

  const set = <K extends keyof FormPremissas>(k: K) => (v: FormPremissas[K]) => setForm((f) => ({ ...f, [k]: v }))
  const T = (k: keyof FormPremissas, rotulo: string, dica?: string) => <Campo rotulo={rotulo} valor={String(form[k])} onChange={(v) => set(k)(v as never)} dica={dica} />

  const periodo = useMemo(() => {
    const { filtro, erro } = periodoDeForm(form, viradas, hojeIsoSP())
    const hist = historico && filtro ? filtrarPeriodo(historico, filtro) : []
    return { erro, hist }
  }, [form, viradas, historico])

  if (!plano) {
    return (
      <>
        <h1>Gerador de jogos</h1>
        <p className="aviso">
          Ainda não há um plano de bolão. Primeiro simule em <Link to="/simulador">Simulador</Link> e clique em “Usar este plano no gerador de jogos”.
        </p>
      </>
    )
  }

  const ocupado = estado.status === 'gerando'
  const jogosTravados = atual ? atual.jogos.filter((j) => j.travado) : []

  function montarEntrada(): { premissas: ReturnType<typeof deFormPremissas>['premissas']; contexto: { jogosOutrosBoloes: number[][]; historico?: ReturnType<typeof mascarasDe> } } | null {
    const lista: string[] = []
    if (dependeDoPeriodo(form) && periodo.erro) lista.push(periodo.erro)
    const r = deFormPremissas(form, periodo.hist)
    lista.push(...r.erros)
    const sem = Number(semente)
    if (!Number.isInteger(sem) || sem < 0) lista.push('Semente: use um número inteiro (ela permite repetir exatamente a mesma geração).')
    setErros(lista)
    if (lista.length > 0 || !historico) return null
    return {
      premissas: r.premissas,
      contexto: { jogosOutrosBoloes: outros?.jogos ?? [], historico: r.premissas.historico ? mascarasDe(periodo.hist) : undefined },
    }
  }

  function gerar(comNovaSemente: boolean) {
    if (!plano) return
    const m = montarEntrada()
    if (!m) return
    const sem = comNovaSemente ? novaSemente() : Number(semente)
    if (comNovaSemente) setSemente(String(sem))
    setFalha(null)
    executar({ tipo: 'gerar', recibos: plano.recibos, premissas: m.premissas, contexto: m.contexto, semente: sem, fixos: jogosTravados }, (r) => {
      if (r.ok && r.relatorio) setAtual({ jogos: r.jogos, relatorio: r.relatorio, semente: r.semente, premissas: m.premissas })
      else setFalha(r)
    })
  }

  function trocar(indice: number) {
    if (!plano || !atual) return
    const m = montarEntrada()
    if (!m) return
    setFalha(null)
    executar({ tipo: 'regerar', recibos: plano.recibos, premissas: m.premissas, contexto: m.contexto, semente: novaSemente(), jogosAtuais: atual.jogos, indice }, (r) => {
      if (r.ok && r.relatorio) setAtual({ jogos: r.jogos, relatorio: r.relatorio, semente: atual.semente, premissas: m.premissas })
      else setFalha(r)
    })
  }

  function alternarTrava(indice: number) {
    setAtual((a) => (a ? { ...a, jogos: a.jogos.map((j, i) => (i === indice ? { ...j, travado: !j.travado } : j)) } : a))
  }

  async function salvar() {
    if (!plano || !atual) return
    if (nome.trim().length < 2) {
      setErroSalvar('Dê um nome ao bolão.')
      return
    }
    setSalvando(true)
    setErroSalvar(null)
    const r = await salvarRascunho({
      concurso: concursoAlvo,
      nome: nome.trim(),
      plano,
      jogos: atual.jogos,
      semente: atual.semente,
      params,
      vigencia: vigenciaEmUso,
      premissas: atual.premissas,
    })
    setSalvando(false)
    if (r.erro || !r.id) setErroSalvar(r.erro ?? 'Não consegui salvar.')
    else navigate(`/boloes/${r.id}`)
  }

  function sugerirSoma() {
    if (periodo.hist.length === 0) {
      setErros([periodo.erro ?? 'O período escolhido não tem nenhum concurso.'])
      return
    }
    const { min, max } = sugestaoSoma(periodo.hist, plano!.recibos[0].k)
    setForm((f) => ({ ...f, somaMin: String(min), somaMax: String(max) }))
  }

  return (
    <>
      <h1>Gerador de jogos</h1>
      <p className="aviso">{AVISO_RESTRICAO}</p>
      <p className="aviso">Estatística de sorteios passados não aumenta a chance de acerto: todo jogo tem a mesma probabilidade, e cada sorteio é independente.</p>

      {erroDados && <p className="erro">{erroDados}</p>}

      <section className="card">
        <h2>Plano do bolão</h2>
        <p>
          <strong>{plano.n}</strong> cotas · <strong>{plano.recibos.length}</strong> recibo(s):
        </p>
        <ul className="lista-simples">
          {plano.recibos.map((r, i) => (
            <li key={i}>
              Recibo {i + 1}: {descreverRecibo(r)}
            </li>
          ))}
        </ul>
        <p className="muted pequeno">
          Concurso-alvo: <strong>{concursoAlvo}</strong>. <Link to="/simulador">Mudar o plano</Link>
        </p>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <h2>Cruzamento com outros bolões</h2>
        {outros === null ? (
          <p className="muted">Carregando…</p>
        ) : (
          <p>
            Bolões do concurso {concursoAlvo}: <strong>{outros.congelados}</strong> congelado(s) com <strong>{formatarInteiro(outros.jogos.length)}</strong> jogo(s)
            {outros.rascunhos > 0 && ` e ${outros.rascunhos} rascunho(s)`}. As combinações dos congelados <strong>nunca</strong> se repetem aqui.
          </p>
        )}
      </section>

      <h2>Premissas</h2>
      <p className="muted pequeno">Só vale o que estiver marcado. Sem nenhuma, o gerador sorteia livremente (ainda sem repetir combinação de 6 dezenas).</p>

      <Bloco ligado={form.maxIguaisOn} onLigar={set('maxIguaisOn')} titulo="Máx. de números iguais entre jogos">
        {T('maxIguaisN', 'Máximo', 'Com 5, nenhuma combinação de 6 dezenas se repete.')}
        <label className="campo">
          <span>Vale entre</span>
          <select value={form.maxIguaisEscopo} onChange={(e) => set('maxIguaisEscopo')(e.target.value as FormPremissas['maxIguaisEscopo'])}>
            <option value="concurso">todos os jogos do concurso</option>
            <option value="bolao">os jogos deste bolão</option>
            <option value="recibo">os jogos do mesmo recibo</option>
          </select>
        </label>
      </Bloco>
      <Bloco ligado={form.consecOn} onLigar={set('consecOn')} titulo="Máx. de números consecutivos">
        {T('consecMax', 'Maior sequência permitida', 'Ex.: 3 permite 7-8-9, mas não 7-8-9-10.')}
      </Bloco>
      <Bloco ligado={form.paresOn} onLigar={set('paresOn')} titulo="Pares e ímpares">
        {T('paresMin', 'Mínimo de pares')}
        {T('paresMax', 'Máximo de pares')}
      </Bloco>
      <Bloco ligado={form.somaOn} onLigar={set('somaOn')} titulo="Soma das dezenas do jogo">
        {T('somaMin', 'Soma mínima')}
        {T('somaMax', 'Soma máxima')}
        <div>
          <button type="button" className="secundario pequeno" onClick={sugerirSoma}>
            Sugerir pelo histórico (P10 a P90)
          </button>
          <p className="muted pequeno">Usa o período abaixo e o tamanho do 1º recibo ({plano.recibos[0].k} dezenas). Aproximação.</p>
        </div>
      </Bloco>
      <Bloco ligado={form.linhasOn} onLigar={set('linhasOn')} titulo="Linhas do volante">
        {T('linhasMax', 'Máx. de dezenas por linha', 'O volante tem 6 linhas de 10 (1–10, 11–20…).')}
      </Bloco>
      <Bloco ligado={form.obrigOn} onLigar={set('obrigOn')} titulo="Números obrigatórios">
        {T('obrigDezenas', 'Dezenas', 'Ex.: 7, 13, 42')}
        {T('obrigMinJogos', 'Em quantos jogos', '“todos” ou um número (mínimo de jogos com cada uma)')}
      </Bloco>
      <Bloco ligado={form.proibOn} onLigar={set('proibOn')} titulo="Números proibidos">
        {T('proibDezenas', 'Dezenas', 'Ex.: 1, 2, 3')}
      </Bloco>
      <Bloco ligado={form.freqOn} onLigar={set('freqOn')} titulo="Números mais frequentes do período">
        {T('freqX', 'Quantos números', 'As X dezenas mais sorteadas no período abaixo.')}
        <label className="campo">
          <span>Como usar</span>
          <select value={form.freqModo} onChange={(e) => set('freqModo')(e.target.value as FormPremissas['freqModo'])}>
            <option value="ponderar">dar mais chance a elas (ponderar)</option>
            <option value="restringir">usar só elas (restringir)</option>
          </select>
        </label>
        {form.freqModo === 'ponderar' && T('freqPeso', 'Peso', '3 = três vezes mais chance no sorteio do jogo.')}
      </Bloco>
      <Bloco ligado={form.histOn} onLigar={set('histOn')} titulo="Histórico de quinas e quadras do jogo">
        {T('histQuinas', 'Máx. de quinas que o jogo já fez', 'Deixe em branco para não limitar.')}
        {T('histQuadras', 'Máx. de quadras que o jogo já fez', 'Deixe em branco para não limitar.')}
      </Bloco>

      <fieldset className="card" style={{ marginBottom: 10 }}>
        <legend>Período do histórico (usado por “mais frequentes”, “histórico” e pela sugestão de soma)</legend>
        <div className="campos">
          <label className="campo">
            <span>Período</span>
            <select value={form.periodo} onChange={(e) => set('periodo')(e.target.value as TipoPeriodo)}>
              {(Object.keys(NOMES_PERIODO) as TipoPeriodo[]).map((t) => (
                <option key={t} value={t}>
                  {NOMES_PERIODO[t]}
                </option>
              ))}
            </select>
          </label>
          {form.periodo === 'ultimos_anos' && T('periodoAnos', 'Quantos anos')}
          {form.periodo === 'mes' && (
            <label className="campo">
              <span>Mês</span>
              <select value={form.periodoMes} onChange={(e) => set('periodoMes')(e.target.value)}>
                {['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'].map((n, i) => (
                  <option key={n} value={String(i + 1)}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          {form.periodo === 'concursos' && (
            <>
              {T('periodoConcDe', 'Do concurso (vazio = desde o 1º)')}
              {T('periodoConcAte', 'Até o concurso (vazio = o último)')}
            </>
          )}
          {form.periodo === 'datas' && (
            <>
              <label className="campo">
                <span>De</span>
                <input type="date" value={form.periodoDe} onChange={(e) => set('periodoDe')(e.target.value)} />
              </label>
              <label className="campo">
                <span>Até</span>
                <input type="date" value={form.periodoAte} onChange={(e) => set('periodoAte')(e.target.value)} />
              </label>
            </>
          )}
        </div>
        <p className="muted pequeno">{historico === null ? 'Carregando concursos…' : periodo.erro ?? `${formatarInteiro(periodo.hist.length)} concurso(s) no período.`}</p>
      </fieldset>

      <section className="card">
        <label className="campo">
          <span>Semente</span>
          <input value={semente} onChange={(e) => setSemente(e.target.value)} inputMode="numeric" />
          <small className="muted">Com a mesma semente e as mesmas premissas, o gerador repete exatamente os mesmos jogos.</small>
        </label>
        {jogosTravados.length > 0 && <p className="muted pequeno">{jogosTravados.length} jogo(s) travado(s) ficam como estão ao gerar de novo.</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="primario" disabled={ocupado || historico === null} onClick={() => gerar(Boolean(atual))}>
            {atual ? 'Gerar de novo (nova semente)' : 'Gerar jogos'}
          </button>
          {atual && (
            <button type="button" className="secundario" disabled={ocupado || historico === null} onClick={() => gerar(false)}>
              Gerar com esta semente
            </button>
          )}
          {ocupado && (
            <button type="button" className="secundario" onClick={parar}>
              Cancelar
            </button>
          )}
        </div>
        {ocupado && (
          <p>
            <progress value={estado.fracao} max={1} /> Gerando… {Math.round(estado.fracao * 100)}%
          </p>
        )}
        {estado.status === 'erro' && <p className="erro">{estado.erro}</p>}
        {erros.length > 0 && (
          <ul className="erro">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </section>

      {falha && !falha.ok && (
        <section className="card" style={{ marginTop: 12 }}>
          <h2>Não foi possível gerar com estas premissas</h2>
          <p className="erro">{falha.motivo}</p>
          {falha.diagnostico && (
            <>
              <p className="aviso">{falha.diagnostico.aviso}</p>
              <div className="tabela-rolavel">
                <table>
                  <thead>
                    <tr>
                      <th>Premissa</th>
                      <th>Jogos que passam sozinha</th>
                      <th>Funciona sem ela?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {falha.diagnostico.taxas.map((t) => (
                      <tr key={t.chave}>
                        <td>
                          {t.nome}
                          {falha.diagnostico!.culpadas.includes(t.chave) && <span className="tag">trava</span>}
                        </td>
                        <td>{t.taxaAceitacao === null ? '—' : `${(t.taxaAceitacao * 100).toFixed(1).replace('.', ',')}%`}</td>
                        <td>{t.viavelSemEla ? 'sim' : 'não'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {atual && <Resultado plano={plano} atual={atual} ocupado={ocupado} aoTrocar={trocar} aoTravar={alternarTrava} />}
      {atual && (
        <section className="card" style={{ marginTop: 12 }}>
          <h2>Salvar o bolão</h2>
          <p className="muted pequeno">Salva como <strong>rascunho</strong>: ainda dá para apagar. Para valer, depois você congela na tela Bolões.</p>
          <label className="campo">
            <span>Nome do bolão</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <button type="button" className="primario" disabled={ocupado || salvando} onClick={() => void salvar()}>
            {salvando ? 'Salvando…' : 'Salvar como rascunho'}
          </button>
          {erroSalvar && <p className="erro">{erroSalvar}</p>}
        </section>
      )}
    </>
  )
}

function Resultado({ plano, atual, ocupado, aoTrocar, aoTravar }: { plano: PlanoBolao; atual: Atual; ocupado: boolean; aoTrocar: (i: number) => void; aoTravar: (i: number) => void }) {
  const r = atual.relatorio
  return (
    <>
      <h2>Relatório</h2>
      <section className="card">
        <ul className="lista-simples">
          <li>
            Combinações de 6 dezenas: <strong>{formatarInteiro(r.combinacoesDistintas)}</strong> distintas de {formatarInteiro(r.combinacoesEsperadas)} esperadas
          </li>
          <li className={r.repetidas === 0 ? 'ok' : 'erro'}>Repetidas dentro do bolão: {formatarInteiro(r.repetidas)} {r.repetidas === 0 ? '✓' : '(precisa ser 0)'}</li>
          <li className={r.repetidasComOutrosBoloes === 0 ? 'ok' : 'erro'}>
            Repetidas com outros bolões: {formatarInteiro(r.repetidasComOutrosBoloes)} {r.repetidasComOutrosBoloes === 0 ? '✓' : '(precisa ser 0)'}
          </li>
          <li>Maior sobreposição entre dois jogos: {r.sobreposicaoMaxima} dezenas iguais</li>
          <li>Maior sobreposição com jogos de outros bolões: {r.sobreposicaoMaximaComOutros} dezenas iguais</li>
          <li>Chance de sena do bolão inteiro: 1 em <strong>{formatarInteiro(Math.round(r.senaUmEm))}</strong></li>
          <li className="muted pequeno">Semente: {atual.semente}</li>
        </ul>
        {r.avisos.length > 0 && (
          <ul className="aviso">
            {r.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </section>

      <h2>Jogos</h2>
      {plano.recibos.map((rec, ri) => (
        <section className="card" key={ri} style={{ marginBottom: 12 }}>
          <h2>
            Recibo {ri + 1}: {descreverRecibo(rec)}
          </h2>
          <ul className="lista-simples">
            {atual.jogos.map((j, gi) =>
              j.recibo !== ri ? null : (
                <li key={gi} style={{ padding: '8px 0', borderBottom: '1px solid var(--borda)' }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{j.dezenas.map(dezenaTexto).join(' ')}</strong>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="checkbox" checked={j.travado} onChange={() => aoTravar(gi)} style={{ width: 20, minHeight: 20 }} />
                      Travar
                    </label>
                    <button type="button" className="secundario pequeno" disabled={ocupado || j.travado} onClick={() => aoTrocar(gi)}>
                      Trocar este jogo
                    </button>
                  </div>
                  {r.porJogo[gi]?.premissas.some((p) => !p.ok) && (
                    <p className="aviso pequeno">Não atende: {r.porJogo[gi].premissas.filter((p) => !p.ok).map((p) => p.nome).join(', ')}</p>
                  )}
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
    </>
  )
}
