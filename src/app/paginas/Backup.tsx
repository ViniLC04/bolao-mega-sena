import { useState } from 'react'
import { baixarArquivo, gerarBackup, pagamentosDoBackup } from '../../data/backup'
import { conferirBackup } from '../backup'
import { formatarInteiro } from '../formato'

function carimbo(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export function Backup() {
  const [incluirConcursos, setIncluirConcursos] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [andamento, setAndamento] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [resumo, setResumo] = useState<string | null>(null)

  async function baixar(tipo: 'json' | 'csv') {
    setOcupado(true)
    setErro(null)
    setResumo(null)
    try {
      const b = await gerarBackup(tipo === 'json' ? incluirConcursos : false, setAndamento)
      const problemas = conferirBackup(b)
      if (problemas.length > 0) throw new Error(`O backup saiu com problema: ${problemas[0]}`)
      if (tipo === 'json') {
        baixarArquivo(`backup-bolao-${carimbo()}.json`, JSON.stringify(b), 'application/json')
        const total = Object.values(b.contagens).reduce((s, n) => s + (n ?? 0), 0)
        setResumo(`Backup baixado: ${formatarInteiro(total)} linhas em ${Object.keys(b.tabelas).length} tabelas.`)
      } else {
        baixarArquivo(`pagamentos-bolao-${carimbo()}.csv`, pagamentosDoBackup(b), 'text/csv;charset=utf-8')
        setResumo('Planilha de pagamentos baixada (abre no Excel).')
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui gerar o backup agora.')
    }
    setOcupado(false)
    setAndamento('')
  }

  return (
    <>
      <h1>Backup</h1>
      <p className="aviso">
        O backup tem <strong>nomes e contatos</strong> dos participantes. Guarde o arquivo numa pasta <strong>privada</strong> do seu computador (por exemplo <code>C:\Projetos\bolao-mega-sena\dados</code>, que o Git ignora) e <strong>nunca</strong> o coloque no GitHub, em e-mail ou em grupo.
      </p>

      <section className="card">
        <h2>Backup completo (.json)</h2>
        <p className="muted pequeno">
          Participantes, cotas, caixinha, bolões, recibos, jogos, combinações cobertas, regras, configuração, auditoria e registro das fontes. As fotos dos recibos <strong>não</strong> entram (elas ficam guardadas no Supabase; se quiser cópia, baixe-as na tela de cada bolão).
        </p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
          <input type="checkbox" checked={incluirConcursos} onChange={(e) => setIncluirConcursos(e.target.checked)} style={{ width: 20, minHeight: 20 }} />
          Incluir também os concursos (arquivo bem maior; dá para reimportar da planilha da Caixa)
        </label>
        <button type="button" className="primario" disabled={ocupado} onClick={() => void baixar('json')}>
          {ocupado ? 'Gerando…' : 'Baixar backup (.json)'}
        </button>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <h2>Planilha de pagamentos (.csv)</h2>
        <p className="muted pequeno">Uma linha por pessoa e bolão: cotas, valor devido, pago e via entregue. Abre no Excel.</p>
        <button type="button" className="secundario" disabled={ocupado} onClick={() => void baixar('csv')}>
          Baixar planilha de pagamentos
        </button>
      </section>

      {ocupado && <p className="muted pequeno">{andamento}</p>}
      {erro && <p className="erro">{erro}</p>}
      {resumo && <p className="ok">{resumo}</p>}

      <h2>Quando fazer</h2>
      <ul>
        <li>Depois de congelar um bolão.</li>
        <li>Depois de registrar pagamentos e entregas de via.</li>
        <li>Na véspera de 31/12 e logo depois do sorteio.</li>
      </ul>
      <p className="muted pequeno">Para restaurar um backup, veja <code>docs/restaurar.md</code>.</p>
    </>
  )
}
