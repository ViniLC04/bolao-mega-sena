import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { carregarConcursoCompleto, NOMES_STATUS, type ConcursoCompleto } from '../data/concursos'
import { conferirBolao, valorDoParticipante } from '../engine/conferencia'
import { formatarDataHoraSP, formatarDataIso, formatarInteiro, formatarReais } from './formato'
import { useRegras } from './regras'

export interface JogoParaConferir {
  /** posição do recibo (0, 1, …) */
  recibo: number
  dezenas: number[]
}

export interface ParticipanteConferencia {
  nome: string
  qtd: number
}

const d2 = (d: number) => String(d).padStart(2, '0')

/**
 * Conferência do bolão contra um concurso: acertos por jogo, bruto/IR/líquido por recibo e valor por cota, SEMPRE com
 * o rateio oficial do banco. Pode ser testada com qualquer concurso já sorteado: aí vira "simulação".
 * `participantes` só é passado na tela do ADM (a página pública nunca recebe nomes).
 */
export function ConferenciaBolao({
  jogos,
  nCotas,
  concursoAlvo,
  participantes,
}: {
  jogos: JogoParaConferir[]
  nCotas: number
  concursoAlvo: number
  participantes?: ParticipanteConferencia[]
}) {
  const { params } = useRegras()
  const [numero, setNumero] = useState(String(concursoAlvo))
  const [consultado, setConsultado] = useState(concursoAlvo)
  const [concurso, setConcurso] = useState<ConcursoCompleto | null | undefined>(undefined)
  const [erro, setErro] = useState<string | null>(null)
  // Cada clique em "Conferir" soma 1: assim a consulta roda de novo mesmo que o número seja o mesmo de antes.
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let vivo = true
    void carregarConcursoCompleto(consultado).then((r) => {
      if (!vivo) return
      setConcurso(r.concurso)
      setErro(r.erro)
    })
    return () => {
      vivo = false
    }
  }, [consultado, tentativa])

  const recibos = useMemo(() => {
    const ordens = [...new Set(jogos.map((j) => j.recibo))].sort((a, b) => a - b)
    return ordens.map((o) => ({ ordem: o, jogos: jogos.filter((j) => j.recibo === o).map((j) => j.dezenas) }))
  }, [jogos])

  const conferido = useMemo(() => {
    if (!concurso) return null
    const f = (n: 4 | 5 | 6) => concurso.faixas.find((x) => x.faixa === n)
    if (!f(4) || !f(5) || !f(6)) return null
    return conferirBolao(recibos, concurso.dezenas, { senaCent: f(6)!.valor_cent, quinaCent: f(5)!.valor_cent, quadraCent: f(4)!.valor_cent }, nCotas, params)
  }, [concurso, recibos, nCotas, params])

  function consultar() {
    const n = Number(numero)
    if (!Number.isInteger(n) || n < 1) return setErro('Informe o número do concurso (inteiro).')
    setErro(null)
    setConcurso(undefined)
    setConsultado(n)
    setTentativa((t) => t + 1)
  }

  const simulacao = consultado !== concursoAlvo

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h2 style={{ color: 'inherit', fontSize: '1.15rem' }}>Conferência</h2>
      <p className="muted pequeno">
        Compara os jogos com o resultado de um concurso. Os valores usam o <strong>rateio oficial da Caixa</strong> (nunca estimativa). Para ensaiar, escolha um concurso que já foi sorteado.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <label className="campo" style={{ margin: 0 }}>
          <span>Concurso</span>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="numeric" style={{ maxWidth: 140 }} />
        </label>
        <button type="button" className="secundario" onClick={consultar}>
          Conferir
        </button>
        {simulacao && (
          <button
            type="button"
            className="secundario"
            onClick={() => {
              setNumero(String(concursoAlvo))
              setConsultado(concursoAlvo)
              setConcurso(undefined)
              setErro(null)
              setTentativa((t) => t + 1)
            }}
          >
            Voltar ao concurso {concursoAlvo}
          </button>
        )}
      </div>

      {erro && <p className="erro">{erro}</p>}
      {concurso === undefined && !erro && <p className="muted">Carregando…</p>}
      {concurso === null && (
        <p className="aviso">
          O concurso {consultado} ainda não está no banco{consultado === concursoAlvo ? ' (talvez ainda não tenha sido sorteado)' : ''}. Quando sair, atualize a lista em <Link to="/fontes">Fontes</Link> e volte aqui.
        </p>
      )}

      {concurso && (
        <>
          {simulacao && (
            <p className="aviso">
              <strong>SIMULAÇÃO:</strong> este é o concurso {concurso.numero}, não o concurso-alvo ({concursoAlvo}) do bolão. Serve só para ver como os jogos teriam ido.
            </p>
          )}
          <p>
            Concurso <strong>{concurso.numero}</strong> ({formatarDataIso(concurso.data)}):{' '}
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{[...concurso.dezenas].sort((a, b) => a - b).map(d2).join(' ')}</strong>
          </p>
          <p className="muted pequeno">
            {concurso.fonte}, obtido em {formatarDataHoraSP(concurso.obtido_em)} · situação: <strong>{NOMES_STATUS[concurso.status]}</strong>
            {concurso.status === 'aguardando' && ' (os valores podem mudar até o organizador confirmar)'}
          </p>

          {!conferido ? (
            <p className="aviso">Este concurso ainda não tem o rateio oficial completo no banco, então não afirmo valores.</p>
          ) : (
            <>
              <p className={conferido.ganhou ? 'ok' : undefined} style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                {conferido.ganhou ? 'O bolão ganhou prêmio!' : 'O bolão não ganhou prêmio neste concurso.'}
              </p>
              <ul className="lista-simples">
                <li>
                  Melhor jogo: <strong>{conferido.melhorAcerto}</strong> acerto(s)
                </li>
                <li>
                  Apostas simples premiadas: {formatarInteiro(conferido.apostasPremiadas.sena)} sena · {formatarInteiro(conferido.apostasPremiadas.quina)} quina · {formatarInteiro(conferido.apostasPremiadas.quadra)} quadra
                </li>
                <li>
                  Prêmio bruto: <strong>{formatarReais(conferido.brutoCent)}</strong> · imposto de renda: {formatarReais(conferido.irCent)} · líquido: <strong>{formatarReais(conferido.liquidoCent)}</strong>
                </li>
                <li>
                  Valor líquido por cota (N = {nCotas}): <strong>{formatarReais(conferido.porCotaCent)}</strong> <span className="muted pequeno">(arredondado para baixo; sobra {formatarReais(conferido.restoCaixinhaCent)} para a caixinha)</span>
                </li>
              </ul>

              <h2 style={{ fontSize: '1rem' }}>Por recibo</h2>
              <div className="tabela-rolavel">
                <table>
                  <thead>
                    <tr>
                      <th>Recibo</th>
                      <th>Acertos de cada jogo</th>
                      <th>Bruto</th>
                      <th>Líquido</th>
                      <th>Por cota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conferido.recibos.map((r, i) => (
                      <tr key={i}>
                        <td>
                          {i + 1}: {r.jogos} jogo(s) de {r.k} dezenas
                        </td>
                        <td>{r.acertosPorJogo.join(' · ')}</td>
                        <td>{formatarReais(r.brutoCent)}</td>
                        <td>{formatarReais(r.liquidoCent)}</td>
                        <td>{formatarReais(r.porCotaCent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <details style={{ marginTop: 10 }}>
                <summary>Ver os jogos com os acertos marcados</summary>
                {recibos.map((rc, ri) => (
                  <div key={ri} style={{ marginTop: 8 }}>
                    <strong>Recibo {ri + 1}</strong>
                    <ul className="lista-simples">
                      {rc.jogos.map((j, ji) => (
                        <li key={ji} style={{ fontVariantNumeric: 'tabular-nums', padding: '2px 0' }}>
                          {[...j].sort((a, b) => a - b).map((d) => (
                            <span key={d} style={concurso.dezenas.includes(d) ? { fontWeight: 800, color: 'var(--ok)' } : undefined}>
                              {d2(d)}{' '}
                            </span>
                          ))}
                          <span className="muted pequeno">({conferido.recibos[ri].acertosPorJogo[ji]} acertos)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </details>

              {participantes && participantes.length > 0 && (
                <>
                  <h2 style={{ fontSize: '1rem' }}>Por participante (só você vê)</h2>
                  <div className="tabela-rolavel">
                    <table>
                      <thead>
                        <tr>
                          <th>Participante</th>
                          <th>Cotas</th>
                          <th>Valor líquido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participantes.map((p) => (
                          <tr key={p.nome}>
                            <td>{p.nome}</td>
                            <td>{p.qtd}</td>
                            <td>{formatarReais(valorDoParticipante(p.qtd, conferido))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
