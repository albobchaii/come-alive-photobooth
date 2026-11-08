import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { DoodleDefs } from './components/Doodles.jsx'
import SnowLayer from './components/SnowLayer.jsx'
import Home from './pages/Home.jsx'
import TemplatePage from './pages/TemplatePage.jsx'
import BoothPage from './pages/BoothPage.jsx'
import ResultPage from './pages/ResultPage.jsx'
import SoftfilePage from './pages/SoftfilePage.jsx'
import SetupPage from './pages/SetupPage.jsx'

// Panel admin dimuat terpisah supaya tidak memperberat aplikasi kiosk.
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'))

export default function App() {
  return (
    <BrowserRouter>
      {/* Dipakai bersama semua halaman */}
      <DoodleDefs />
      <SnowLayer />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/template" element={<TemplatePage />} />
        <Route path="/booth" element={<BoothPage />} />
        <Route path="/hasil" element={<ResultPage />} />
        <Route path="/softfile" element={<SoftfilePage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<p className="admin__center">Memuat…</p>}>
              <AdminPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}
