import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import Navigation from './components/Navigation'
import Introduction from './pages/Introduction'
import Playground from './pages/Playground'
import RequestFlow from './pages/RequestFlow'
import DateConfig from './pages/DateConfig'
import GettingStarted from './pages/GettingStarted'
import ConfigReference from './pages/ConfigReference'
import Settings from './pages/Settings'
import { ThemeProvider } from './lib/use-theme'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <div className="min-h-screen bg-background">
          <Navigation />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Introduction />} />
              <Route path="/index.html" element={<Introduction />} />
              <Route path="/playground" element={<Playground />} />
              <Route path="/request-flow" element={<RequestFlow />} />
              <Route path="/date-config" element={<DateConfig />} />
              <Route path="/getting-started" element={<GettingStarted />} />
              <Route path="/config-reference" element={<ConfigReference />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
          <Toaster />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App

