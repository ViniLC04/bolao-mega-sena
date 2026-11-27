import { Navigate, Route, Routes } from 'react-router-dom'
import { configurado } from '../data/supabase'
import { AuthProvider, useAuth } from './auth'
import { Layout } from './Layout'
import { BolaoDetalhe, Boloes } from './paginas/Boloes'
import { Conta } from './paginas/Conta'
import { Concursos } from './paginas/Concursos'
import { Estatisticas } from './paginas/Estatisticas'
import { Fontes } from './paginas/Fontes'
import { Gerador } from './paginas/Gerador'
import { Login } from './paginas/Login'
import { Painel } from './paginas/Painel'
import { Participantes } from './paginas/Participantes'
import { Publico } from './paginas/Publico'
import { Regras } from './paginas/Regras'
import { Simulador } from './paginas/Simulador'
import { RegrasProvider } from './regras'

/** Só deixa passar quem está logado E é o ADM; os demais vão para o login. */
function RotaAdm() {
  const { carregando, sessao, adm } = useAuth()
  if (carregando) return <p className="carregando">Carregando…</p>
  if (!sessao || !adm) return <Navigate to="/publico" replace />
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
          <Route path="/publico" element={<Publico />} />
          <Route path="/fontes" element={<Fontes />} />
          <Route path="/estatisticas" element={<Estatisticas />} />
          <Route element={<RotaAdm />}>
            <Route index element={<Painel />} />
            <Route path="regras" element={<Regras />} />
            <Route path="simulador" element={<Simulador />} />
            <Route path="concursos" element={<Concursos />} />
            <Route path="gerador" element={<Gerador />} />
            <Route path="boloes" element={<Boloes />} />
            <Route path="boloes/:id" element={<BolaoDetalhe />} />
            <Route path="participantes" element={<Participantes />} />
            <Route path="conta" element={<Conta />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RegrasProvider>
    </AuthProvider>
  )
}
