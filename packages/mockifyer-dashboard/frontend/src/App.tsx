import { useState, useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'
import Dashboard from './components/Dashboard'
import { getScenarioConfig } from './lib/api'

function App() {
  const [scenario, setScenario] = useState<string>('default')
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadScenario()
  }, [])

  async function loadScenario() {
    try {
      const config = await getScenarioConfig()
      setScenario(config.currentScenario)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load scenario configuration',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <Dashboard scenario={scenario} onScenarioChange={setScenario} />
        <Toaster />
      </div>
    </BrowserRouter>
  )
}

export default App

