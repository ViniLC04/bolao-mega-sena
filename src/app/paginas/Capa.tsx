import { useState } from 'react'
import { Link } from 'react-router-dom'
import { contagemRegressiva, formatarDataHoraSP } from '../formato'
import { useRegras } from '../regras'
import { Friso, Simbolo, type NomeSimbolo } from '../simbolos'

function BotaoLink({ para, simbolo, titulo, legenda, destaque }: { para: string; simbolo: NomeSimbolo; titulo: string; legenda: string; destaque?: boolean }) {
  return (
    <Link to={para} className={`botao-capa${destaque ? ' destaque' : ''}`}>
      <Simbolo nome={simbolo} />
      {titulo}
      <small>{legenda}</small>
    </Link>
  )
}

/** Capa do site para quem não é o organizador: boas-vindas, botões e o "como usar". */
export function Capa() {
  const { params } = useRegras()
  const [agora] = useState(() => Date.now())
  const c = contagemRegressiva(params.data_limite_aposta, agora)

  function irParaComoUsar() {
    document.getElementById('como-usar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <section className="hero">
        <Simbolo nome="trevo" tamanho={64} />
        <h1>Bolão da Mega da Virada</h1>
        <p className="lema">Organização, transparência e boa energia</p>
        <p className="intro">
          Aqui o nosso bolão é feito com cuidado: os jogos são gerados sem repetir combinações, ficam <strong>congelados com uma impressão digital</strong> que prova que ninguém mexeu, e os valores dos prêmios vêm sempre do <strong>rateio oficial da Caixa</strong>. Acompanhe tudo pelo celular ou pelo computador.
        </p>
        <p className="prazo">
          Prazo das apostas: <strong>{formatarDataHoraSP(params.data_limite_aposta)}</strong> (Brasília) ·{' '}
          {c.encerrado ? 'prazo encerrado' : `faltam ${c.dias} dia(s) e ${c.horas} h`}
        </p>
        <Friso />
      </section>

      <nav className="botoes-capa" aria-label="Por onde começar">
        <BotaoLink para="/publico" simbolo="neko" titulo="Ver os bolões" legenda="jogos, cotas e chances" destaque />
        <BotaoLink para="/estatisticas" simbolo="bagua" titulo="Estatísticas" legenda="o que já saiu nos sorteios" />
        <BotaoLink para="/fontes" simbolo="ferradura" titulo="Fontes dos dados" legenda="de onde vêm os resultados" />
        <button type="button" className="botao-capa" onClick={irParaComoUsar}>
          <Simbolo nome="buda" />
          Como usar
          <small>passo a passo</small>
        </button>
        <BotaoLink para="/entrar" simbolo="sapo" titulo="Sou o organizador" legenda="entrar com senha e código" />
      </nav>

      <section id="como-usar">
        <h2>Como usar o site</h2>
        <ol className="passos">
          <li>
            <strong>Veja o prazo e os bolões</strong>
            Em “Ver os bolões” você acompanha quantas cotas já foram vendidas, quanto foi arrecadado e os jogos já congelados.
          </li>
          <li>
            <strong>Use o seu link</strong>
            O organizador pode mandar um link só seu (suas cotas, seu valor e a situação do seu pagamento) e o link do bolão (quem participa e quantas cotas). Guarde-os: são secretos.
          </li>
          <li>
            <strong>Confira os jogos e as chances</strong>
            Cada jogo congelado tem uma impressão digital (hash) para conferir depois. As chances aparecem com 2 a 5 casas decimais e também como “1 em N”.
          </li>
          <li>
            <strong>Depois do sorteio</strong>
            Veja a conferência: acertos de cada jogo, prêmio e quanto cabe a cada cota, sempre com o rateio oficial da Caixa. Se o concurso ainda não saiu, o site avisa.
          </li>
        </ol>
        <p className="aviso">Estatísticas de sorteios passados não aumentam a chance de acerto. Todo conjunto de 6 dezenas tem a mesma probabilidade.</p>
      </section>

      <p className="bencao">Saravana Bhava · que a sorte e a abundância acompanhem todos nós</p>
    </>
  )
}
