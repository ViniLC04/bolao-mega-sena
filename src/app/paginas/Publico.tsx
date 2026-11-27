import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { carregarBoloesPublicos, carregarJogosPublicos, type BolaoPublico, type JogoPublico } from '../../data/publico'
import { TOTAL_COMBINACOES } from '../../engine/combinatoria'
import { combinacoesDistintas } from '../../engine/probabilidades'
import { ChanceExpansivel } from '../Chance'
import { ChancesBolao } from '../ChancesBolao'
import { ConferenciaBolao } from '../Conferencia'
import { contagemRegressiva, formatarDataHoraSP, formatarInteiro, formatarReais } from '../formato'
import { useRegras } from '../regras'
import { Simbolo } from '../simbolos'

const dezenaTexto = (d: number) => String(d).padStart(2, '0')

export function Publico() {
  const { params } = useRegras()
  const [agora, setAgora] = useState(() => Date.now())
  const [boloes, setBoloes] = useState<BolaoPublico[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let vivo = true
    void carregarBoloesPublicos().then((r) => {
      if (!vivo) return
      setBoloes(r.boloes)
      setErro(r.erro)
    })
    return () => {
      vivo = false
    }
  }, [])

  const c = contagemRegressiva(params.data_limite_aposta, agora)

  return (
    <div>
      <h1>Bolões</h1>
      <section className="card">
        <h2>Prazo das apostas</h2>
        <p className="grande">{formatarDataHoraSP(params.data_limite_aposta)}</p>
        <p className={c.encerrado ? 'erro' : ''}>{c.encerrado ? 'Prazo encerrado.' : `Faltam ${c.dias} dia(s), ${c.horas} h e ${c.minutos} min.`}</p>
        <p className="muted pequeno">Horário de Brasília.</p>
      </section>

      <p className="aviso" style={{ marginTop: 12 }}>
        Estatística de sorteios passados não aumenta a chance de acerto: todo jogo tem a mesma probabilidade, e cada sorteio é independente.
      </p>

      {erro && <p className="erro">{erro}</p>}
      {boloes === null ? (
        <p className="muted">Carregando…</p>
      ) : boloes.length === 0 ? (
        <div className="vazio card">
          <Simbolo nome="trevo" />
          <p>Nenhum bolão publicado ainda. Volte em breve: os jogos aparecem aqui assim que forem congelados.</p>
        </div>
      ) : (
        boloes.map((b) => <CartaoBolao key={b.id} b={b} />)
      )}

      <p className="muted pequeno" style={{ marginTop: 24 }}>
        Nesta página não aparecem nomes de ninguém. <Link to="/fontes">Fontes dos dados e atualizar concursos</Link>
      </p>
    </div>
  )
}

function CartaoBolao({ b }: { b: BolaoPublico }) {
  const [aberto, setAberto] = useState(false)
  const [jogos, setJogos] = useState<JogoPublico[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function alternar() {
    if (!aberto && jogos === null) {
      const r = await carregarJogosPublicos(b.id)
      setJogos(r.jogos)
      setErro(r.erro)
    }
    setAberto(!aberto)
  }

  const distintas = jogos && jogos.length > 0 ? combinacoesDistintas(jogos.map((j) => j.dezenas)) : null
  const recibos = jogos ? [...new Set(jogos.map((j) => j.recibo_ordem))].sort((x, y) => x - y) : []

  return (
    <section className="card" style={{ marginTop: 12 }}>
      <h2 style={{ color: 'inherit', fontSize: '1.15rem' }}>{b.nome}</h2>
      <p className="muted pequeno">
        Concurso {b.concurso_alvo} · jogos congelados em {formatarDataHoraSP(b.congelado_em)}
      </p>
      <ul className="lista-simples">
        <li>
          Cotas vendidas: <strong>{formatarInteiro(b.cotas_vendidas)}</strong> de {formatarInteiro(b.n_cotas)}
          {b.cota_cent !== null && <> · valor por cota: <strong>{formatarReais(b.cota_cent)}</strong></>}
        </li>
        <li>
          Cotas pagas: <strong>{formatarInteiro(b.cotas_pagas)}</strong> · arrecadado: <strong>{formatarReais(b.arrecadado_cent)}</strong>
        </li>
        <li>
          Vias entregues: <strong>{formatarInteiro(b.vias_entregues)}</strong> · custo das apostas: {formatarReais(b.custo_cent)} · {formatarInteiro(b.jogos)} jogo(s)
        </li>
      </ul>
      <p className="muted pequeno" style={{ wordBreak: 'break-all' }}>
        Impressão digital (SHA-256) dos jogos: <code>{b.hash}</code>
      </p>
      <button type="button" className="secundario" onClick={() => void alternar()}>
        {aberto ? 'Esconder os jogos' : 'Ver os jogos'}
      </button>
      {aberto && (
        <div style={{ marginTop: 10 }}>
          {erro && <p className="erro">{erro}</p>}
          {distintas !== null && (
            <p>
              Chance de sena do bolão inteiro: <ChanceExpansivel p={distintas / TOTAL_COMBINACOES} /> ({formatarInteiro(distintas)} combinações de 6 dezenas distintas).
            </p>
          )}
          {jogos && jogos.length > 0 && <ChancesBolao jogos={jogos.map((j) => ({ recibo: j.recibo_ordem, dezenas: j.dezenas }))} />}
          {jogos && jogos.length > 0 && (
            <ConferenciaBolao jogos={jogos.map((j) => ({ recibo: j.recibo_ordem, dezenas: j.dezenas }))} nCotas={b.n_cotas} concursoAlvo={b.concurso_alvo} />
          )}
          {recibos.map((ro) => {
            const doRecibo = (jogos ?? []).filter((j) => j.recibo_ordem === ro)
            return (
              <div key={ro} style={{ marginBottom: 10 }}>
                <strong>
                  Recibo {ro + 1}: {doRecibo.length} jogo(s) de {doRecibo[0]?.k} dezenas
                </strong>
                <ul className="lista-simples">
                  {doRecibo.map((j) => (
                    <li key={j.jogo_ordem} style={{ fontVariantNumeric: 'tabular-nums', padding: '3px 0' }}>
                      {[...j.dezenas].sort((x, y) => x - y).map(dezenaTexto).join(' ')}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
