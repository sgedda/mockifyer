import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { getScenarioConfig, setScenario, createScenario } from '@/lib/api'
import { Save } from 'lucide-react'

interface SettingsProps {
  scenario: string
  onScenarioChange: (scenario: string) => void
}

export default function Settings({ scenario, onScenarioChange }: SettingsProps) {
  const [availableScenarios, setAvailableScenarios] = useState<string[]>(['default'])
  const [newScenario, setNewScenario] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadScenarios()
  }, [])

  async function loadScenarios() {
    try {
      setLoading(true)
      setError(null)
      const config = await getScenarioConfig()
      // The API returns 'scenarios' array, map it to availableScenarios
      const scenarios = (config as any).scenarios || config.availableScenarios || ['default']
      setAvailableScenarios(scenarios)
    } catch (error: any) {
      console.error('Failed to load scenarios:', error)
      setError(error.message || 'Failed to load scenarios')
      // Keep default scenario available even if API fails
      setAvailableScenarios(['default'])
      toast({
        title: 'Warning',
        description: 'Could not load scenarios from server. Using default.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSetScenario(newScenario: string) {
    try {
      setSaving(true)
      // Check if scenario exists, if not create it first
      const scenarioExists = availableScenarios.includes(newScenario)
      if (!scenarioExists) {
        // Create the scenario first - this returns the updated scenario list
        const createResult = await createScenario(newScenario)
        // Update the available scenarios from the API response
        setAvailableScenarios(createResult.availableScenarios || [])
        toast({
          title: 'Success',
          description: `Scenario "${newScenario}" created`,
        })
      }
      // Then switch to it
      await setScenario(newScenario)
      onScenarioChange(newScenario)
      // Reload scenarios to ensure we have the latest list
      await loadScenarios()
      toast({
        title: 'Success',
        description: `Scenario changed to ${newScenario}`,
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set scenario',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scenarios</CardTitle>
          <CardDescription>
            Organize mock data into separate folders. Switch between scenarios to test different API response sets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading scenarios...</div>
          ) : (
            <>
              {error && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Current Scenario</label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={scenario} 
                    readOnly 
                    className="font-mono" 
                  />
                  <Button
                    variant="outline"
                    onClick={() => handleSetScenario('default')}
                    disabled={scenario === 'default' || saving}
                  >
                    Reset to Default
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Available Scenarios</label>
                {availableScenarios.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">
                    No scenarios found. Create one below.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableScenarios.map((s) => (
                      <Button
                        key={s}
                        variant={s === scenario ? 'default' : 'outline'}
                        onClick={() => handleSetScenario(s)}
                        disabled={saving}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Create New Scenario</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter scenario name (e.g., api-error, no-data)"
                    value={newScenario}
                    onChange={(e) => setNewScenario(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newScenario.trim()) {
                        handleSetScenario(newScenario.trim())
                        setNewScenario('')
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      if (newScenario.trim()) {
                        handleSetScenario(newScenario.trim())
                        setNewScenario('')
                      }
                    }}
                    disabled={!newScenario.trim() || saving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Creating...' : 'Create & Switch'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Scenarios allow you to organize different sets of mock responses for testing various scenarios.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

