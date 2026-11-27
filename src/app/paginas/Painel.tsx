import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { contar } from '../../data/contagens'
import { configurado } from '../../data/supabase'
import { AvisoDoisPassos } from '../DoisPassos'
import { contagemRegressiva, formatarDataHoraSP, formatarDataIso, formatarInteiro } from '../formato'
import { useRegras } from '../regras'

function Numero({ valor }: { valor: number | null | undefined }) {
  if (valor === undefined) return <span className="muted">…</span>
  return <>{valor === null ? '—' : formatarInteiro(valor)}</>
}

export function Painel() {
  const { params, vigenciaEmUso, origem } = useRegras()
  const [agora, setAgora] = useState(() => Date.now())
  const [boloes, setBoloes] = useState<number | null | undefined>(undefined)
  const [concursos, setConcursos] = useState<number | null | undefined>(undefined)
  const [cobertas, setCobertas] = useState<number | null | undefined>(undefined)

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!configurado) return
    void contar('bolaos').then(setBoloes)
    void contar('concursos').then(setConcursos)
    void contar('combinacoes_cobertas').then(setCobertas)
  }, [])

  const c = contagemRegressiva(params.data_limite_aposta, agora)

  return (
    <>
      <h1>Painel</h1>
      <AvisoDoisPassos />
      <div className="grade">
        <section className="card">
          <h2>Prazo das apostas</h2>
          <p className="grande">{formatarDataHoraSP(params.data_limite_aposta)}</p>
          <p className={c.encerrado ? 'erro' : ''}>
            {c.encerrado ? 'Prazo encerrado.' : `Faltam ${c.dias} dia(s), ${c.horas} h e ${c.minutos} min.`}
          </p>
          <p className="muted pequeno">Horário de Brasília. Confirme o horário final no app da Caixa. Edite em Regras.</p>
        </section>

        <section className="card">
          <h2>Mega da Virada</h2>
          <p className="grande">Concurso {params.concurso_virada.numero}</p>
          <p>
            {formatarDataIso(params.concurso_virada.data)} às {params.concurso_virada.hora}
          </p>
        </section>

        <section className="card">
          <h2>Regras em uso</h2>
          <p>
            Versão com vigência desde <strong>{formatarDataIso(vigenciaEmUso)}</strong>.
          </p>
          <p className="muted pequeno">
            {origem === 'banco' ? 'Lidas do banco de dados.' : 'Ainda não há regras no banco: usando o arquivo padrão (rules.json).'}{' '}
            <Link to="/regras">Ver ou alterar</Link>
          </p>
        </section>

        <section className="card">
          <h2>Situação</h2>
          <ul className="lista-simples">
            <li>
              Bolões: <strong><Numero valor={boloes} /></strong>
            </li>
            <li>
              Combinações já cobertas no concurso: <strong><Numero valor={cobertas} /></strong>
            </li>
            <li>
              Concursos importados: <strong><Numero valor={concursos} /></strong>
            </li>
          </ul>
        </section>
      </div>

      <h2>Atalhos</h2>
      <div className="atalhos">
        <Link to="/simulador" className="atalho">Simular um bolão</Link>
        <Link to="/gerador" className="atalho">Gerar jogos</Link>
        <Link to="/boloes" className="atalho">Bolões</Link>
        <Link to="/concursos" className="atalho">Concursos</Link>
      </div>
    </>
  )
}
