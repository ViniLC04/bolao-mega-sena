import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { carregarRecentes, contarPorStatus, NOMES_STATUS, type ConcursoRecente } from '../../data/concursos'
import { AtualizarConcursos } from '../AtualizarConcursos'
import { formatarDataHoraSP, formatarDataIso, formatarInteiro } from '../formato'

const dezenasTexto = (d: number[]) => [...d].sort((a, b) => a - b).map((x) => String(x).padStart(2, '0')).join(' ')

export function Fontes() {
  const [recentes, setRecentes] = useState<ConcursoRecente[] | null>(null)
  const [contagem, setContagem] = useState<Record<ConcursoRecente['status'], number> | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const [r, c] = await Promise.all([carregarRecentes(10), contarPorStatus()])
    setRecentes(r.lista)
    setContagem(c)
    setErro(r.erro)
  }, [])

  useEffect(() => {
    let vivo = true
    void Promise.all([carregarRecentes(10), contarPorStatus()]).then(([r, c]) => {
      if (!vivo) return
      setRecentes(r.lista)
      setContagem(c)
      setErro(r.erro)
    })
    return () => {
      vivo = false
    }
  }, [])

  const ultimo = recentes && recentes.length > 0 ? recentes[0] : null

  return (
    <div className="conteudo">
      <p>
        <Link to="/publico">← Página do bolão</Link>
      </p>
      <h1>Fontes dos dados</h1>
      {erro && <p className="erro">{erro}</p>}

      <section className="card">
        <h2>Lista de concursos</h2>
        {ultimo ? (
          <p>
            Último concurso no banco: <strong>{ultimo.numero}</strong> ({formatarDataIso(ultimo.data)}). Gravado em {formatarDataHoraSP(ultimo.obtido_em)} · {ultimo.fonte}.
          </p>
        ) : (
          <p className="muted">Carregando…</p>
        )}
        {contagem && (
          <ul className="lista-simples">
            <li>Confirmados: <strong>{formatarInteiro(contagem.confirmado)}</strong></li>
            <li>Oficiais importados (planilha da Caixa): <strong>{formatarInteiro(contagem.oficial_importado)}</strong></li>
            <li>Aguardando confirmação: <strong>{formatarInteiro(contagem.aguardando)}</strong></li>
          </ul>
        )}
        <AtualizarConcursos aoTerminar={() => void carregar()} />
      </section>

      {recentes && recentes.length > 0 && (
        <div className="tabela-rolavel" style={{ marginTop: 12 }}>
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
              {recentes.map((c) => (
                <tr key={c.numero}>
                  <td>{c.numero}</td>
                  <td>{formatarDataIso(c.data)}</td>
                  <td>{dezenasTexto(c.dezenas)}</td>
                  <td>{NOMES_STATUS[c.status]}</td>
                  <td>
                    {c.fonte}, obtido em {formatarDataHoraSP(c.obtido_em)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>De onde vêm os dados</h2>
      <ul>
        <li>
          <strong>Caixa Econômica Federal</strong> (fonte oficial): resultado e rateio de cada concurso, consultados pelo navegador de quem aperta “Atualizar”.
        </li>
        <li>
          <strong>Planilha oficial Mega-Sena.xlsx</strong> da Caixa: carga inicial (concursos 1 a 3.086), importada pelo organizador.
        </li>
        <li>
          <strong>resultadomega.com.br</strong> (fonte não oficial): só para conferir a data e as dezenas de cada concurso novo.
        </li>
      </ul>
      <p className="muted pequeno">
        “Confirmado” = conferido com a segunda fonte (ou confirmado pelo organizador). “Aguardando confirmação” = enviado por um visitante e ainda não conferido. Valores de prêmio vêm sempre do rateio oficial da Caixa.
      </p>
    </div>
  )
}
