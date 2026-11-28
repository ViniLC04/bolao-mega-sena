import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BotaoCasas, Chance, ChanceExpansivel } from '../Chance'
import { formatarInteiro, formatarReais, formatarReaisCampo, parseReais } from '../formato'
import { useCasas } from '../useCasas'
import { descreverRecibo, planoDeLinha, type PreviaSimulador } from '../plano'
import { useRegras } from '../regras'
import { useProbabilidades } from '../useProbabilidades'
import {
  simularInverso,
  simularPorCotas,
  simularPorValor,
  tabelaPorCota,
  type LinhaSimulacao,
  type LinhaTabelaCota,
  type ModoCobranca,
  type PerfilSimulador,
} from '../../engine/simulador'
import { totalMinimo } from '../../engine/bolao'
import type { EstimativaFaixa } from '../../engine/probabilidades'

type Modo = 'valor' | 'cotas' | 'inverso' | 'tabela'

const MODOS: { id: Modo; rotulo: string }[] = [
  { id: 'tabela', rotulo: 'Tabela por cota' },
  { id: 'valor', rotulo: 'Por valor' },
  { id: 'cotas', rotulo: 'Por nº de cotas' },
  { id: 'inverso', rotulo: 'Inverso (orçamento)' },
]

function Resumo({ linha, cotaBaseCent, bolaoId }: { linha: LinhaSimulacao; cotaBaseCent: number | null; bolaoId?: string }) {
  const navigate = useNavigate()
  const { casas, maisCasas } = useCasas()
  const celula = (f: EstimativaFaixa) => <Chance p={f.p} casas={casas} margem={f.margem95} />
  const { estado, calcular, parar } = useProbabilidades()
  const r = estado.resultado

  return (
    <section className="card" style={{ marginTop: 14 }}>
      <h2>Resultado para {linha.n} cotas</h2>

      <div className="tabela-rolavel">
        <table>
          <thead>
            <tr>
              <th>Recibo</th>
              <th>Total</th>
              <th>Cota de cada participante</th>
            </tr>
          </thead>
          <tbody>
            {linha.recibos.map((rc, i) => (
              <tr key={i}>
                <td>{descreverRecibo(rc)}</td>
                <td>{formatarReais(rc.total)}</td>
                <td>{formatarReais(rc.cotaCent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grade" style={{ marginTop: 12 }}>
        <p>Gasto na Caixa: <strong>{formatarReais(linha.gastoCent)}</strong></p>
        <p>
          Cota cobrada ({linha.cobranca === 'cota_fixa' ? 'cota fixa' : 'cota-teto'}): <strong>{formatarReais(linha.cotaCobradaCent)}</strong>
        </p>
        <p>Arrecadação: <strong>{formatarReais(linha.arrecadacaoCent)}</strong></p>
        <p>Sobra do orçamento: <strong>{formatarReais(linha.sobraOrcamentoCent)}</strong></p>
        <p>Vai para a caixinha: <strong>{formatarReais(linha.caixinhaCent)}</strong></p>
        <p>Jogos: <strong>{formatarInteiro(linha.jogos)}</strong> · apostas equivalentes (gasto ÷ preço): <strong>{formatarInteiro(linha.apostasEquivalentes)}</strong></p>
        <p>Chance de sena: <ChanceExpansivel p={1 / linha.senaUmEm} /> <span className="muted pequeno">(sem combinações repetidas)</span></p>
      </div>
      {linha.avisoCentavos && (
        <p className="aviso">Atenção: o total não divide {linha.n} cotas em centavos exatos. Vale a regra de arredondamento (em Regras); a diferença vai para a caixinha.</p>
      )}

      <h2>Chances de prêmio (aproximado)</h2>
      <p className="muted pequeno">
        Simulação de cerca de 2 milhões de sorteios, com jogos aleatórios. Cada R$ 6 compra uma combinação, qualquer que seja o número de dezenas; jogos maiores só concentram os prêmios (mais chance de "pelo menos um prêmio" em menos recibos, não mais chance de sena).
      </p>
      <p className="aviso pequeno">
        <strong>Estatísticas de sorteios passados não aumentam a probabilidade de acerto.</strong> Todo conjunto de 6 dezenas tem a mesma chance.
      </p>

      {estado.status !== 'calculando' && (
        <button type="button" className="secundario" onClick={() => calcular({ recibos: linha.recibos.map(({ k, g }) => ({ k, g })), semente: Math.floor(Math.random() * 2 ** 31) })}>
          {r ? 'Calcular de novo' : 'Calcular as chances'}
        </button>
      )}
      {estado.status === 'calculando' && (
        <div>
          <progress value={estado.fracao} max={1} style={{ width: '100%' }} aria-label="Progresso do cálculo" />
          <p className="muted pequeno">Calculando… {Math.round(estado.fracao * 100)}%</p>
          <button type="button" className="secundario pequeno" onClick={parar}>Cancelar</button>
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
              {linha.recibos.map((rc, i) => (
                <tr key={i}>
                  <td>Recibo {i + 1}: {descreverRecibo(rc)}</td>
                  <td>{celula(r.porGrupo[i].quadra)}</td>
                  <td>{celula(r.porGrupo[i].quina)}</td>
                  <td>{celula(r.porGrupo[i].sena)}</td>
                </tr>
              ))}
              <tr>
                <td><strong>Bolão inteiro</strong></td>
                <td><strong>{celula(r.total.quadra)}</strong></td>
                <td><strong>{celula(r.total.quina)}</strong></td>
                <td><strong>{celula(r.total.sena)}</strong></td>
              </tr>
            </tbody>
          </table>
          <p className="muted pequeno">Valores aproximados (margem de erro de 95% entre parênteses, em pontos percentuais). A chance exata de sena é a de cima: <ChanceExpansivel p={1 / linha.senaUmEm} />.</p>
        </div>
      )}

      <p style={{ marginTop: 14 }}>
        <button type="button" className="primario" onClick={() => navigate('/gerador', { state: { plano: { ...planoDeLinha(linha, cotaBaseCent), bolaoId } } })}>
          {bolaoId ? 'Usar este plano e gerar os jogos do bolão' : 'Usar este plano no gerador de jogos'}
        </button>
      </p>
    </section>
  )
}

function baixarCsv(tabela: LinhaTabelaCota[], cotaCent: number) {
  const cab = 'Cotas;Arrecadado (R$);Maximo em jogos (R$);Sobra (R$);Jogos;Composicao;Chance de sena (1 em)'
  const linhas = tabela.map((t) =>
    t.linha
      ? [t.n, formatarReaisCampo(t.arrecadadoCent), formatarReaisCampo(t.linha.gastoCent), formatarReaisCampo(t.linha.caixinhaCent), t.linha.jogos, t.linha.recibos.map(descreverRecibo).join(' + '), t.linha.senaUmEm].join(';')
      : [t.n, formatarReaisCampo(t.arrecadadoCent), 'nao cabe', '', '', '', ''].join(';'),
  )
  const blob = new Blob(['﻿' + [cab, ...linhas].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tabela-cota-${formatarReaisCampo(cotaCent).replace(',', '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** Modo 4: com a cota escolhida, o que dá para fazer com cada número de cotas. */
function TabelaPorCota({ tabela, cotaCent, aoVer }: { tabela: LinhaTabelaCota[]; cotaCent: number; aoVer: (l: LinhaSimulacao) => void }) {
  const viaveis = tabela.filter((t) => t.linha !== null)
  const menorSobra = viaveis.length > 0 ? Math.min(...viaveis.map((t) => t.linha!.caixinhaCent)) : null
  const maiorJogos = viaveis.length > 0 ? Math.max(...viaveis.map((t) => t.linha!.gastoCent)) : null
  return (
    <section className="card" style={{ marginTop: 14 }}>
      <h2>Cota de {formatarReais(cotaCent)}: o que cabe em cada quantidade de cotas</h2>
      <p className="muted pequeno">
        Com cota fixa a sobra vai para a caixinha. O máximo em jogos obedece às regras de recibo vigentes (cada recibo precisa de um mínimo por cota), por isso nem sempre chega perto do arrecadado.
      </p>
      <p>
        <button type="button" className="secundario pequeno" onClick={() => baixarCsv(tabela, cotaCent)}>Baixar tabela (CSV)</button>
      </p>
      <div className="tabela-rolavel">
        <table>
          <thead>
            <tr><th>Cotas</th><th>Arrecadado</th><th>Máximo em jogos</th><th>Sobra</th><th>Jogos</th><th>Composição</th><th>Sena (1 em)</th><th /></tr>
          </thead>
          <tbody>
            {tabela.map((t) => {
              const l = t.linha
              const destaque = l !== null && (l.caixinhaCent === menorSobra || l.gastoCent === maiorJogos)
              return (
                <tr key={t.n} style={destaque ? { background: 'color-mix(in srgb, var(--acento) 14%, transparent)' } : undefined}>
                  <td>{t.n}</td>
                  <td>{formatarReais(t.arrecadadoCent)}</td>
                  {l ? (
                    <>
                      <td>{formatarReais(l.gastoCent)}{l.gastoCent === maiorJogos && <small className="muted"> · maior valor</small>}</td>
                      <td>{formatarReais(l.caixinhaCent)}{l.caixinhaCent === 0 ? <small className="muted"> · sem sobra</small> : l.caixinhaCent === menorSobra ? <small className="muted"> · menor sobra</small> : null}</td>
                      <td>{formatarInteiro(l.jogos)}</td>
                      <td>{l.recibos.map(descreverRecibo).join(' + ')}</td>
                      <td>{formatarInteiro(l.senaUmEm)}</td>
                      <td><button type="button" className="secundario pequeno" onClick={() => aoVer(l)}>Ver</button></td>
                    </>
                  ) : (
                    <td colSpan={6} className="muted">não cabe um recibo válido</td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function Simulador() {
  const { params } = useRegras()
  // Vindo de um bolão que fechou as inscrições: N e cota já definidos, simulação já feita
  const previa = (useLocation().state as { previa?: PreviaSimulador } | null)?.previa ?? null
  const [modo, setModo] = useState<Modo>(previa ? 'valor' : 'tabela')
  const [tabela, setTabela] = useState<LinhaTabelaCota[] | null>(null)
  const [n, setN] = useState(previa ? String(previa.n) : '20')
  const [cotaBase, setCotaBase] = useState(previa ? formatarReaisCampo(previa.cotaBaseCent) : '100,00')
  const [orcamento, setOrcamento] = useState('840,00')
  const [perfil, setPerfil] = useState<PerfilSimulador>('menos_recibos')
  const [cobranca, setCobranca] = useState<ModoCobranca>('cota_fixa')
  const [linhas, setLinhas] = useState<LinhaSimulacao[] | null>(() => {
    if (!previa) return null
    const l = simularPorValor({ n: previa.n, cotaBaseCent: previa.cotaBaseCent, perfil: 'menos_recibos', cobranca: 'cota_fixa' }, params)
    return l ? [l] : null
  })
  const [escolhida, setEscolhida] = useState(0)
  const [cotaBaseUsada, setCotaBaseUsada] = useState<number | null>(previa?.cotaBaseCent ?? null)
  const [maiorN, setMaiorN] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [chave, setChave] = useState(0) // zera as chances calculadas quando se simula de novo

  function simular() {
    setErro(null)
    setLinhas(null)
    setMaiorN(null)
    setTabela(null)
    setChave((c) => c + 1)
    const nInt = /^\d+$/.test(n.trim()) ? Number(n.trim()) : NaN

    if (modo === 'tabela') {
      const base = parseReais(cotaBase)
      if (base === null || base <= 0) return setErro('Informe o valor da cota em reais (ex.: 56,00).')
      setTabela(tabelaPorCota(base, params, perfil))
      setCotaBaseUsada(base)
      return
    }

    if (modo === 'inverso') {
      const orc = parseReais(orcamento)
      if (orc === null || orc <= 0) return setErro('Informe o orçamento em reais (ex.: 840,00).')
      const r = simularInverso(orc, params, perfil)
      if (r.linhas.length === 0) return setErro(`Com ${formatarReais(orc)} não cabe nenhum bolão: o mínimo é ${formatarReais(params.bolao_valor_minimo)} (e ${formatarReais(params.bolao_cota_minima)} por cota).`)
      setLinhas(r.linhas)
      setMaiorN(r.maiorN)
      setEscolhida(r.linhas.length - 1)
      setCotaBaseUsada(null)
      return
    }

    if (!Number.isInteger(nInt) || nInt < params.bolao_cotas_min || nInt > params.bolao_cotas_max) {
      return setErro(`O número de cotas deve ser um inteiro de ${params.bolao_cotas_min} a ${params.bolao_cotas_max}.`)
    }

    if (modo === 'cotas') {
      const l = simularPorCotas(nInt, params)
      if (!l) return setErro('Não há recibo possível para este número de cotas.')
      setLinhas([l])
      setEscolhida(0)
      setCotaBaseUsada(null)
      return
    }

    const base = parseReais(cotaBase)
    if (base === null || base <= 0) return setErro('Informe a cota-base em reais (ex.: 100,00).')
    const l = simularPorValor({ n: nInt, cotaBaseCent: base, perfil, cobranca }, params)
    if (!l) {
      const min = totalMinimo(nInt, params)
      return setErro(`Com ${nInt} cotas de ${formatarReais(base)} (${formatarReais(base * nInt)}) não dá para montar um recibo válido${min ? `: o mínimo para ${nInt} cotas é ${formatarReais(min.total)} no total` : ''}.`)
    }
    setLinhas([l])
    setEscolhida(0)
    setCotaBaseUsada(base)
  }

  const atual = linhas?.[escolhida] ?? null

  return (
    <>
      <h1>Simulador</h1>
      <p className="muted">Veja quanto custa, quantos jogos entram e quais as chances, antes de criar o bolão. Só o ADM vê esta tela.</p>

      {previa && (
        <p className="aviso">
          Simulação do bolão <strong>{previa.nome}</strong>: as inscrições fecharam com <strong>{previa.n} cotas de {formatarReais(previa.cotaBaseCent)}</strong> (orçamento de {formatarReais(previa.n * previa.cotaBaseCent)}). Os jogos que você gerar serão salvos neste bolão.
          {!linhas && ' Com esse orçamento não cabe um recibo válido: volte ao bolão e reabra as inscrições.'}
        </p>
      )}
      {!previa && (
        <div className="menu" role="tablist" aria-label="Modo do simulador" style={{ position: 'static', borderRadius: 999, border: '1px solid var(--borda)', marginBottom: 12 }}>
          {MODOS.map((m) => (
            <a key={m.id} href="#" role="tab" aria-selected={modo === m.id} className={modo === m.id ? 'ativo' : undefined} onClick={(e) => { e.preventDefault(); setModo(m.id); setLinhas(null); setTabela(null); setErro(null) }}>
              {m.rotulo}
            </a>
          ))}
        </div>
      )}

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          simular()
        }}
      >
        <div className="campos">
          {modo !== 'inverso' && modo !== 'tabela' && (
            <label className="campo">
              <span>Número de cotas (N)</span>
              <input inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} readOnly={Boolean(previa)} />
              <small className="muted">De {params.bolao_cotas_min} a {params.bolao_cotas_max}</small>
            </label>
          )}
          {(modo === 'valor' || modo === 'tabela') && (
            <label className="campo">
              <span>{modo === 'tabela' ? 'Valor da cota (R$)' : 'Cota-base (R$)'}</span>
              <input inputMode="decimal" value={cotaBase} onChange={(e) => setCotaBase(e.target.value)} readOnly={Boolean(previa)} />
              <small className="muted">{modo === 'tabela' ? `Mostra todas as quantidades de ${params.bolao_cotas_min} a ${params.bolao_cotas_max} cotas` : 'Arrecadação = N × cota-base'}</small>
            </label>
          )}
          {modo === 'inverso' && (
            <label className="campo">
              <span>Orçamento total (R$)</span>
              <input inputMode="decimal" value={orcamento} onChange={(e) => setOrcamento(e.target.value)} />
              <small className="muted">Mostra, para cada N, o melhor gasto dentro do orçamento</small>
            </label>
          )}
          {modo !== 'cotas' && (
            <label className="campo">
              <span>Preferência</span>
              <select value={perfil} onChange={(e) => setPerfil(e.target.value as PerfilSimulador)}>
                <option value="menos_recibos">Menos recibos</option>
                <option value="mais_dezenas">Mais dezenas por jogo</option>
                <option value="mais_jogos">Mais jogos</option>
              </select>
              <small className="muted">Só desempata entre composições com o mesmo gasto</small>
            </label>
          )}
          {modo === 'valor' && (
            <label className="campo">
              <span>Cobrança</span>
              <select value={cobranca} onChange={(e) => setCobranca(e.target.value as ModoCobranca)} disabled={Boolean(previa)}>
                <option value="cota_fixa">Cota fixa (a sobra vai para a caixinha)</option>
                <option value="cota_teto">Cota-teto (cobra gasto ÷ N, arredondado)</option>
              </select>
            </label>
          )}
        </div>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="submit" className="primario">Simular</button>
      </form>

      {tabela && <TabelaPorCota tabela={tabela} cotaCent={cotaBaseUsada ?? 0} aoVer={(l) => { setLinhas([l]); setEscolhida(0); setChave((c) => c + 1) }} />}

      {linhas && linhas.length > 1 && (
        <section className="card" style={{ marginTop: 14 }}>
          <h2>Quantas cotas cabem{maiorN ? `: até ${maiorN}` : ''}</h2>
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr><th>N</th><th>Composição</th><th>Gasto</th><th>Cota (teto)</th><th>Sobra</th><th /></tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={l.n} style={i === escolhida ? { background: 'color-mix(in srgb, var(--acento) 14%, transparent)' } : undefined}>
                    <td>{l.n}</td>
                    <td>{l.recibos.map(descreverRecibo).join(' + ')}</td>
                    <td>{formatarReais(l.gastoCent)}</td>
                    <td>{formatarReais(l.cotaTetoCent)}</td>
                    <td>{formatarReais(l.sobraOrcamentoCent)}</td>
                    <td><button type="button" className="secundario pequeno" onClick={() => { setEscolhida(i); setChave((c) => c + 1) }}>Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {atual && <Resumo key={`${chave}-${escolhida}`} linha={atual} cotaBaseCent={cotaBaseUsada} bolaoId={previa?.bolaoId} />}
    </>
  )
}
