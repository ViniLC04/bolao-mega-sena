import { useEffect, useState } from 'react'
import { carregarAuditoria, TABELAS_AUDITADAS, type EventoAuditoria } from '../../data/auditoria'
import { formatarDataHoraSP } from '../formato'

const NOMES_ACAO: Record<string, string> = { INSERT: 'criou', UPDATE: 'alterou', DELETE: 'apagou', CONGELAR: 'congelou' }

/** O segredo do link pessoal não aparece nem aqui. */
function semSegredos(d: Record<string, unknown> | null): string {
  if (!d) return ''
  const c = { ...d }
  if ('link_token' in c && c.link_token) c.link_token = '(segredo oculto)'
  if ('token' in c && c.token) c.token = '(segredo oculto)'
  return JSON.stringify(c, null, 2)
}

function resumo(e: EventoAuditoria): string {
  const d = e.detalhe ?? {}
  const nome = typeof d.nome === 'string' ? d.nome : typeof d.chave === 'string' ? d.chave : typeof d.motivo === 'string' ? d.motivo : ''
  return nome
}

export function Auditoria() {
  const [tabela, setTabela] = useState('')
  const [eventos, setEventos] = useState<EventoAuditoria[]>([])
  const [fim, setFim] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    void carregarAuditoria(tabela || null, null).then((r) => {
      if (!vivo) return
      setEventos(r.eventos)
      setFim(r.fim)
      setErro(r.erro)
      setCarregando(false)
    })
    return () => {
      vivo = false
    }
  }, [tabela])

  async function maisAntigos() {
    const ultimo = eventos[eventos.length - 1]
    if (!ultimo) return
    setCarregando(true)
    const r = await carregarAuditoria(tabela || null, ultimo.id)
    setEventos((e) => [...e, ...r.eventos])
    setFim(r.fim)
    setErro(r.erro)
    setCarregando(false)
  }

  return (
    <>
      <h1>Auditoria</h1>
      <p className="muted">Histórico do que foi criado, alterado ou apagado no sistema (os mais novos primeiro). Só você vê esta tela.</p>
      <label className="campo" style={{ maxWidth: 280 }}>
        <span>Mostrar só</span>
        <select
          value={tabela}
          onChange={(e) => {
            setCarregando(true)
            setTabela(e.target.value)
          }}
        >
          <option value="">tudo</option>
          {TABELAS_AUDITADAS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      {erro && <p className="erro">{erro}</p>}
      {eventos.length === 0 && !carregando && <p>Nenhum evento.</p>}
      <div className="tabela-rolavel">
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>O que</th>
              <th>Onde</th>
              <th>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatarDataHoraSP(e.quando)}</td>
                <td>{NOMES_ACAO[e.acao] ?? e.acao}</td>
                <td>
                  {e.tabela ?? '—'}
                  {resumo(e) && <div className="muted pequeno">{resumo(e)}</div>}
                </td>
                <td>
                  {e.detalhe ? (
                    <details>
                      <summary>ver dados</summary>
                      <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.8rem', margin: 0 }}>{semSegredos(e.detalhe)}</pre>
                    </details>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {carregando && <p className="muted">Carregando…</p>}
      {!fim && !carregando && eventos.length > 0 && (
        <button type="button" className="secundario" onClick={() => void maisAntigos()}>
          Carregar mais antigos
        </button>
      )}
    </>
  )
}
