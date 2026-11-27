import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { carregarMinhaParticipacao, type MinhaParticipacaoLinha } from '../../data/publico'
import { vincularMinhaConta } from '../../data/apostador'
import { useAuth } from '../auth'
import { Cartao } from '../CartaoParticipacao'

/** Página do link pessoal (#/p/<token>): só as cotas, o valor e os bolões em que ESTA pessoa participa. */
export function MinhaParticipacao() {
  const { token = '' } = useParams()
  const [linhas, setLinhas] = useState<MinhaParticipacaoLinha[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)
  const { carregando, sessao, adm } = useAuth()
  const apostador = !!sessao && !adm
  const [vinculo, setVinculo] = useState<string | null>(null)

  // Com a conta aberta, abrir o link pessoal liga a participação à conta (uma única vez por link)
  useEffect(() => {
    if (carregando || !apostador || !/^[0-9a-f]{64}$/.test(token)) return
    let vivo = true
    void vincularMinhaConta(token).then((e) => {
      if (vivo) setVinculo(e)
    })
    return () => {
      vivo = false
    }
  }, [carregando, apostador, token])

  useEffect(() => {
    let vivo = true
    void carregarMinhaParticipacao(token).then((r) => {
      if (!vivo) return
      setLinhas(r.linhas)
      setErro(r.erro)
    })
    return () => {
      vivo = false
    }
  }, [token, versao])

  return (
    <div>
      <h1>Minha participação no bolão</h1>
      {erro && <p className="erro">{erro}</p>}
      {!carregando && !apostador && linhas !== null && linhas.length > 0 && (
        <p className="aviso">
          Guarde o histórico das suas cotas: <Link to="/apostador">crie uma conta ou entre</Link>. Depois volte a este link para ligá-lo à conta.
        </p>
      )}
      {apostador && vinculo === null && linhas !== null && linhas.length > 0 && (
        <p className="ok pequeno">
          Esta participação está ligada à sua conta. <Link to="/minha-area">Ver minha área</Link>
        </p>
      )}
      {apostador && vinculo && <p className="erro">{vinculo}</p>}
      {linhas === null ? (
        <p className="muted">Carregando…</p>
      ) : linhas.length === 0 ? (
        <section className="card">
          <p>Este link não é válido ou foi desligado. Peça um link novo ao organizador do bolão.</p>
        </section>
      ) : (
        <>
          <p>
            Olá, <strong>{linhas[0].participante}</strong>! Aqui você vê só a sua participação.
          </p>
          {linhas.map((l) => (
            <Cartao key={l.bolao_id} l={l} token={token} aoMudar={() => setVersao((v) => v + 1)} />
          ))}
        </>
      )}
      <p className="muted pequeno" style={{ marginTop: 24 }}>
        Este endereço é só seu: não compartilhe. <Link to="/publico">Página geral do bolão</Link>
      </p>
    </div>
  )
}
