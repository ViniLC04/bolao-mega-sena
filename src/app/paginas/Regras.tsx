import { useState } from 'react'
import { inserirVersao } from '../../data/regras'
import { validarRegras, type ParamsRegras, type VersaoRegras } from '../../engine/rules'
import { formatarDataIso, hojeIsoSP } from '../formato'
import { REGRAS_PADRAO, useRegras } from '../regras'
import { deForm, paraForm, type FormRegras } from '../regrasForm'

function Campo({ rotulo, valor, onChange, dica, tipo = 'text' }: { rotulo: string; valor: string; onChange: (v: string) => void; dica?: string; tipo?: string }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      <input type={tipo} value={valor} onChange={(e) => onChange(e.target.value)} inputMode={tipo === 'text' ? 'decimal' : undefined} />
      {dica && <small className="muted">{dica}</small>}
    </label>
  )
}

/** Reinicia o formulário sempre que as regras em uso mudam (por exemplo, depois de gravar uma versão). */
export function Regras() {
  const { params } = useRegras()
  return <RegrasConteudo key={JSON.stringify(params)} inicial={params} />
}

function RegrasConteudo({ inicial }: { inicial: ParamsRegras }) {
  const { versoes, vigenciaEmUso, origem, recarregar } = useRegras()
  const [form, setForm] = useState<FormRegras>(() => paraForm(inicial))
  const [vigencia, setVigencia] = useState(hojeIsoSP())
  const [fonte, setFonte] = useState('')
  const [erros, setErros] = useState<string[]>([])
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const campo = (k: keyof FormRegras) => (v: string) => setForm((f) => ({ ...f, [k]: v }))
  const C = (k: keyof FormRegras, rotulo: string, dica?: string, tipo?: string) => <Campo rotulo={rotulo} valor={form[k]} onChange={campo(k)} dica={dica} tipo={tipo} />

  async function salvar() {
    setMensagem(null)
    const { params: novos, erros: e1 } = deForm(form)
    const lista = [...e1]
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vigencia)) lista.push('Vigência: informe a data a partir da qual a versão vale.')
    if (novos && lista.length === 0) {
      const candidata: VersaoRegras = { vigencia_inicio: vigencia, fonte: fonte.trim() || 'Editado pelo ADM na tela Regras', params: novos }
      lista.push(...validarRegras({ versoes: [...(origem === 'banco' ? versoes : []), candidata] }))
      if (lista.length === 0) {
        setOcupado(true)
        const erro = await inserirVersao(candidata)
        setOcupado(false)
        if (erro) lista.push(erro)
        else {
          setMensagem(`Nova versão gravada: vale a partir de ${formatarDataIso(vigencia)}.`)
          await recarregar()
        }
      }
    }
    setErros(lista)
  }

  async function carregarPadrao() {
    setOcupado(true)
    setErros([])
    for (const v of REGRAS_PADRAO.versoes) {
      const erro = await inserirVersao(v)
      if (erro) {
        setErros([erro])
        break
      }
    }
    setOcupado(false)
    await recarregar()
    setMensagem('Regras padrão (rules.json) gravadas no banco.')
  }

  return (
    <>
      <h1>Regras e parâmetros</h1>
      <p className="muted">
        Nada do que é regra oficial fica fixo no programa: preços, limites, percentuais e imposto vêm daqui. Cada mudança cria uma <strong>nova versão</strong> com data de vigência; as antigas não são apagadas. Bolões já congelados guardam uma cópia das regras de quando foram criados.
      </p>

      {origem === 'padrao' && (
        <div className="aviso">
          <p>Ainda não há regras gravadas no banco: o app está usando o arquivo padrão (<code>rules.json</code>).</p>
          <button type="button" className="secundario" onClick={() => void carregarPadrao()} disabled={ocupado}>
            Gravar as regras padrão no banco
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void salvar()
        }}
      >
        <fieldset className="card">
          <legend>Preços e limites do bolão (valores em R$)</legend>
          <div className="campos">
            {C('preco', 'Preço da aposta simples', 'Caixa 2026: R$ 6,00')}
            {C('valorMinimo', 'Valor mínimo do bolão', 'R$ 18,00')}
            {C('cotaMinima', 'Cota mínima', 'R$ 7,00')}
            {C('cotasMin', 'Mínimo de cotas')}
            {C('cotasMax', 'Máximo de cotas')}
            {C('jogosMax', 'Máximo de jogos por recibo')}
            {C('dezMin', 'Dezenas por jogo: mínimo')}
            {C('dezMax', 'Dezenas por jogo: máximo')}
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>Prêmios (percentuais)</legend>
          <div className="campos">
            {C('tarifa', 'Tarifa de serviço do bolão (%)', 'Só lotérica cobra; o ADM organiza: 0')}
            {C('premioBruto', 'Prêmio bruto sobre a arrecadação (%)', 'Página da Caixa: 43,79')}
            {C('viradaSena', 'Virada: sena (%)')}
            {C('viradaQuina', 'Virada: quina (%)')}
            {C('viradaQuadra', 'Virada: quadra (%)')}
            {C('comumSena', 'Concurso comum: sena (%)')}
            {C('comumQuina', 'Concurso comum: quina (%)')}
            {C('comumQuadra', 'Concurso comum: quadra (%)')}
            {C('comumFinal', 'Concurso comum: final 0 a 5 (%)')}
            {C('comumVirada', 'Concurso comum: parte da Virada (%)')}
          </div>
          <p className="aviso pequeno">Estes percentuais não reconciliam com o rateio real da Caixa (SPEC 8.4): o valor do prêmio sempre vem do rateio oficial do concurso.</p>
        </fieldset>

        <fieldset className="card">
          <legend>Imposto de renda e arredondamento</legend>
          <div className="campos">
            {C('irAliquota', 'Imposto de renda retido (%)', 'Confirmado: 30')}
            {C('irIsento', 'Valor isento de IR (R$)', 'PENDENTE: confirmar se há faixa isenta')}
            <label className="campo">
              <span>Arredondamento da cota</span>
              <select value={form.arredondamento} onChange={(e) => campo('arredondamento')(e.target.value)}>
                <option value="cima">Para cima (o excesso vai para a caixinha)</option>
                <option value="baixo">Para baixo</option>
                <option value="proximo">Para o centavo mais próximo</option>
              </select>
              <small className="muted">Premissa do ADM: validar com a Caixa</small>
            </label>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>Simulador, Virada e prazo</legend>
          <div className="campos">
            {C('limiteRecibos', 'Limite de recibos no simulador')}
            {C('viradaNumero', 'Concurso da Mega da Virada', 'Seu Dinheiro (nov/2026): 3100. Conferir')}
            {C('viradaData', 'Data do sorteio da Virada', 'aaaa-mm-dd', 'date')}
            {C('viradaHora', 'Hora do sorteio', undefined, 'time')}
            {C('dataLimite', 'Data e hora limite das apostas (Brasília)', 'A CONFIRMAR no app da Caixa', 'datetime-local')}
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>Gravar como nova versão</legend>
          <div className="campos">
            <Campo rotulo="Vale a partir de" valor={vigencia} onChange={setVigencia} tipo="date" dica="Cada versão precisa de uma data diferente" />
            <Campo rotulo="Observação (opcional)" valor={fonte} onChange={setFonte} tipo="text" dica="Ex.: Caixa mudou o preço da aposta" />
          </div>
          {erros.length > 0 && (
            <ul className="erro" role="alert">
              {erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {mensagem && <p className="ok">{mensagem}</p>}
          <button type="submit" className="primario" disabled={ocupado}>
            {ocupado ? 'Gravando…' : 'Gravar nova versão'}
          </button>
        </fieldset>
      </form>

      <h2>Versões gravadas</h2>
      {versoes.length === 0 ? (
        <p className="muted">Nenhuma ainda.</p>
      ) : (
        <div className="tabela-rolavel">
          <table>
            <thead>
              <tr>
                <th>Vale desde</th>
                <th>Observação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {versoes.map((v) => (
                <tr key={v.vigencia_inicio}>
                  <td>
                    {formatarDataIso(v.vigencia_inicio)} {origem === 'banco' && v.vigencia_inicio === vigenciaEmUso && <span className="tag">em uso hoje</span>}
                  </td>
                  <td>{v.fonte ?? '—'}</td>
                  <td>
                    <button type="button" className="secundario pequeno" onClick={() => setForm(paraForm(v.params))}>
                      Usar como base
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
