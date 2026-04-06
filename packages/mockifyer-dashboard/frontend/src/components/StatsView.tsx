import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { getStats, getScenarioConfig, setScenario } from '@/lib/api'
import type { Stats } from '@/types'
import { BarChart3, FileText, Database, Activity, ChevronDown, ExternalLink, Folder } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface StatsViewProps {
  scenario: string
  onScenarioChange: (scenario: string) => void
}

export default function StatsView({ scenario, onScenarioChange }: StatsViewProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [availableScenarios, setAvailableScenarios] = useState<string[]>([])
  const [switching, setSwitching] = useState(false)
  const { toast } = useToast()
  const navigate = useNavigate()

  function handleEndpointClick(endpoint: string) {
    navigate(`/mocks?endpoint=${encodeURIComponent(endpoint)}`)
  }

  function handleRecentFileClick(filename: string) {
    navigate(`/mocks?q=${encodeURIComponent(filename)}`)
  }

  function handleFolderFilter(folderLabel: string) {
    if (folderLabel === '(scenario root)') return
    navigate(`/mocks?q=${encodeURIComponent(`${folderLabel}/`)}`)
  }

  useEffect(() => {
    loadScenarios()
  }, [])

  useEffect(() => {
    loadStats()
    const interval = setInterval(() => loadStats(), 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [scenario])

  async function loadScenarios() {
    try {
      const config = await getScenarioConfig()
      const scenarios = (config as any).scenarios || config.availableScenarios || ['default']
      setAvailableScenarios(scenarios)
    } catch (error) {
      console.error('Failed to load scenarios:', error)
    }
  }

  async function handleScenarioChange(newScenario: string) {
    if (newScenario === scenario) return
    
    try {
      setSwitching(true)
      await setScenario(newScenario)
      onScenarioChange(newScenario)
      toast({
        title: 'Success',
        description: `Switched to scenario "${newScenario}"`,
      })
      await loadStats(newScenario)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to switch scenario',
        variant: 'destructive',
      })
    } finally {
      setSwitching(false)
    }
  }

  async function loadStats(scenarioOverride?: string) {
    try {
      const data = await getStats(scenarioOverride ?? scenario)
      setStats(data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (loading || !stats) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading statistics...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Mock Data Path Display */}
      {stats.mockDataPath && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Mock Data Path:</span>
              <code className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1 truncate">
                {stats.scenarioPath || stats.mockDataPath}
              </code>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFiles}</div>
            <p className="text-xs text-muted-foreground">Mock files</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatFileSize(stats.totalSize)}</div>
            <p className="text-xs text-muted-foreground">Storage used</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Endpoints</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.endpoints.length}</div>
            <p className="text-xs text-muted-foreground">Different APIs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scenario</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold font-mono flex-1">{stats.scenario}</div>
              {availableScenarios.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={switching}
                      className="h-8 px-2"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {availableScenarios.map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => handleScenarioChange(s)}
                        disabled={s === scenario || switching}
                        className={s === scenario ? 'bg-primary/10' : ''}
                      >
                        {s}
                        {s === scenario && ' ✓'}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {switching ? 'Switching...' : 'Current scenario'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.endpoints.length > 0 ? (
                stats.endpoints.map((item, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between text-sm group hover:bg-accent/50 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors cursor-pointer"
                    onClick={() => handleEndpointClick(item.endpoint)}
                    title={`Click to view mocks for ${item.endpoint}`}
                  >
                    <span className="font-mono text-xs truncate flex-1 group-hover:text-primary transition-colors">
                      {item.endpoint}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{item.count}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No endpoints</div>
              )}
            </div>
          </CardContent>
        </Card>

        {stats.folderBreakdown && stats.folderBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-primary" />
                Files by folder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {stats.folderBreakdown.map((row) => (
                  <div
                    key={row.folder}
                    className={`flex items-center justify-between gap-2 text-sm rounded-md px-2 py-1 -mx-2 -my-0.5 ${
                      row.folder !== '(scenario root)'
                        ? 'cursor-pointer hover:bg-accent/50'
                        : ''
                    }`}
                    onClick={() => handleFolderFilter(row.folder)}
                    title={
                      row.folder === '(scenario root)'
                        ? 'Mocks in scenario root (no subfolder)'
                        : `Show mocks under ${row.folder}/`
                    }
                  >
                    <span className="font-mono text-xs truncate text-muted-foreground" title={row.folder}>
                      {row.folder}
                    </span>
                    <span className="text-foreground shrink-0">{row.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>HTTP Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.keys(stats.methods).length > 0 ? (
                Object.entries(stats.methods).map(([method, count]) => (
                  <div key={method} className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{method}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No methods</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.keys(stats.statusCodes).length > 0 ? (
                Object.entries(stats.statusCodes)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([code, count]) => (
                    <div key={code} className="flex items-center justify-between text-sm">
                      <span className={`font-semibold ${
                        parseInt(code) >= 200 && parseInt(code) < 300 ? 'text-green-500' :
                        parseInt(code) >= 300 && parseInt(code) < 400 ? 'text-yellow-500' :
                        parseInt(code) >= 400 ? 'text-red-500' : ''
                      }`}>
                        {code}
                      </span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                  ))
              ) : (
                <div className="text-sm text-muted-foreground">No status codes</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm group hover:bg-accent/50 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors cursor-pointer"
                    onClick={() => handleRecentFileClick(item.filename)}
                    title="Open mocks list filtered to this file"
                  >
                    <span className="font-mono text-xs truncate flex-1 group-hover:text-primary">
                      {item.filename}
                    </span>
                    <span className="text-muted-foreground ml-4 text-xs shrink-0">
                      {new Date(item.modified).toLocaleDateString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

