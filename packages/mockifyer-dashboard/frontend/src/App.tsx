import { useState, useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'
import Dashboard from './components/Dashboard'
import { getScenarioConfig } from './lib/api'
import { getDashboardRouterBasename } from './lib/base-path'

function App() {
  const [scenario, setScenario] = useState<string>('default')
  const { toast } = useToast()

  // Do not gate the router on scenario-config: a refresh of /overrides used to
  // sit on a full-page "Loading..." until that GET finished (or hung on Redis).
  useEffect(() => {
    void loadScenario()
  }, [])

  async function loadScenario() {
    try {
      const config = await getScenarioConfig()
      if (config.currentScenario) {
        setScenario(config.currentScenario)
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load scenario configuration',
        variant: 'destructive',
      })
    }
  }

  return (
    <BrowserRouter basename={getDashboardRouterBasename()}>
      <div className="min-h-screen bg-background">
        <Dashboard scenario={scenario} onScenarioChange={setScenario} />
        <Toaster />
      </div>
    </BrowserRouter>
  )
}

export default App

