import { useState } from 'react'
import { atualizarConcursos, ultimoConcursoNoBanco, type ResultadoAtualizacao } from '../data/caixa'
import { useAuth } from './auth'

/**
 * Botão "Atualizar lista de concursos": o navegador de QUEM APERTA consulta a Caixa (ela bloqueia servidores de fora
 * do Brasil) e o servidor só valida e grava. Resultado de visitante fica "aguardando confirmação" do organizador.
 */
export function AtualizarConcursos({ aoTerminar }: { aoTerminar?: () => void }) {
  const { adm } = useAuth()
  const [rodando, setRodando] = useState(false)
  const [andamento, setAndamento] = useState('')
  const [res, setRes] = useState<ResultadoAtualizacao | null>(null)

  async function atualizar() {
    setRodando(true)
    setRes(null)
    setAndamento('Vendo qual é o último concurso do banco…')
    const ultimo = await ultimoConcursoNoBanco()
    if (ultimo === null) {
      setRes({ gravados: [], tipo: 'erro', mensagem: 'Não consegui ler o banco agora. Tente de novo.' })
      setRodando(false)
      return
    }
    const r = await atualizarConcursos(ultimo, adm, setAndamento)
    setRes(r)
    setRodando(false)
    if (r.gravados.length > 0) aoTerminar?.()
  }

  return (
    <div>
      <button type="button" className="primario" disabled={rodando} onClick={() => void atualizar()}>
        {rodando ? 'Atualizando…' : 'Atualizar lista de concursos'}
      </button>
      {rodando && <p className="muted pequeno">{andamento}</p>}
      {res && <p className={res.tipo === 'ok' || res.tipo === 'sem_novidade' ? 'ok' : 'erro'}>{res.mensagem}</p>}
      <p className="muted pequeno">
        Quem aperta o botão consulta a Caixa pelo próprio navegador. {adm ? 'Como você é o organizador, se a segunda fonte confere, o concurso já entra "confirmado".' : 'O concurso novo fica "aguardando confirmação" até o organizador confirmar.'}
      </p>
    </div>
  )
}
