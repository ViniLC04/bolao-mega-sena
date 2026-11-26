import { Navigate, Route, Routes } from 'react-router-dom'
import { configurado } from '../data/supabase'
import { AuthProvider, useAuth } from './auth'
import { Layout } from './Layout'
import { Conta } from './paginas/Conta'
import { EmConstrucao } from './paginas/EmConstrucao'
import { Login } from './paginas/Login'
import { Painel } from './paginas/Painel'
import { Regras } from './paginas/Regras'
import { Simulador } from './paginas/Simulador'
import { RegrasProvider } from './regras'

/** Só deixa passar quem está logado E é o ADM; os demais vão para o login. */
function RotaAdm() {
  const { carregando, sessao, adm } = useAuth()
  if (carregando) return <p className="carregando">Carregando…</p>
  if (!sessao || !adm) return <Navigate to="/entrar" replace />
  return <Layout />
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
        <Routes>
          <Route path="/entrar" element={<Login />} />
          <Route element={<RotaAdm />}>
            <Route index element={<Painel />} />
            <Route path="regras" element={<Regras />} />
            <Route path="simulador" element={<Simulador />} />
            <Route path="concursos" element={<EmConstrucao titulo="Concursos" etapa="Etapa 5" />} />
            <Route path="gerador" element={<EmConstrucao titulo="Gerador de jogos" etapa="Etapa 6" />} />
            <Route path="boloes" element={<EmConstrucao titulo="Bolões" etapa="Etapa 7" />} />
            <Route path="conta" element={<Conta />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RegrasProvider>
    </AuthProvider>
  )
}
