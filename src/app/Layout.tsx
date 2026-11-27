import { NavLink, Outlet } from 'react-router-dom'
import { emailParaUsuario } from '../data/usuario'
import { useAuth } from './auth'

const ITENS = [
  { to: '/', rotulo: 'Painel', fim: true },
  { to: '/regras', rotulo: 'Regras' },
  { to: '/simulador', rotulo: 'Simulador' },
  { to: '/concursos', rotulo: 'Concursos' },
  { to: '/gerador', rotulo: 'Gerador' },
  { to: '/boloes', rotulo: 'Bolões' },
  { to: '/participantes', rotulo: 'Participantes' },
  { to: '/estatisticas', rotulo: 'Estatísticas' },
  { to: '/fontes', rotulo: 'Fontes' },
  { to: '/auditoria', rotulo: 'Auditoria' },
  { to: '/backup', rotulo: 'Backup' },
  { to: '/ajuda', rotulo: 'Ajuda' },
  { to: '/conta', rotulo: 'Conta' },
]

/** Casca das telas do ADM: topo com o usuário, menu rolável (bom no celular) e o conteúdo da página. */
export function Layout() {
  const { sessao, sair } = useAuth()
  const usuario = emailParaUsuario(sessao?.user.email ?? '')
  return (
    <div className="app">
      <header className="topo">
        <strong>Bolão da Mega da Virada</strong>
        <span className="topo-usuario">
          {usuario}
          <button type="button" className="secundario pequeno" onClick={() => void sair()}>
            Sair
          </button>
        </span>
      </header>
      <nav className="menu" aria-label="Seções">
        {ITENS.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.fim} className={({ isActive }) => (isActive ? 'ativo' : undefined)}>
            {i.rotulo}
          </NavLink>
        ))}
      </nav>
      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  )
}
