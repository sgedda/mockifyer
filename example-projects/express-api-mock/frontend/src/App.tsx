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

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Introduction />} />
            <Route path="/index.html" element={<Introduction />} />
            <Route path="/playground.html" element={<Playground />} />
            <Route path="/request-flow.html" element={<RequestFlow />} />
            <Route path="/date-config.html" element={<DateConfig />} />
            <Route path="/getting-started.html" element={<GettingStarted />} />
            <Route path="/config-reference.html" element={<ConfigReference />} />
            <Route path="/settings.html" element={<Settings />} />
          </Routes>
        </main>
        <Toaster />
      </div>
    </BrowserRouter>
  )
}

export default App

