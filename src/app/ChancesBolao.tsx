import { useMemo } from 'react'
import { combinacoesDistintas, type EstimativaFaixa } from '../engine/probabilidades'
import { TOTAL_COMBINACOES } from '../engine/combinatoria'
import { BotaoCasas, Chance, ChanceExpansivel } from './Chance'
import { descreverRecibo } from './plano'
import { useCasas } from './useCasas'
import { useProbabilidades } from './useProbabilidades'
import type { JogoParaConferir } from './Conferencia'

/**
 * Chances do bolão com os JOGOS REAIS: sena exata ("1 em N") e "pelo menos uma quina/quadra" aproximada por
 * Monte Carlo (~2 milhões de sorteios, em Web Worker com barra de progresso).
 */
export function ChancesBolao({ jogos }: { jogos: JogoParaConferir[] }) {
  const { casas, maisCasas } = useCasas()
  const { estado, calcular, parar } = useProbabilidades()
  const r = estado.resultado

  const recibos = useMemo(() => {
    const ordens = [...new Set(jogos.map((j) => j.recibo))].sort((a, b) => a - b)
    return ordens.map((o) => ({ ordem: o, jogos: jogos.filter((j) => j.recibo === o).map((j) => j.dezenas) }))
  }, [jogos])
  const distintas = useMemo(() => combinacoesDistintas(jogos.map((j) => j.dezenas)), [jogos])

  const celula = (f: EstimativaFaixa) => <Chance p={f.p} casas={casas} margem={f.margem95} />

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h2 style={{ color: 'inherit', fontSize: '1.15rem' }}>Chances do bolão</h2>
      <p>
        Chance de <strong>sena</strong> (exata, sem contar combinações repetidas): <ChanceExpansivel p={distintas / TOTAL_COMBINACOES} />{' '}
        <span className="muted pequeno">({distintas.toLocaleString('pt-BR')} combinações distintas)</span>
      </p>
      <p className="muted pequeno">
        Para “pelo menos uma quina ou quadra” não há conta fechada simples: o app simula cerca de 2 milhões de sorteios com os jogos reais do bolão. O resultado é <strong>aproximado</strong>.
      </p>
      <p className="aviso pequeno">
        <strong>Estatísticas de sorteios passados não aumentam a probabilidade de acerto.</strong> Todo conjunto de 6 dezenas tem a mesma chance.
      </p>

      {estado.status !== 'calculando' && (
        <button
          type="button"
          className="secundario"
          onClick={() =>
            calcular({
              recibos: recibos.map((rc) => ({ k: rc.jogos[0]?.length ?? 6, g: rc.jogos.length })),
              jogosReais: recibos.map((rc) => rc.jogos),
              semente: Math.floor(Math.random() * 2 ** 31),
            })
          }
        >
          {r ? 'Calcular de novo' : 'Calcular as chances de quina e quadra'}
        </button>
      )}
      {estado.status === 'calculando' && (
        <div>
          <progress value={estado.fracao} max={1} style={{ width: '100%' }} aria-label="Progresso do cálculo" />
          <p className="muted pequeno">Calculando… {Math.round(estado.fracao * 100)}%</p>
          <button type="button" className="secundario pequeno" onClick={parar}>
            Cancelar
          </button>
        </div>
      )}
      {estado.status === 'erro' && <p className="erro">{estado.erro}</p>}

      {r && (
        <div className="tabela-rolavel" style={{ marginTop: 10 }}>
          <p>
            <BotaoCasas casas={casas} aoClicar={maisCasas} />
          </p>
          <table>
            <thead>
              <tr>
                <th />
                <th>Pelo menos 1 quadra</th>
                <th>Pelo menos 1 quina</th>
                <th>Sena</th>
              </tr>
            </thead>
            <tbody>
              {recibos.map((rc, i) => (
                <tr key={rc.ordem}>
                  <td>
                    Recibo {i + 1}: {descreverRecibo({ k: rc.jogos[0]?.length ?? 6, g: rc.jogos.length })}
                  </td>
                  <td>{celula(r.porGrupo[i].quadra)}</td>
                  <td>{celula(r.porGrupo[i].quina)}</td>
                  <td>{celula(r.porGrupo[i].sena)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Bolão inteiro</strong>
                </td>
                <td>
                  <strong>{celula(r.total.quadra)}</strong>
                </td>
                <td>
                  <strong>{celula(r.total.quina)}</strong>
                </td>
                <td>
                  <strong>{celula(r.total.sena)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="muted pequeno">Valores aproximados, com margem de erro de 95% entre parênteses (em pontos percentuais).</p>
        </div>
      )}
    </section>
  )
}
