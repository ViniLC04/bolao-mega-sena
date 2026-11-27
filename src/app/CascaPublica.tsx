import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from './auth'
import { Simbolo } from './simbolos'

const classe = ({ isActive }: { isActive: boolean }) => (isActive ? 'ativo' : undefined)

/** Casca das páginas públicas (capa, bolões, estatísticas, fontes, links): cabeçalho com a marca e o menu. */
export function CascaPublica() {
  const { adm, sessao } = useAuth()
  const apostador = !!sessao && !adm
  return (
    <div>
      <header className="publico-topo">
        <div className="publico-topo-dentro">
          <Link to="/" className="marca">
            <Simbolo nome="trevo" />
            Bolão da Mega da Virada
          </Link>
          <nav className="publico-nav" aria-label="Seções">
            <NavLink to="/" end className={classe}>
              Início
            </NavLink>
            <NavLink to="/publico" className={classe}>
              Bolões
            </NavLink>
            <NavLink to="/estatisticas" className={classe}>
              Estatísticas
            </NavLink>
            <NavLink to="/fontes" className={classe}>
              Fontes
            </NavLink>
            {!adm && (
              <NavLink to={apostador ? '/minha-area' : '/apostador'} className={classe}>
                {apostador ? 'Minha área' : 'Sou apostador'}
              </NavLink>
            )}
            <NavLink to={adm ? '/painel' : '/entrar'} className={classe}>
              {adm ? 'Painel' : 'Organizador'}
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="conteudo">
        <Outlet />
      </main>
      <footer className="publico-rodape muted pequeno">
        <p>Boa sorte a todos!</p>
      </footer>
    </div>
  )
}
