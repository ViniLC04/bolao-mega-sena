import { useMemo, useState } from 'react'
import { useEffect } from 'react'
import { carregarConcursos, type ConcursoResumo } from '../../data/concursos'
import { carregarViradasPublicas } from '../../data/publico'
import { distribuicaoConsecutivos, distribuicaoMaxPorLinha, distribuicaoPares, resumoSoma, totaisPorLinha } from '../../engine/estatisticas'
import { atrasos, filtrarPeriodo, frequencias } from '../../engine/historico'
import { formatarDataIso, formatarInteiro, formatarPct, hojeIsoSP } from '../formato'
import { FORM_PADRAO, NOMES_PERIODO, periodoDeForm, type FormPremissas, type TipoPeriodo } from '../premissasForm'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
type Ordem = 'dezena' | 'frequencia' | 'atraso'

function Barra({ valor, maximo }: { valor: number; maximo: number }) {
  return (
    <div style={{ background: 'var(--borda)', borderRadius: 4, height: 10, minWidth: 80 }} aria-hidden="true">
      <div style={{ background: 'var(--acento)', borderRadius: 4, height: 10, width: `${maximo > 0 ? (valor / maximo) * 100 : 0}%` }} />
    </div>
  )
}

/** Estatísticas de sorteios passados (pública, somente leitura). Sempre com o aviso de que NÃO aumentam a chance. */
export function Estatisticas() {
  const [concursos, setConcursos] = useState<ConcursoResumo[] | null>(null)
  const [viradas, setViradas] = useState<number[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [form, setForm] = useState<FormPremissas>(FORM_PADRAO)
  const [ordem, setOrdem] = useState<Ordem>('frequencia')

  useEffect(() => {
    let vivo = true
    void Promise.all([carregarConcursos(), carregarViradasPublicas()]).then(([c, v]) => {
      if (!vivo) return
      setConcursos(c.erro ? null : c.concursos)
      setErro(c.erro)
      setViradas(v)
    })
    return () => {
      vivo = false
    }
  }, [])

  const periodo = useMemo(() => {
    const { filtro, erro: e } = periodoDeForm(form, viradas, hojeIsoSP())
    return { erro: e, lista: concursos && filtro ? filtrarPeriodo(concursos, filtro) : [] }
  }, [form, viradas, concursos])

  const stats = useMemo(() => {
    const l = periodo.lista
    const f = frequencias(l)
    const a = atrasos(l)
    return {
      freq: f,
      atraso: a,
      pares: distribuicaoPares(l),
      consecutivos: distribuicaoConsecutivos(l),
      linhas: totaisPorLinha(l),
      maxLinha: distribuicaoMaxPorLinha(l),
      soma: resumoSoma(l),
    }
  }, [periodo.lista])

  const n = periodo.lista.length
  const dezenas = Array.from({ length: 60 }, (_, i) => i + 1).sort((x, y) =>
    ordem === 'dezena' ? x - y : ordem === 'frequencia' ? stats.freq[y] - stats.freq[x] || x - y : stats.atraso[y] - stats.atraso[x] || x - y,
  )
  const maxFreq = Math.max(...stats.freq.slice(1), 1)
  const ordenados = [...periodo.lista].sort((x, y) => x.numero - y.numero)
  const set = <K extends keyof FormPremissas>(k: K, v: FormPremissas[K]) => setForm((f) => ({ ...f, [k]: v }))

  const pct = (v: number) => formatarPct(n > 0 ? v / n : 0, 1)

  return (
    <div>
      <h1>Estatísticas</h1>
      <p className="aviso">
        <strong>Estatísticas de sorteios passados não aumentam a probabilidade de acerto.</strong> Cada sorteio é independente e todo conjunto de 6 dezenas tem a mesma chance. Aqui só se descreve o que já aconteceu.
      </p>
      {erro && <p className="erro">{erro}</p>}

      <fieldset className="card">
        <legend>Período</legend>
        <div className="campos">
          <label className="campo">
            <span>Quais concursos</span>
            <select value={form.periodo} onChange={(e) => set('periodo', e.target.value as TipoPeriodo)}>
              {(Object.keys(NOMES_PERIODO) as TipoPeriodo[]).map((t) => (
                <option key={t} value={t}>
                  {NOMES_PERIODO[t]}
                </option>
              ))}
            </select>
          </label>
          {form.periodo === 'ultimos_anos' && (
            <label className="campo">
              <span>Quantos anos</span>
              <input value={form.periodoAnos} onChange={(e) => set('periodoAnos', e.target.value)} inputMode="numeric" />
            </label>
          )}
          {form.periodo === 'mes' && (
            <label className="campo">
              <span>Mês</span>
              <select value={form.periodoMes} onChange={(e) => set('periodoMes', e.target.value)}>
                {MESES.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          )}
          {form.periodo === 'concursos' && (
            <>
              <label className="campo">
                <span>Do concurso</span>
                <input value={form.periodoConcDe} onChange={(e) => set('periodoConcDe', e.target.value)} inputMode="numeric" />
              </label>
              <label className="campo">
                <span>Até o concurso</span>
                <input value={form.periodoConcAte} onChange={(e) => set('periodoConcAte', e.target.value)} inputMode="numeric" />
              </label>
            </>
          )}
          {form.periodo === 'datas' && (
            <>
              <label className="campo">
                <span>De</span>
                <input type="date" value={form.periodoDe} onChange={(e) => set('periodoDe', e.target.value)} />
              </label>
              <label className="campo">
                <span>Até</span>
                <input type="date" value={form.periodoAte} onChange={(e) => set('periodoAte', e.target.value)} />
              </label>
            </>
          )}
        </div>
        <p className="muted pequeno">
          {concursos === null ? 'Carregando concursos…' : periodo.erro ?? (n === 0 ? 'Nenhum concurso neste período.' : `${formatarInteiro(n)} concurso(s), de ${formatarDataIso(ordenados[0].data)} a ${formatarDataIso(ordenados[n - 1].data)}.`)}
        </p>
      </fieldset>

      {n > 0 && (
        <>
          <h2>Frequência e atraso de cada dezena</h2>
          <label className="campo" style={{ maxWidth: 280 }}>
            <span>Ordenar por</span>
            <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
              <option value="frequencia">mais sorteadas primeiro</option>
              <option value="atraso">mais atrasadas primeiro</option>
              <option value="dezena">número da dezena</option>
            </select>
          </label>
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Dezena</th>
                  <th>Vezes</th>
                  <th />
                  <th>Atraso</th>
                </tr>
              </thead>
              <tbody>
                {dezenas.map((d) => (
                  <tr key={d}>
                    <td>
                      <strong>{String(d).padStart(2, '0')}</strong>
                    </td>
                    <td>
                      {formatarInteiro(stats.freq[d])} <span className="muted pequeno">({pct(stats.freq[d] * 1)} dos sorteios)</span>
                    </td>
                    <td>
                      <Barra valor={stats.freq[d]} maximo={maxFreq} />
                    </td>
                    <td>{stats.atraso[d] === 0 ? 'saiu no último' : `${formatarInteiro(stats.atraso[d])} concurso(s)`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Pares e ímpares</h2>
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Pares / ímpares</th>
                  <th>Sorteios</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {stats.pares.map((v, p) => (
                  <tr key={p}>
                    <td>
                      {p} par(es) · {6 - p} ímpar(es)
                    </td>
                    <td>
                      {formatarInteiro(v)} ({pct(v)})
                    </td>
                    <td>
                      <Barra valor={v} maximo={Math.max(...stats.pares, 1)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {stats.soma && (
            <>
              <h2>Soma das 6 dezenas</h2>
              <ul className="lista-simples">
                <li>
                  Mínima: <strong>{stats.soma.min}</strong> · máxima: <strong>{stats.soma.max}</strong>
                </li>
                <li>
                  Faixa central (P10 a P90): <strong>{Math.round(stats.soma.p10)}</strong> a <strong>{Math.round(stats.soma.p90)}</strong> · mediana: {Math.round(stats.soma.mediana)} · média: {stats.soma.media.toFixed(1).replace('.', ',')}
                </li>
              </ul>
            </>
          )}

          <h2>Linhas do volante</h2>
          <p className="muted pequeno">O volante tem 6 linhas de 10 dezenas (1–10, 11–20, …).</p>
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Dezenas sorteadas nela</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {stats.linhas.map((v, i) => (
                  <tr key={i}>
                    <td>
                      {i * 10 + 1}–{i * 10 + 10}
                    </td>
                    <td>
                      {formatarInteiro(v)} <span className="muted pequeno">({formatarPct(v / (n * 6), 1)})</span>
                    </td>
                    <td>
                      <Barra valor={v} maximo={Math.max(...stats.linhas, 1)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted pequeno">
            Mais dezenas numa mesma linha no sorteio:{' '}
            {stats.maxLinha.map((v, m) => (m === 0 ? null : <span key={m}>{m}: {pct(v)}{m < 6 ? ' · ' : ''}</span>))}
          </p>

          <h2>Consecutivos</h2>
          <p className="muted pequeno">Maior sequência de números seguidos no sorteio (ex.: 7-8-9 = 3).</p>
          <ul className="lista-simples">
            {stats.consecutivos.map((v, m) => (m === 0 ? null : <li key={m}>{m === 1 ? 'Nenhum consecutivo' : `Sequência de ${m}`}: {formatarInteiro(v)} sorteio(s) ({pct(v)})</li>))}
          </ul>
        </>
      )}
    </div>
  )
}
