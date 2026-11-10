import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import Navigation from './components/Navigation'
import { Navigate } from 'react-router-dom'
import Introduction from './pages/Introduction'
import DateConfig from './pages/DateConfig'
import GettingStarted from './pages/GettingStarted'
import ConfigReference from './pages/ConfigReference'
import Contact from './pages/Contact'
import Comparisons from './pages/Comparisons'
import E2ETutorial from './pages/E2ETutorial'
import Features from './pages/Features'
import FAQ from './pages/FAQ'
import Packages from './pages/Packages'
import Dashboard from './pages/Dashboard'
import MockAtTheNetworkEdge from './pages/guides/MockAtTheNetworkEdge'
import ReproduceTesterBugs from './pages/guides/ReproduceTesterBugs'
import StableReactNativeE2E from './pages/guides/StableReactNativeE2E'
import MockDrift from './pages/guides/MockDrift'
import NuxtSsrFixtures from './pages/guides/NuxtSsrFixtures'
import { ThemeProvider } from './lib/use-theme'
import PageSeoManager from './components/PageSeoManager'

function App() {
  return (
    <ThemeProvider>
      {/* Ensure .dark class is included in build - used dynamically */}
      <div className="hidden dark:block" />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <div className="min-h-screen bg-background">
          <PageSeoManager />
          <Navigation />
          <main>
            <Routes>
              <Route path="/" element={<Introduction />} />
              <Route path="/index.html" element={<Introduction />} />
              <Route path="/features" element={<Features />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/packages" element={<Packages />} />
              <Route path="/dashboard" element={<Dashboard />} />
              
              {/* Guides */}
              <Route path="/guides/mock-at-the-network-edge" element={<MockAtTheNetworkEdge />} />
              <Route path="/guides/reproduce-tester-bugs" element={<ReproduceTesterBugs />} />
              <Route path="/guides/stable-react-native-e2e" element={<StableReactNativeE2E />} />
              <Route path="/guides/mock-drift" element={<MockDrift />} />
              <Route path="/guides/nuxt-ssr-fixtures" element={<NuxtSsrFixtures />} />
              
              {/* Redirects for removed pages */}
              <Route path="/playground" element={<Navigate to="/" replace />} />
              <Route path="/timeline" element={<Navigate to="/" replace />} />
              <Route path="/settings" element={<Navigate to="/" replace />} />
              
              <Route path="/date-config" element={<DateConfig />} />
              <Route path="/getting-started" element={<GettingStarted />} />
              <Route path="/config-reference" element={<ConfigReference />} />
              <Route path="/comparisons" element={<Comparisons />} />
              <Route path="/e2e-tutorial" element={<E2ETutorial />} />
              <Route path="/contact" element={<Contact />} />
            </Routes>
          </main>
          <Toaster />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App

