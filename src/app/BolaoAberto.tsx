import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apagarRascunho, fecharInscricoes, prorrogarInscricoes, reabrirInscricoes, type BolaoLinha } from '../data/boloes'
import { listarCotas, type CotaLinha } from '../data/participantes'
import { verificarFechamento } from '../engine/cotas'
import { campoLocalSPParaIso, formatarDataHoraSP, formatarInteiro, formatarReais, isoParaCampoLocalSP } from './formato'
import type { PreviaSimulador } from './plano'
import { useRegras } from './regras'

/**
 * Quadro do bolão que ainda não tem jogos (ADM): enquanto está ABERTO mostra o prazo de inscrição e o botão de fechar;
 * depois de fechado (com N cotas) leva ao Simulador para gerar os jogos, ou deixa reabrir as inscrições.
 */
export function FaseDoBolao({ bolao, temJogos, aoMudar }: { bolao: BolaoLinha; temJogos: boolean; aoMudar: () => void }) {
  const { params } = useRegras()
  const navigate = useNavigate()
  const [cotas, setCotas] = useState<CotaLinha[] | null>(null)
  const [descartar, setDescartar] = useState(false)
  const [data, setData] = useState(() => (bolao.inscricoes_ate ? isoParaCampoLocalSP(bolao.inscricoes_ate) : ''))
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const aberto = bolao.status === 'aberto'
  const fechadoSemJogos = bolao.status === 'rascunho' && bolao.inscricoes_encerradas_em !== null

  useEffect(() => {
    let vivo = true
    void listarCotas(bolao.id).then((r) => {
      if (vivo) setCotas(r.lista)
    })
    return () => {
      vivo = false
    }
  }, [bolao.id, bolao.status])

  if (!aberto && !fechadoSemJogos) return null
  const cota = bolao.cota_base_cent
  const registradas = cotas?.reduce((s, c) => s + c.qtd, 0) ?? 0
  const pagas = cotas?.reduce((s, c) => s + c.qtd_paga, 0) ?? 0
  const pendentes = registradas - pagas
  const pessoasPendentes = (cotas ?? []).filter((c) => c.qtd_paga < c.qtd)
  // Só entram no bolão as cotas com pagamento confirmado: é com elas que se confere o orçamento
  const v = cotas !== null && cota !== null ? verificarFechamento(pagas, cota, params) : null

  function irParaOSimulador() {
    if (bolao.n_cotas === null || cota === null) return
    const previa: PreviaSimulador = { bolaoId: bolao.id, nome: bolao.nome, n: bolao.n_cotas, cotaBaseCent: cota }
    navigate('/simulador', { state: { previa } })
  }

  async function fechar() {
    if (!v?.podeFechar) return
    if (pendentes > 0 && !descartar) return setErro('Há cotas sem pagamento confirmado. Confirme os pagamentos ou marque a caixa para descartá-las.')
    const aviso = pendentes > 0 ? ` As ${pendentes} cota(s) sem pagamento confirmado serão DESCARTADAS (as pessoas ficam de fora).` : ''
    if (!window.confirm(`Fechar as inscrições com ${v.n} cotas pagas?${aviso} Depois disso ninguém mais entra (você ainda pode reabrir antes de salvar os jogos, mas o que foi descartado não volta).`)) return
    setOcupado(true)
    setErro(null)
    setMsg(null)
    const r = await fecharInscricoes(bolao.id, descartar)
    setOcupado(false)
    if (r.erro || r.n === null || cota === null) return setErro(r.erro)
    navigate('/simulador', { state: { previa: { bolaoId: bolao.id, nome: bolao.nome, n: r.n, cotaBaseCent: cota } satisfies PreviaSimulador } })
  }

  async function reabrir() {
    setOcupado(true)
    setErro(null)
    const e = await reabrirInscricoes(bolao.id)
    setOcupado(false)
    if (e) setErro(e)
    else aoMudar()
  }

  async function mudarData() {
    const iso = campoLocalSPParaIso(data)
    if (!iso) return setErro('Escolha a data e a hora das inscrições.')
    setOcupado(true)
    setErro(null)
    setMsg(null)
    const e = await prorrogarInscricoes(bolao.id, iso)
    setOcupado(false)
    if (e) setErro(e)
    else {
      setMsg('Data de inscrição atualizada.')
      aoMudar()
    }
  }

  async function apagar() {
    if (!window.confirm('Apagar este bolão? Não dá para desfazer. (Se ele tem cotas, remova as cotas antes.)')) return
    setOcupado(true)
    const e = await apagarRascunho(bolao.id)
    setOcupado(false)
    if (e) setErro(e)
    else navigate('/boloes')
  }

  return (
    <section className="card" style={{ marginTop: 12 }}>
      {aberto ? (
        <>
          <h2>Inscrições abertas</h2>
          <p>
            Cota de <strong>{cota !== null ? formatarReais(cota) : '—'}</strong>
            {bolao.inscricoes_ate && (
              <>
                {' '}
                · inscrições até <strong>{formatarDataHoraSP(bolao.inscricoes_ate)}</strong> (Brasília)
              </>
            )}
            .
          </p>
          <p className="muted pequeno">
            Cadastre as pessoas conforme confirmam, em “Cotas e pagamentos” (abaixo). O número de cotas e os jogos só são definidos <strong>depois</strong> de fechar as inscrições.
          </p>
          <div className="campos">
            <label className="campo">
              <span>Inscrições até</span>
              <input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} />
            </label>
          </div>
          <button type="button" className="secundario pequeno" disabled={ocupado} onClick={() => void mudarData()}>
            Mudar a data
          </button>

          <h2 style={{ marginTop: 18 }}>Fechar as inscrições</h2>
          {v === null ? (
            <p className="muted">Calculando…</p>
          ) : (
            <>
              <p>
                Hoje: <strong>{formatarInteiro(registradas)}</strong> cota(s) cadastrada(s), das quais <strong>{formatarInteiro(pagas)}</strong> com pagamento confirmado. Só as pagas entram: orçamento <strong>{formatarReais(v.orcamentoCent)}</strong>
                {v.minimoCent !== null && <> (o menor recibo possível para {v.n} cotas custa {formatarReais(v.minimoCent)})</>}.
              </p>
              {pendentes > 0 && (
                <div className="aviso">
                  <p>
                    <strong>{formatarInteiro(pendentes)} cota(s) sem pagamento confirmado</strong> ({pessoasPendentes.length} pessoa(s)): {pessoasPendentes.map((c) => `${c.participantes?.nome ?? '—'} (${c.qtd - c.qtd_paga})`).join(', ')}.
                  </p>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={descartar} onChange={(e) => setDescartar(e.target.checked)} style={{ width: 20, minHeight: 20 }} />
                    Descartar essas cotas ao fechar (as pessoas ficam de fora)
                  </label>
                </div>
              )}
              {v.motivo === 'n_invalido' && (
                <p className="aviso">
                  O bolão precisa ter de {params.bolao_cotas_min} a {params.bolao_cotas_max} cotas para fechar (hoje tem {v.n}).
                </p>
              )}
              {v.motivo === 'sem_recibo' && <p className="aviso">Não há recibo possível para {v.n} cotas com as regras atuais.</p>}
              {v.motivo === 'orcamento_baixo' && <p className="aviso">O orçamento não alcança o menor recibo possível para {v.n} cotas. Consiga mais cotas ou espere antes de fechar.</p>}
              {v.podeFechar && <p className="ok">Dá para fechar: o simulador vai aproveitar o orçamento e a sobra vai para a caixinha.</p>}
            </>
          )}
          <button type="button" className="primario" disabled={ocupado || !v?.podeFechar || (pendentes > 0 && !descartar)} onClick={() => void fechar()}>
            Fechar inscrições e gerar os jogos
          </button>
          {registradas === 0 && (
            <>
              {' '}
              <button type="button" className="secundario" disabled={ocupado} onClick={() => void apagar()}>
                Apagar este bolão
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <h2>Inscrições fechadas</h2>
          <p>
            O bolão fechou com <strong>{bolao.n_cotas} cotas</strong>
            {bolao.inscricoes_encerradas_em && <> em {formatarDataHoraSP(bolao.inscricoes_encerradas_em)}</>}.{' '}
            {temJogos ? 'Os jogos já foram salvos; você pode simular e gerar de novo (os jogos atuais serão trocados).' : 'Falta gerar os jogos.'}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="primario" disabled={ocupado} onClick={irParaOSimulador}>
              {temJogos ? 'Simular e gerar os jogos de novo' : 'Simular e gerar os jogos'}
            </button>
            {!temJogos && (
              <button type="button" className="secundario" disabled={ocupado} onClick={() => void reabrir()}>
                Reabrir as inscrições
              </button>
            )}
          </div>
        </>
      )}
      {erro && <p className="erro">{erro}</p>}
      {msg && <p className="ok">{msg}</p>}
    </section>
  )
}
