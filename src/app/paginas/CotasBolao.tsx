import { useCallback, useEffect, useState } from 'react'
import {
  alterarQtdCota,
  criarParticipante,
  definirPagas,
  incluirCota,
  linkDoComprovante,
  lancarCaixinha,
  listarCaixinha,
  listarCotas,
  listarParticipantes,
  marcarCota,
  removerCota,
  removerLancamento,
  type CotaLinha,
  type MovCaixinha,
  type Participante,
} from '../../data/participantes'
import type { BolaoLinha } from '../../data/boloes'
import { caixinha, resumoCotas, validarQtdCotas, valorDevido } from '../../engine/cotas'
import { contagemRegressiva, formatarDataHoraSP, formatarInteiro, formatarReais, parseReais } from '../formato'
import { useRegras } from '../regras'

function cotaCobrada(b: BolaoLinha): number | null {
  const v = (b.regras_snapshot as { plano?: { cotaCobradaCent?: unknown } } | null)?.plano?.cotaCobradaCent
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v
  // bolão aberto (ainda sem plano): o valor da cota é o que foi combinado na criação
  return b.cota_base_cent !== null && b.cota_base_cent > 0 ? b.cota_base_cent : null
}

export function CotasBolao({ bolao, custoCent }: { bolao: BolaoLinha; custoCent: number }) {
  const { params } = useRegras()
  const cota = cotaCobrada(bolao)
  const [agora] = useState(() => Date.now())
  const [cotas, setCotas] = useState<CotaLinha[]>([])
  const [pessoas, setPessoas] = useState<Participante[]>([])
  const [mov, setMov] = useState<MovCaixinha[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)

  const [pessoaSel, setPessoaSel] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [qtd, setQtd] = useState('1')

  const [tipoMov, setTipoMov] = useState<'entrada' | 'saida'>('entrada')
  const [valorMov, setValorMov] = useState('')
  const [motivoMov, setMotivoMov] = useState('')

  const recarregar = useCallback(async () => {
    const [c, p, m] = await Promise.all([listarCotas(bolao.id), listarParticipantes(), listarCaixinha(bolao.id)])
    setCotas(c.lista)
    setPessoas(p.lista)
    setMov(m.lista)
    setErro(c.erro ?? p.erro ?? m.erro)
    setCarregando(false)
  }, [bolao.id])

  useEffect(() => {
    let vivo = true
    void Promise.all([listarCotas(bolao.id), listarParticipantes(), listarCaixinha(bolao.id)]).then(([c, p, m]) => {
      if (!vivo) return
      setCotas(c.lista)
      setPessoas(p.lista)
      setMov(m.lista)
      setErro(c.erro ?? p.erro ?? m.erro)
      setCarregando(false)
    })
    return () => {
      vivo = false
    }
  }, [bolao.id])

  const resumo = resumoCotas(
    cotas.map((c) => ({ qtd: c.qtd, valorDevidoCent: c.valor_devido_cent, qtdPaga: c.qtd_paga, viaEntregue: c.via_entregue })),
    bolao.n_cotas ?? 0,
  )
  const aberto = bolao.n_cotas === null // inscrições abertas: ainda não existe N
  const k = cota !== null && bolao.n_cotas !== null && custoCent > 0 ? caixinha(bolao.n_cotas, cota, custoCent, mov.map((m) => m.valor_cent)) : null
  const inscricoesEncerradas = bolao.status === 'aberto' && bolao.inscricoes_ate !== null && agora > Date.parse(bolao.inscricoes_ate)
  const encerrado = contagemRegressiva(params.data_limite_aposta, agora).encerrado || inscricoesEncerradas
  const jaTem = new Set(cotas.map((c) => c.participante_id))

  async function incluir() {
    if (cota === null) return
    const q = Number(qtd)
    const e = aberto ? (Number.isInteger(q) && q >= 1 ? null : 'A quantidade de cotas deve ser um número inteiro, de 1 em diante.') : validarQtdCotas(q, resumo.vendidas, bolao.n_cotas ?? 0)
    if (e) return setErro(e)
    setOcupado(true)
    setErro(null)
    let id = pessoaSel
    if (id === '' || id === 'novo') {
      if (novoNome.trim() === '') {
        setOcupado(false)
        return setErro('Escolha um participante ou escreva o nome de um novo.')
      }
      const r = await criarParticipante(novoNome, '')
      if (r.erro || !r.participante) {
        setOcupado(false)
        return setErro(r.erro)
      }
      id = r.participante.id
    }
    const e2 = await incluirCota(id, bolao.id, q, valorDevido(q, cota))
    setOcupado(false)
    if (e2) setErro(e2)
    else {
      setPessoaSel('')
      setNovoNome('')
      setQtd('1')
      await recarregar()
    }
  }

  async function marcar(c: CotaLinha, campo: 'via_entregue') {
    setErro(null)
    const e = await marcarCota(c.id, campo, !c[campo])
    if (e) setErro(e)
    else await recarregar()
  }

  async function definir(c: CotaLinha, qtdPaga: number) {
    if (qtdPaga === 0 && !window.confirm(`Desfazer a confirmação de pagamento de ${c.participantes?.nome ?? 'esta pessoa'}?`)) return
    setErro(null)
    const e = await definirPagas(c.id, qtdPaga)
    if (e) setErro(e)
    else await recarregar()
  }

  async function mudarQtd(c: CotaLinha) {
    if (cota === null) return
    const t = window.prompt(`Nova quantidade de cotas de ${c.participantes?.nome ?? 'esta pessoa'} (hoje ${c.qtd}):`, String(c.qtd))
    if (t === null) return
    const n = Number(t)
    if (!Number.isInteger(n) || n < 1) return setErro('Informe um número inteiro de cotas, de 1 em diante. Para tirar a pessoa, use Remover.')
    if (n === c.qtd) return
    setErro(null)
    const e = await alterarQtdCota({ id: c.id, qtdPaga: c.qtd_paga }, n, cota)
    if (e) setErro(e)
    else await recarregar()
  }

  async function verComprovante(caminho: string) {
    setErro(null)
    const r = await linkDoComprovante(caminho)
    if (r.erro || !r.url) return setErro(r.erro)
    window.open(r.url, '_blank', 'noopener')
  }

  async function remover(c: CotaLinha) {
    if (!window.confirm(`Remover as ${c.qtd} cota(s) de ${c.participantes?.nome ?? 'esta pessoa'}?`)) return
    setErro(null)
    const e = await removerCota(c.id)
    if (e) setErro(e)
    else await recarregar()
  }

  async function lancar() {
    const v = parseReais(valorMov)
    if (v === null || v <= 0) return setErro('Informe o valor em R$ (ex.: 10,50).')
    if (motivoMov.trim() === '') return setErro('Escreva o motivo do lançamento.')
    setErro(null)
    const e = await lancarCaixinha(bolao.id, tipoMov === 'entrada' ? v : -v, motivoMov)
    if (e) setErro(e)
    else {
      setValorMov('')
      setMotivoMov('')
      await recarregar()
    }
  }

  async function tirar(m: MovCaixinha) {
    if (!window.confirm('Remover este lançamento da caixinha?')) return
    const e = await removerLancamento(m.id)
    if (e) setErro(e)
    else await recarregar()
  }

  if (carregando) return <p className="muted">Carregando cotas…</p>

  return (
    <>
      <h2>Cotas e pagamentos</h2>
      {erro && <p className="erro">{erro}</p>}
      {cota === null && <p className="aviso">Este bolão não tem o valor da cota guardado, então não dá para lançar cotas aqui.</p>}

      <div className="grade">
        <section className="card">
          <h2>Cotas vendidas</h2>
          <p className="grande">{aberto ? formatarInteiro(resumo.vendidas) : `${formatarInteiro(resumo.vendidas)} de ${formatarInteiro(resumo.nCotas)}`}</p>
          <p className="muted pequeno">{aberto ? 'sem limite enquanto as inscrições estão abertas' : `${formatarInteiro(resumo.livres)} livre(s)`}</p>
        </section>
        <section className="card">
          <h2>Pagas</h2>
          <p className="grande">{formatarInteiro(resumo.pagas)}</p>
          <p className="muted pequeno">{formatarInteiro(resumo.naoPagas)} ainda sem pagar</p>
        </section>
        <section className="card">
          <h2>Arrecadado</h2>
          <p className="grande">{formatarReais(resumo.arrecadadoCent)}</p>
          <p className="muted pequeno">falta receber {formatarReais(resumo.aReceberCent)}</p>
        </section>
        <section className="card">
          <h2>Vias entregues</h2>
          <p className="grande">{formatarInteiro(resumo.viasEntregues)}</p>
          <p className="muted pequeno">de {formatarInteiro(resumo.vendidas)} cota(s) vendidas</p>
        </section>
      </div>

      {cota !== null && (
        <p className="muted pequeno">
          Valor por cota: <strong>{formatarReais(cota)}</strong>. Prazo para novas cotas: <strong>{formatarDataHoraSP(params.data_limite_aposta)}</strong> (Brasília).
        </p>
      )}
      {inscricoesEncerradas && <p className="aviso">O prazo de inscrição deste bolão terminou. Para incluir mais cotas, mude a data de inscrição no quadro de cima; ou feche as inscrições.</p>}
      {!inscricoesEncerradas && encerrado && <p className="aviso">O prazo das apostas encerrou. Para incluir cotas, prorrogue a data limite em Regras (nova versão).</p>}

      {cota !== null && (
        <section className="card" style={{ marginTop: 12 }}>
          <h2>Incluir cotas</h2>
          <div className="campos">
            <label className="campo">
              <span>Participante</span>
              <select value={pessoaSel} onChange={(e) => setPessoaSel(e.target.value)}>
                <option value="">— escolher —</option>
                {pessoas.map((p) => (
                  <option key={p.id} value={p.id} disabled={jaTem.has(p.id)}>
                    {p.nome}
                    {jaTem.has(p.id) ? ' (já tem cotas)' : ''}
                  </option>
                ))}
                <option value="novo">+ Novo participante…</option>
              </select>
            </label>
            {(pessoaSel === 'novo' || (pessoaSel === '' && pessoas.length === 0)) && (
              <label className="campo">
                <span>Nome do novo participante</span>
                <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} maxLength={120} />
              </label>
            )}
            <label className="campo">
              <span>Quantidade de cotas</span>
              <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="numeric" />
            </label>
          </div>
          <p className="muted pequeno">
            Valor devido: <strong>{Number.isInteger(Number(qtd)) && Number(qtd) > 0 ? formatarReais(valorDevido(Number(qtd), cota)) : '—'}</strong>
          </p>
          <button type="button" className="primario" disabled={ocupado || encerrado || (!aberto && resumo.livres === 0)} onClick={() => void incluir()}>
            Incluir cotas
          </button>
        </section>
      )}

      {resumo.pessoasPendentes > 0 && (
        <p className="aviso">
          <strong>Aguardando pagamento: {resumo.pessoasPendentes} pessoa(s)</strong>, {formatarInteiro(resumo.naoPagas)} cota(s), {formatarReais(resumo.aReceberCent)}. Confira no seu banco e clique em <strong>Confirmar pagamento</strong>.
        </p>
      )}

      {cotas.length > 0 && (
        <div className="tabela-rolavel" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Participante</th>
                <th>Cotas</th>
                <th>Pagamento</th>
                <th>Comprovante</th>
                <th>Via entregue</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cotas.map((c) => {
                const nome = c.participantes?.nome ?? '—'
                const falta = c.qtd - c.qtd_paga
                return (
                  <tr key={c.id}>
                    <td>
                      {nome}
                      {c.origem === 'link' && <span className="tag" title="A própria pessoa se inscreveu pelo link do bolão">pelo link</span>}
                      {c.participantes?.contato && <div className="muted pequeno">{c.participantes.contato}</div>}
                    </td>
                    <td>
                      {c.qtd}
                      <div className="muted pequeno">{formatarReais(c.valor_devido_cent)}</div>
                      <button type="button" className="secundario pequeno" onClick={() => void mudarQtd(c)}>
                        Alterar
                      </button>
                    </td>
                    <td>
                      {falta === 0 ? (
                        <span className="ok">✓ pagas ({c.qtd})</span>
                      ) : (
                        <>
                          <strong>{c.qtd_paga} de {c.qtd}</strong> pagas
                          <div className="muted pequeno">falta {formatarReais(falta * (cota ?? 0))}</div>
                        </>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        {falta > 0 && (
                          <button type="button" className="primario pequeno" onClick={() => void definir(c, c.qtd)}>
                            Confirmar pagamento
                          </button>
                        )}
                        {c.qtd_paga > 0 && (
                          <button type="button" className="secundario pequeno" onClick={() => void definir(c, 0)}>
                            Desfazer
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      {c.comprovantes.length === 0 ? (
                        <span className="muted pequeno">—</span>
                      ) : (
                        c.comprovantes.map((cp, i) => (
                          <div key={cp.id}>
                            <button type="button" className="secundario pequeno" onClick={() => void verComprovante(cp.caminho)}>
                              Ver {c.comprovantes.length > 1 ? i + 1 : ''}
                            </button>
                          </div>
                        ))
                      )}
                    </td>
                    <td>
                      <input type="checkbox" checked={c.via_entregue} onChange={() => void marcar(c, 'via_entregue')} aria-label={`Via entregue: ${nome}`} style={{ width: 22, minHeight: 22 }} />
                    </td>
                    <td>
                      <button type="button" className="secundario pequeno" onClick={() => void remover(c)}>
                        Remover
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2>Caixinha</h2>
      {k && (
        <section className="card">
          <ul className="lista-simples">
            <li>
              Sobra prevista do arredondamento da cota ({formatarInteiro(bolao.n_cotas ?? 0)} ×{formatarReais(cota!)} − {formatarReais(custoCent)}): <strong>{formatarReais(k.sobraPrevistaCent)}</strong>
            </li>
            <li>
              Lançamentos manuais: <strong>{formatarReais(k.movimentosCent)}</strong>
            </li>
            <li>
              Saldo da caixinha: <strong>{formatarReais(k.saldoCent)}</strong>
            </li>
          </ul>
        </section>
      )}
      <section className="card" style={{ marginTop: 12 }}>
        <h2>Novo lançamento</h2>
        <div className="campos">
          <label className="campo">
            <span>Tipo</span>
            <select value={tipoMov} onChange={(e) => setTipoMov(e.target.value as 'entrada' | 'saida')}>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </label>
          <label className="campo">
            <span>Valor (R$)</span>
            <input value={valorMov} onChange={(e) => setValorMov(e.target.value)} inputMode="decimal" placeholder="10,50" />
          </label>
          <label className="campo">
            <span>Motivo</span>
            <input value={motivoMov} onChange={(e) => setMotivoMov(e.target.value)} maxLength={200} />
          </label>
        </div>
        <button type="button" className="secundario" onClick={() => void lancar()}>
          Lançar
        </button>
      </section>
      {mov.length > 0 && (
        <div className="tabela-rolavel" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Motivo</th>
                <th>Valor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mov.map((m) => (
                <tr key={m.id}>
                  <td>{formatarDataHoraSP(m.criado_em)}</td>
                  <td>{m.motivo}</td>
                  <td>{formatarReais(m.valor_cent)}</td>
                  <td>
                    <button type="button" className="secundario pequeno" onClick={() => void tirar(m)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
