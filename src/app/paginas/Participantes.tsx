import { useEffect, useState } from 'react'
import {
  apagarParticipante,
  atualizarParticipante,
  criarParticipante,
  desligarLink,
  enderecoDoLink,
  ligarLink,
  listarParticipantes,
  type Participante,
} from '../../data/participantes'

export function Participantes() {
  const [lista, setLista] = useState<Participante[] | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [contato, setContato] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [edNome, setEdNome] = useState('')
  const [edContato, setEdContato] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function recarregar() {
    const r = await listarParticipantes()
    setLista(r.lista)
    if (r.erro) setErro(r.erro)
  }

  useEffect(() => {
    let vivo = true
    void listarParticipantes().then((r) => {
      if (!vivo) return
      setLista(r.lista)
      setErro(r.erro)
    })
    return () => {
      vivo = false
    }
  }, [])

  async function incluir() {
    if (nome.trim() === '') {
      setErro('Escreva o nome.')
      return
    }
    setOcupado(true)
    setErro(null)
    const r = await criarParticipante(nome, contato)
    setOcupado(false)
    if (r.erro) setErro(r.erro)
    else {
      setNome('')
      setContato('')
      await recarregar()
    }
  }

  async function salvarEdicao(id: string) {
    if (edNome.trim() === '') {
      setErro('O nome não pode ficar vazio.')
      return
    }
    setOcupado(true)
    setErro(null)
    const e = await atualizarParticipante(id, edNome, edContato)
    setOcupado(false)
    if (e) setErro(e)
    else {
      setEditando(null)
      await recarregar()
    }
  }

  async function copiar(url: string, nomePessoa: string) {
    try {
      await navigator.clipboard.writeText(url)
      setAviso(`Link de ${nomePessoa} copiado. Cole no WhatsApp para enviar só para essa pessoa.`)
    } catch {
      setAviso(`Não consegui copiar sozinho. Copie à mão: ${url}`)
    }
  }

  async function ligar(p: Participante, renovar = false) {
    if (renovar && !window.confirm(`Gerar um link novo para ${p.nome}? O link antigo deixa de funcionar.`)) return
    setErro(null)
    setAviso(null)
    const r = await ligarLink(p, renovar)
    if (r.erro || !r.token) return setErro(r.erro)
    await recarregar()
    await copiar(enderecoDoLink(r.token), p.nome)
  }

  async function desligar(p: Participante) {
    setErro(null)
    setAviso(null)
    const e = await desligarLink(p.id)
    if (e) setErro(e)
    else await recarregar()
  }

  async function apagar(p: Participante) {
    if (!window.confirm(`Apagar ${p.nome}? Não dá para desfazer.`)) return
    setErro(null)
    const e = await apagarParticipante(p.id)
    if (e) setErro(e)
    else await recarregar()
  }

  return (
    <>
      <h1>Participantes</h1>
      <p className="muted">
        Só você vê os nomes e contatos. O apostador, no link público, vê apenas totais. As cotas de cada pessoa são lançadas dentro de cada bolão (tela Bolões).
      </p>
      {erro && <p className="erro">{erro}</p>}
      {aviso && <p className="ok" style={{ wordBreak: 'break-all' }}>{aviso}</p>}

      <section className="card">
        <h2>Novo participante</h2>
        <div className="campos">
          <label className="campo">
            <span>Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
          </label>
          <label className="campo">
            <span>Contato (opcional)</span>
            <input value={contato} onChange={(e) => setContato(e.target.value)} maxLength={200} placeholder="telefone ou e-mail" />
          </label>
        </div>
        <button type="button" className="primario" disabled={ocupado} onClick={() => void incluir()}>
          Incluir
        </button>
      </section>

      <h2>{lista ? `${lista.length} participante(s)` : 'Participantes'}</h2>
      {lista === null ? (
        <p className="muted">Carregando…</p>
      ) : lista.length === 0 ? (
        <p>Nenhum participante ainda.</p>
      ) : (
        <div className="tabela-rolavel">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Contato</th>
                <th>Link pessoal</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.map((p) =>
                editando === p.id ? (
                  <tr key={p.id}>
                    <td>
                      <input value={edNome} onChange={(e) => setEdNome(e.target.value)} maxLength={120} />
                    </td>
                    <td>
                      <input value={edContato} onChange={(e) => setEdContato(e.target.value)} maxLength={200} />
                    </td>
                    <td />

                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="primario pequeno" disabled={ocupado} onClick={() => void salvarEdicao(p.id)}>
                        Salvar
                      </button>{' '}
                      <button type="button" className="secundario pequeno" onClick={() => setEditando(null)}>
                        Cancelar
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td>{p.contato ?? '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {p.link_ativo && p.link_token ? (
                        <>
                          <span className="ok pequeno">ligado</span>{' '}
                          <button type="button" className="secundario pequeno" onClick={() => void copiar(enderecoDoLink(p.link_token!), p.nome)}>
                            Copiar
                          </button>{' '}
                          <button type="button" className="secundario pequeno" onClick={() => void ligar(p, true)}>
                            Novo
                          </button>{' '}
                          <button type="button" className="secundario pequeno" onClick={() => void desligar(p)}>
                            Desligar
                          </button>
                        </>
                      ) : (
                        <button type="button" className="secundario pequeno" onClick={() => void ligar(p)}>
                          Gerar link
                        </button>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="secundario pequeno"
                        onClick={() => {
                          setEditando(p.id)
                          setEdNome(p.nome)
                          setEdContato(p.contato ?? '')
                        }}
                      >
                        Editar
                      </button>{' '}
                      <button type="button" className="secundario pequeno" onClick={() => void apagar(p)}>
                        Apagar
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
