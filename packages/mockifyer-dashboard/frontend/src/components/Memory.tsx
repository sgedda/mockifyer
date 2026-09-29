import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { getMemoryStats, clearNetworkEvents } from '@/lib/api'
import type { MemoryStats, ScenarioMemoryStats } from '@/types'
import { Trash2, Database, HardDrive, RefreshCw } from 'lucide-react'

interface MemoryProps {
  scenario: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

export default function Memory({ scenario }: MemoryProps) {
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [clearingScenario, setClearingScenario] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadMemoryStats()
  }, [scenario])

  async function loadMemoryStats() {
    try {
      setLoading(true)
      const stats = await getMemoryStats(scenario)
      setMemoryStats(stats)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load memory statistics',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleClearNetworkEvents(scenarioName: string) {
    const confirmed = window.confirm(
      `Clear all network events for scenario "${scenarioName}"? This action cannot be undone.`
    )
    if (!confirmed) return

    try {
      setClearingScenario(scenarioName)
      const result = await clearNetworkEvents(scenarioName)
      toast({
        title: 'Network events cleared',
        description: `Removed ${result.removed} network event(s) from "${scenarioName}"`,
      })
      await loadMemoryStats()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to clear network events',
        variant: 'destructive',
      })
    } finally {
      setClearingScenario(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Memory Usage</h2>
            <p className="text-muted-foreground">
              View memory usage across scenarios and clear data
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">Loading memory statistics...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!memoryStats) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Memory Usage</h2>
            <p className="text-muted-foreground">
              View memory usage across scenarios and clear data
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              No memory statistics available
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Memory Usage</h2>
          <p className="text-muted-foreground">
            View memory usage across scenarios and clear data
          </p>
        </div>
        <Button variant="outline" onClick={loadMemoryStats} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Total Memory Usage</CardTitle>
          <CardDescription>
            Combined storage across all scenarios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>Mock Files</span>
              </div>
              <div className="text-2xl font-bold">
                {memoryStats.summary.totalMocksCount.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatBytes(memoryStats.summary.totalMocksSize)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <HardDrive className="h-4 w-4" />
                <span>Network Events</span>
              </div>
              <div className="text-2xl font-bold">
                {memoryStats.summary.totalNetworkEventsCount.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatBytes(memoryStats.summary.totalNetworkEventsSize)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>Total Size</span>
              </div>
              <div className="text-2xl font-bold">
                {formatBytes(memoryStats.summary.totalSize)}
              </div>
              <div className="text-sm text-muted-foreground">
                All data combined
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Memory by Scenario</CardTitle>
          <CardDescription>
            Storage breakdown and data management per scenario
          </CardDescription>
        </CardHeader>
        <CardContent>
          {memoryStats.scenarios.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No scenarios found
            </div>
          ) : (
            <div className="space-y-4">
              {memoryStats.scenarios.map((scenarioStats: ScenarioMemoryStats) => (
                <div
                  key={scenarioStats.scenario}
                  className={`border rounded-lg p-4 ${
                    scenarioStats.scenario === scenario
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg font-mono">
                          {scenarioStats.scenario}
                        </h3>
                        {scenarioStats.scenario === scenario && (
                          <span className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground">
                            Current
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Mock Files</div>
                          <div className="font-semibold">
                            {scenarioStats.mocksCount.toLocaleString()} files
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatBytes(scenarioStats.mocksSize)}
                          </div>
                        </div>

                        <div>
                          <div className="text-muted-foreground">Network Events</div>
                          <div className="font-semibold">
                            {scenarioStats.networkEventsCount.toLocaleString()} events
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatBytes(scenarioStats.networkEventsSize)}
                          </div>
                        </div>

                        <div>
                          <div className="text-muted-foreground">Total Size</div>
                          <div className="font-semibold">
                            {formatBytes(scenarioStats.totalSize)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {scenarioStats.networkEventsCount > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleClearNetworkEvents(scenarioStats.scenario)}
                          disabled={clearingScenario === scenarioStats.scenario}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          {clearingScenario === scenarioStats.scenario
                            ? 'Clearing...'
                            : 'Clear Events'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About Memory Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Mock Files:</strong> Recorded HTTP responses stored for replay. These are the
            core of Mockifyer's functionality and are typically kept long-term.
          </p>
          <p>
            <strong>Network Events:</strong> Detailed logs of network activity including request/response
            headers, bodies, timing, and traces. These are useful for debugging but can be safely
            cleared to free up space.
          </p>
          <p>
            <strong>Clearing Data:</strong> Clearing network events removes only the debug logs.
            Your mock recordings remain intact and continue to work. To clear mocks, use the Settings page.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
