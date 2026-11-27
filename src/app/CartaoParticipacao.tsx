import { useState } from 'react'
import { carregarMeusJogos, type JogoPublico, type MinhaParticipacaoLinha } from '../data/publico'
import { ChancesBolao } from './ChancesBolao'
import { ConferenciaBolao } from './Conferencia'
import { formatarDataHoraSP, formatarReais } from './formato'
import { PagamentoPix } from './PagamentoPix'

const dezenaTexto = (d: number) => String(d).padStart(2, '0')

/** Cartão de uma participação (link pessoal e Minha área): cotas, pagamento por PIX, jogos e conferência. */
export function Cartao({ l, token, aoMudar }: { l: MinhaParticipacaoLinha; token: string; aoMudar: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [jogos, setJogos] = useState<JogoPublico[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const congelado = l.status === 'congelado'

  async function alternar() {
    if (!aberto && jogos === null) {
      const r = await carregarMeusJogos(token, l.bolao_id)
      setJogos(r.jogos)
      setErro(r.erro)
    }
    setAberto(!aberto)
  }

  const recibos = jogos ? [...new Set(jogos.map((j) => j.recibo_ordem))].sort((x, y) => x - y) : []

  return (
    <section className="card" style={{ marginTop: 12 }}>
      <h2 style={{ color: 'inherit', fontSize: '1.15rem' }}>{l.bolao_nome}</h2>
      <p className="muted pequeno">
        Concurso {l.concurso_alvo} ·{' '}
        {congelado && l.congelado_em
          ? `jogos congelados em ${formatarDataHoraSP(l.congelado_em)}`
          : l.status === 'aberto'
            ? `inscrições abertas${l.inscricoes_ate ? ` até ${formatarDataHoraSP(l.inscricoes_ate)}` : ''}; os jogos saem depois que fecharem`
            : 'os jogos ainda estão sendo preparados'}
      </p>
      <ul className="lista-simples">
        <li>
          Suas cotas: <strong>{l.qtd}</strong>{l.n_cotas !== null && <> de {l.n_cotas}</>}
          {l.cota_cent !== null && <> (valor por cota: {formatarReais(l.cota_cent)})</>}
        </li>
        <li>
          Valor a pagar: <strong>{formatarReais(l.valor_devido_cent)}</strong> ·{' '}
          <strong className={l.pago ? 'ok' : undefined}>{l.pago ? 'pago ✓' : l.qtd_paga > 0 ? `${l.qtd_paga} de ${l.qtd} cotas pagas` : 'ainda não pago'}</strong>
        </li>
        <li>
          Via do recibo: <strong>{l.via_entregue ? 'entregue ✓' : 'ainda não entregue'}</strong>
        </li>
      </ul>
      {l.status === 'aberto' && <PagamentoPix l={l} token={token} aoMudar={aoMudar} />}
      {congelado && l.hash && (
        <p className="muted pequeno" style={{ wordBreak: 'break-all' }}>
          Impressão digital (SHA-256) dos jogos: <code>{l.hash}</code>
        </p>
      )}
      {congelado && (
        <button type="button" className="secundario" onClick={() => void alternar()}>
          {aberto ? 'Esconder os jogos' : 'Ver os jogos, as chances e a conferência'}
        </button>
      )}
      {aberto && (
        <div style={{ marginTop: 10 }}>
          {erro && <p className="erro">{erro}</p>}
          {jogos && jogos.length > 0 && (
            <>
              {recibos.map((ro, i) => {
                const doRecibo = jogos.filter((j) => j.recibo_ordem === ro)
                return (
                  <div key={ro} style={{ marginBottom: 10 }}>
                    <strong>
                      Recibo {i + 1}: {doRecibo.length} jogo(s) de {doRecibo[0]?.k} dezenas
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
              <ChancesBolao jogos={jogos.map((j) => ({ recibo: j.recibo_ordem, dezenas: j.dezenas }))} />
              <ConferenciaBolao jogos={jogos.map((j) => ({ recibo: j.recibo_ordem, dezenas: j.dezenas }))} nCotas={l.n_cotas ?? l.qtd} concursoAlvo={l.concurso_alvo} minhaQtd={l.qtd} />
            </>
          )}
        </div>
      )}
    </section>
  )
}
