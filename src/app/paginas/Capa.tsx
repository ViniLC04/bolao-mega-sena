import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
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
  const { sessao, adm } = useAuth()
  const apostador = !!sessao && !adm
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
        {apostador ? (
          <BotaoLink para="/minha-area" simbolo="trevo" titulo="Bolões disponíveis" legenda="escolher um bolão e apostar" destaque />
        ) : (
          <BotaoLink para="/apostador" simbolo="trevo" titulo="Apostar" legenda="entrar ou criar conta" destaque />
        )}
        <BotaoLink para="/publico" simbolo="neko" titulo="Acompanhar os bolões" legenda="jogos, cotas e chances" />
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
        <h3>1. Quero apostar</h3>
        <ol className="passos">
          <li>
            <strong>Clique em “Apostar”</strong>
            No topo do site ou aqui na capa. Na primeira vez, escolha <em>Criar conta</em> (nome completo, WhatsApp, e-mail e senha). Depois é só <em>Entrar</em>.
          </li>
          <li>
            <strong>Escolha um bolão</strong>
            Em “Bolões disponíveis” aparecem os bolões que o organizador abriu. Clique em <em>Ver e participar</em>.
          </li>
          <li>
            <strong>Escolha as cotas e pague</strong>
            Diga quantas cotas quer. O site mostra o valor exato, o QR Code e o “copia e cola” do PIX. Depois de pagar, envie o comprovante ou mande pelo WhatsApp do organizador.
          </li>
          <li>
            <strong>Aguarde a confirmação</strong>
            A cota só vale depois que o organizador confirma o seu pagamento. Acompanhe tudo em “Minha área”, mesmo se limpar o navegador: basta entrar de novo.
          </li>
        </ol>

        <h3>2. Recebi um link</h3>
        <p>
          Abra o link <strong>com a sua conta aberta</strong> (entre em “Apostar” antes). Ele é ligado à sua conta sozinho e a participação aparece em “Minha área”. Cada link pessoal vale para uma conta só.
        </p>

        <h3>3. Só quero acompanhar</h3>
        <p>
          Use “Acompanhar os bolões”: prazo, cotas vendidas, jogos congelados com a impressão digital (hash), chances e, depois do sorteio, a conferência com o rateio oficial da Caixa. Não precisa de conta.
        </p>

        <h3>Qual é qual? Os tipos de bolão e de link</h3>
        <ul>
          <li>
            <strong>Página “Bolões” (geral):</strong> aberta a todos, sem nomes. Só números, jogos e chances.
          </li>
          <li>
            <strong>Link do bolão:</strong> mostra o primeiro nome e as cotas de cada participante e permite se inscrever, se o organizador deixou.
          </li>
          <li>
            <strong>Bolão disponível (listado):</strong> aparece na sua conta, em “Bolões disponíveis”, sem precisar de link. Mostra o mesmo que o link do bolão.
          </li>
          <li>
            <strong>Link pessoal:</strong> é só seu e é secreto: suas cotas, o valor e o PIX. Não repasse.
          </li>
        </ul>
        <p className="aviso">Estatísticas de sorteios passados não aumentam a chance de acerto. Todo conjunto de 6 dezenas tem a mesma probabilidade.</p>
      </section>

      <p className="bencao">Saravana Bhava · que a sorte e a abundância acompanhem todos nós</p>
    </>
  )
}
