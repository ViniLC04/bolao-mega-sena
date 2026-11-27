import { useCallback, useEffect, useState } from 'react'
import { confirmarConcurso, rejeitarConcurso } from '../../data/caixa'
import {
  carregarConcursos,
  carregarRecentes,
  carregarViradas,
  compararComBanco,
  inserirConcursos,
  lerListaNumeros,
  NOMES_STATUS,
  salvarViradas,
  sugerirViradas,
  type ComparacaoPlanilha,
  type ConcursoRecente,
  type ConcursoResumo,
} from '../../data/concursos'
import { lerPlanilhaXlsx, validarConcursos, type ConcursoPlanilha } from '../../data/planilha'
import { AtualizarConcursos } from '../AtualizarConcursos'
import { formatarDataHoraSP, formatarDataIso, formatarInteiro } from '../formato'

const dezenasTexto = (d: number[]) => [...d].sort((a, b) => a - b).map((x) => String(x).padStart(2, '0')).join(' ')

interface Previa {
  nome: string
  total: number
  erros: string[]
  comparacao: ComparacaoPlanilha | null
}

export function Concursos() {
  const [banco, setBanco] = useState<ConcursoResumo[] | null>(null)
  const [erroBanco, setErroBanco] = useState<string | null>(null)
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [arquivos, setArquivos] = useState<Map<string, ConcursoPlanilha[]>>(new Map())
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null)
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)
  const [viradasTexto, setViradasTexto] = useState('')
  const [viradasMsg, setViradasMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  const [recentes, setRecentes] = useState<ConcursoRecente[]>([])
  const [msgStatus, setMsgStatus] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    const [r, rec] = await Promise.all([carregarConcursos(), carregarRecentes(10)])
    setErroBanco(r.erro)
    setBanco(r.erro ? null : r.concursos)
    setRecentes(rec.lista)
    return r.concursos
  }, [])

  useEffect(() => {
    let vivo = true
    void (async () => {
      const [r, v, rec] = await Promise.all([carregarConcursos(), carregarViradas(), carregarRecentes(10)])
      if (!vivo) return
      setErroBanco(r.erro ?? v.erro)
      setBanco(r.erro ? null : r.concursos)
      setRecentes(rec.lista)
      setViradasTexto(v.numeros.join(', '))
    })()
    return () => {
      vivo = false
    }
  }, [])

  async function escolherArquivo(arq: File | undefined) {
    setResultado(null)
    setPrevia(null)
    if (!arq || !banco) return
    try {
      const planilha = lerPlanilhaXlsx(new Uint8Array(await arq.arrayBuffer()))
      const erros = validarConcursos(planilha)
      const comparacao = erros.length === 0 ? compararComBanco(planilha, banco) : null
      setArquivos(new Map([[arq.name, planilha]]))
      setPrevia({ nome: arq.name, total: planilha.length, erros, comparacao })
    } catch (e) {
      setPrevia({ nome: arq.name, total: 0, erros: [e instanceof Error ? e.message : 'Não consegui ler este arquivo.'], comparacao: null })
    }
  }

  async function importar() {
    if (!previa?.comparacao || previa.comparacao.novos.length === 0) return
    setResultado(null)
    setProgresso({ feitos: 0, total: previa.comparacao.novos.length })
    const r = await inserirConcursos(previa.comparacao.novos, (feitos, total) => setProgresso({ feitos, total }))
    setProgresso(null)
    const atualizados = await recarregar()
    if (r.erro) setResultado({ ok: false, texto: `${r.erro} Foram gravados ${formatarInteiro(r.gravados)} antes de parar; é seguro tentar de novo.` })
    else setResultado({ ok: true, texto: `Pronto: ${formatarInteiro(r.gravados)} concursos gravados.` })
    const planilha = arquivos.get(previa.nome)
    if (planilha) setPrevia({ ...previa, comparacao: compararComBanco(planilha, atualizados) })
  }

  async function gravarViradas() {
    const nums = lerListaNumeros(viradasTexto)
    if (!nums) {
      setViradasMsg({ ok: false, texto: 'Use só números separados por vírgula ou espaço. Faixas valem: 1-5.' })
      return
    }
    const erro = await salvarViradas(nums)
    setViradasMsg(erro ? { ok: false, texto: erro } : { ok: true, texto: `Lista gravada: ${nums.length} concurso(s).` })
    if (!erro) setViradasTexto(nums.join(', '))
  }

  const ultimo = banco && banco.length > 0 ? banco[banco.length - 1] : null

  async function decidir(numero: number, acao: 'confirmar' | 'rejeitar') {
    if (acao === 'rejeitar' && !window.confirm(`Rejeitar o concurso ${numero}? Ele será apagado da lista (só vale para concurso ainda aguardando).`)) return
    setMsgStatus(null)
    const e = acao === 'confirmar' ? await confirmarConcurso(numero) : await rejeitarConcurso(numero)
    if (e) setMsgStatus(e)
    else await recarregar()
  }

  return (
    <>
      <h1>Concursos</h1>
      <p className="muted">
        Lista dos sorteios da Mega-Sena, usada nos filtros do gerador e nas estatísticas. Os concursos só são <strong>acrescentados</strong>: nada já gravado é alterado.
      </p>
      <p className="aviso">Estatística de sorteios passados não aumenta a chance de acerto: cada sorteio é independente.</p>

      {erroBanco && <p className="erro">{erroBanco}</p>}

      <section className="card">
        <h2>Situação</h2>
        {banco === null ? (
          <p className="muted">Carregando…</p>
        ) : ultimo ? (
          <p>
            <strong>{formatarInteiro(banco.length)}</strong> concursos no banco. Último: <strong>{ultimo.numero}</strong> ({formatarDataIso(ultimo.data)}).
          </p>
        ) : (
          <p>Nenhum concurso gravado ainda. Importe a planilha abaixo.</p>
        )}
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <h2>Atualizar pela Caixa</h2>
        <AtualizarConcursos aoTerminar={() => void recarregar()} />
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <h2>Importar a planilha da Caixa</h2>
        <p className="muted pequeno">
          Arquivo <code>Mega-Sena.xlsx</code> (baixado do site da Caixa; está na sua pasta <code>dados</code>). O arquivo é lido aqui no seu navegador: nada é enviado antes de você confirmar.
        </p>
        <label className="campo">
          <span>Escolher o arquivo</span>
          <input type="file" accept=".xlsx" disabled={banco === null || progresso !== null} onChange={(e) => void escolherArquivo(e.target.files?.[0])} />
        </label>

        {previa && previa.erros.length > 0 && (
          <div className="erro">
            <p>
              <strong>Este arquivo não passou na conferência</strong> ({previa.nome}). Nada foi gravado.
            </p>
            <ul>
              {previa.erros.slice(0, 8).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            {previa.erros.length > 8 && <p>…e mais {previa.erros.length - 8} problema(s).</p>}
          </div>
        )}

        {previa?.comparacao && (
          <>
            <ul className="lista-simples">
              <li>Concursos na planilha: <strong>{formatarInteiro(previa.total)}</strong> (sequência e dezenas conferidas)</li>
              <li>Já estão no banco: <strong>{formatarInteiro(previa.comparacao.jaNoBanco)}</strong></li>
              <li>Novos para gravar: <strong>{formatarInteiro(previa.comparacao.novos.length)}</strong></li>
            </ul>
            {previa.comparacao.divergentes.length > 0 && (
              <p className="aviso">
                Atenção: {previa.comparacao.divergentes.length} concurso(s) do banco têm data ou dezenas diferentes da planilha (por exemplo o {previa.comparacao.divergentes[0]}). Não vou alterá-los; confira com a Caixa.
              </p>
            )}
            {previa.comparacao.novos.length > 0 ? (
              <button type="button" className="primario" disabled={progresso !== null} onClick={() => void importar()}>
                Importar {formatarInteiro(previa.comparacao.novos.length)} concursos novos
              </button>
            ) : (
              <p className="ok">O banco já está completo em relação a esta planilha.</p>
            )}
          </>
        )}

        {progresso && (
          <p>
            <progress value={progresso.feitos} max={progresso.total} /> Gravando… {formatarInteiro(progresso.feitos)} de {formatarInteiro(progresso.total)}
          </p>
        )}
        {resultado && <p className={resultado.ok ? 'ok' : 'erro'}>{resultado.texto}</p>}
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <h2>Concursos da Mega da Virada (31/12)</h2>
        <p className="muted pequeno">
          Usada no filtro “só Viradas” do gerador. A planilha não marca quais são Virada: a sugestão pega os sorteios feitos em 31/12; confira e ajuste. Escreva os números separados por vírgula (faixas valem, como 1-5).
        </p>
        <label className="campo">
          <span>Números dos concursos-Virada</span>
          <input value={viradasTexto} onChange={(e) => setViradasTexto(e.target.value)} inputMode="numeric" />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="secundario" disabled={!banco || banco.length === 0} onClick={() => banco && setViradasTexto(sugerirViradas(banco).join(', '))}>
            Sugerir: sorteios de 31/12
          </button>
          <button type="button" className="primario" onClick={() => void gravarViradas()}>
            Gravar lista
          </button>
        </div>
        {viradasMsg && <p className={viradasMsg.ok ? 'ok' : 'erro'}>{viradasMsg.texto}</p>}
      </section>

      {recentes.length > 0 && (
        <>
          <h2>Últimos concursos</h2>
          {msgStatus && <p className="erro">{msgStatus}</p>}
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Concurso</th>
                  <th>Data</th>
                  <th>Dezenas</th>
                  <th>Situação</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((c, i) => (
                  <tr key={c.numero}>
                    <td>{c.numero}</td>
                    <td>{formatarDataIso(c.data)}</td>
                    <td>{dezenasTexto(c.dezenas)}</td>
                    <td>
                      {NOMES_STATUS[c.status]}
                      {c.status === 'aguardando' && (
                        <>
                          <br />
                          <button type="button" className="primario pequeno" onClick={() => void decidir(c.numero, 'confirmar')}>
                            Confirmar
                          </button>{' '}
                          {i === 0 && (
                            <button type="button" className="secundario pequeno" onClick={() => void decidir(c.numero, 'rejeitar')}>
                              Rejeitar
                            </button>
                          )}
                        </>
                      )}
                    </td>
                    <td className="pequeno">
                      {c.fonte}, obtido em {formatarDataHoraSP(c.obtido_em)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
