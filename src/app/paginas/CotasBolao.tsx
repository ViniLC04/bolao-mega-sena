import { useCallback, useEffect, useState } from 'react'
import {
  criarParticipante,
  incluirCota,
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
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null
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
    cotas.map((c) => ({ qtd: c.qtd, valorDevidoCent: c.valor_devido_cent, pago: c.pago, viaEntregue: c.via_entregue })),
    bolao.n_cotas,
  )
  const k = cota !== null ? caixinha(bolao.n_cotas, cota, custoCent, mov.map((m) => m.valor_cent)) : null
  const encerrado = contagemRegressiva(params.data_limite_aposta, agora).encerrado
  const jaTem = new Set(cotas.map((c) => c.participante_id))

  async function incluir() {
    if (cota === null) return
    const q = Number(qtd)
    const e = validarQtdCotas(q, resumo.vendidas, bolao.n_cotas)
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

  async function marcar(c: CotaLinha, campo: 'pago' | 'via_entregue') {
    setErro(null)
    const e = await marcarCota(c.id, campo, !c[campo])
    if (e) setErro(e)
    else await recarregar()
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
          <p className="grande">
            {formatarInteiro(resumo.vendidas)} de {formatarInteiro(resumo.nCotas)}
          </p>
          <p className="muted pequeno">{formatarInteiro(resumo.livres)} livre(s)</p>
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
      {encerrado && <p className="aviso">O prazo das apostas encerrou. Para incluir cotas, prorrogue a data limite em Regras (nova versão).</p>}

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
          <button type="button" className="primario" disabled={ocupado || encerrado || resumo.livres === 0} onClick={() => void incluir()}>
            Incluir cotas
          </button>
        </section>
      )}

      {cotas.length > 0 && (
        <div className="tabela-rolavel" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Participante</th>
                <th>Cotas</th>
                <th>Devido</th>
                <th>Pago</th>
                <th>Via entregue</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cotas.map((c) => (
                <tr key={c.id}>
                  <td>{c.participantes?.nome ?? '—'}</td>
                  <td>{c.qtd}</td>
                  <td>{formatarReais(c.valor_devido_cent)}</td>
                  <td>
                    <input type="checkbox" checked={c.pago} onChange={() => void marcar(c, 'pago')} aria-label={`Pago: ${c.participantes?.nome ?? ''}`} style={{ width: 22, minHeight: 22 }} />
                  </td>
                  <td>
                    <input type="checkbox" checked={c.via_entregue} onChange={() => void marcar(c, 'via_entregue')} aria-label={`Via entregue: ${c.participantes?.nome ?? ''}`} style={{ width: 22, minHeight: 22 }} />
                  </td>
                  <td>
                    <button type="button" className="secundario pequeno" onClick={() => void remover(c)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Caixinha</h2>
      {k && (
        <section className="card">
          <ul className="lista-simples">
            <li>
              Sobra prevista do arredondamento da cota ({formatarInteiro(bolao.n_cotas)} × {formatarReais(cota!)} − {formatarReais(custoCent)}): <strong>{formatarReais(k.sobraPrevistaCent)}</strong>
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
