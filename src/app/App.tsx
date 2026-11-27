import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { configurado } from '../data/supabase'
import { AuthProvider, useAuth } from './auth'
import { CascaPublica } from './CascaPublica'
import { Layout } from './Layout'
import { Capa } from './paginas/Capa'
import { Login } from './paginas/Login'
import { Publico } from './paginas/Publico'
import { RegrasProvider } from './regras'

// As telas do organizador e as páginas maiores só são baixadas quando alguém as abre (a página pública fica leve no celular).
const carregar = <T extends Record<string, React.ComponentType>>(importar: () => Promise<T>, nome: keyof T & string) =>
  lazy(() => importar().then((m) => ({ default: m[nome] })))

const Ajuda = carregar(() => import('./paginas/Ajuda'), 'Ajuda')
const Auditoria = carregar(() => import('./paginas/Auditoria'), 'Auditoria')
const Backup = carregar(() => import('./paginas/Backup'), 'Backup')
const BolaoPublico = carregar(() => import('./paginas/BolaoPublico'), 'BolaoPublico')
const Boloes = carregar(() => import('./paginas/Boloes'), 'Boloes')
const BolaoDetalhe = carregar(() => import('./paginas/Boloes'), 'BolaoDetalhe')
const Conta = carregar(() => import('./paginas/Conta'), 'Conta')
const Concursos = carregar(() => import('./paginas/Concursos'), 'Concursos')
const Estatisticas = carregar(() => import('./paginas/Estatisticas'), 'Estatisticas')
const Fontes = carregar(() => import('./paginas/Fontes'), 'Fontes')
const Gerador = carregar(() => import('./paginas/Gerador'), 'Gerador')
const MinhaParticipacao = carregar(() => import('./paginas/MinhaParticipacao'), 'MinhaParticipacao')
const Painel = carregar(() => import('./paginas/Painel'), 'Painel')
const Participantes = carregar(() => import('./paginas/Participantes'), 'Participantes')
const Regras = carregar(() => import('./paginas/Regras'), 'Regras')
const Simulador = carregar(() => import('./paginas/Simulador'), 'Simulador')

/** Só deixa passar quem está logado E é o ADM; os demais vão para o login (se falta o código) ou para a capa. */
function RotaAdm() {
  const { carregando, sessao, adm, pendenteCodigo } = useAuth()
  if (carregando) return <p className="carregando">Carregando…</p>
  if (sessao && !adm && pendenteCodigo) return <Navigate to="/entrar" replace />
  if (!sessao || !adm) return <Navigate to="/" replace />
  return <Layout />
}

/** Início: o organizador vai para o Painel; os demais veem a capa. */
function Inicio() {
  const { carregando, adm } = useAuth()
  if (carregando) return <p className="carregando">Carregando…</p>
  if (adm) return <Navigate to="/painel" replace />
  return <Capa />
}

function SemConfiguracao() {
  return (
    <div className="login">
      <div className="card login-caixa">
        <h1>Faltam as chaves do banco</h1>
        <p>
          O arquivo <code>.env.local</code> precisa ter <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>. Veja <code>.env.example</code>.
        </p>
      </div>
    </div>
  )
}

export function App() {
  if (!configurado) return <SemConfiguracao />
  return (
    <AuthProvider>
      <RegrasProvider>
        <Suspense fallback={<p className="carregando">Carregando…</p>}>
          <Routes>
            <Route path="/entrar" element={<Login />} />
            <Route element={<CascaPublica />}>
              <Route index element={<Inicio />} />
              <Route path="publico" element={<Publico />} />
              <Route path="fontes" element={<Fontes />} />
              <Route path="estatisticas" element={<Estatisticas />} />
              <Route path="p/:token" element={<MinhaParticipacao />} />
              <Route path="b/:token" element={<BolaoPublico />} />
            </Route>
            <Route element={<RotaAdm />}>
              <Route path="painel" element={<Painel />} />
              <Route path="regras" element={<Regras />} />
              <Route path="simulador" element={<Simulador />} />
              <Route path="concursos" element={<Concursos />} />
              <Route path="gerador" element={<Gerador />} />
              <Route path="boloes" element={<Boloes />} />
              <Route path="boloes/:id" element={<BolaoDetalhe />} />
              <Route path="participantes" element={<Participantes />} />
              <Route path="ajuda" element={<Ajuda />} />
              <Route path="auditoria" element={<Auditoria />} />
              <Route path="backup" element={<Backup />} />
              <Route path="conta" element={<Conta />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </RegrasProvider>
    </AuthProvider>
  )
}
