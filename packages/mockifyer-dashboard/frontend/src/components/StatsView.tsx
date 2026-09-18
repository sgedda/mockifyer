import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DASHBOARD_Q, hopsFocusPath, mockEditorPath, mocksListPath } from '@/lib/dashboard-urls'
import { useLocationQuery } from '@/lib/use-location-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { ServiceHopSummaryCard } from '@/components/ServiceChainList'
import { getStats, getScenarioConfig, setScenario } from '@/lib/api'
import { countServiceChainHops, useMockServiceChains } from '@/lib/use-mock-service-chains'
import { ColoredHopLabel } from '@/components/ColoredHopLabel'
import { httpMethodTextClass } from '@/lib/http-method-style'
import {
  endpointHostname,
  formatHopPathLabel,
  hopPathLabelSourceWithCatalog,
  indexChainLeafFilenames,
  isChainLeafHop,
  isOpaqueMockFilename,
  type HopPathLabelSource,
} from '@/lib/mock-correlation-chains'
import type { RankedResponseStat, ReplayModeBreakdown, Stats } from '@/types'
import {
  BarChart3,
  FileText,
  Database,
  Activity,
  ChevronDown,
  ExternalLink,
  Folder,
  GitFork,
  Globe,
  Clock,
  HardDrive,
  Radio,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { CopyableText } from '@/components/CopyableText'

interface StatsViewProps {
  scenario: string
  onScenarioChange: (scenario: string) => void
}

const EMPTY_REPLAY_MODES: ReplayModeBreakdown = {
  replay: 0,
  refresh: 0,
  pending: 0,
  live: 0,
}

const REPLAY_MODE_ROWS: Array<{
  key: keyof ReplayModeBreakdown
  label: string
  hint: string
  badgeClass: string
}> = [
  {
    key: 'replay',
    label: 'Replay',
    hint: 'Serves the saved mock body',
    badgeClass: 'border-sky-500/40 text-sky-100',
  },
  {
    key: 'refresh',
    label: 'Refresh',
    hint: 'Hits live API and updates the stored snapshot',
    badgeClass: 'border-cyan-500/40 text-cyan-100',
  },
  {
    key: 'pending',
    label: 'Pending',
    hint: 'Waiting for a captured response',
    badgeClass: 'border-amber-500/40 text-amber-100',
  },
  {
    key: 'live',
    label: 'Live',
    hint: 'Always uses the live API',
    badgeClass: 'border-orange-500/40 text-orange-100',
  },
]

function formatStatsDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function statsValueClass(tone: 'size' | 'duration' | 'date' | 'count'): string {
  switch (tone) {
    case 'size':
      return 'text-amber-300/90'
    case 'duration':
      return 'text-cyan-300/90'
    case 'date':
      return 'text-zinc-500'
    default:
      return 'text-zinc-400'
  }
}

function StatsHopRow({
  filename,
  source,
  title,
  value,
  valueTone = 'count',
  scenario,
  isMockReplay = false,
}: {
  filename: string
  source: HopPathLabelSource
  title?: string
  value: string
  valueTone?: 'size' | 'duration' | 'date' | 'count'
  scenario: string
  isMockReplay?: boolean
}) {
  const label = formatHopPathLabel(source)
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1 -mx-2 rounded-md hover:bg-accent/50">
      <Link
        to={hopsFocusPath({ scenario, filename })}
        className="min-w-0 flex-1 font-mono text-xs truncate"
        title={title && !isOpaqueMockFilename(title) ? title : label}
      >
        <ColoredHopLabel source={source} />
      </Link>
      <div className="flex items-center gap-1.5 shrink-0">
        {isMockReplay ? (
          <Link
            to={mockEditorPath(filename, { scenario })}
            title="Stored mock — nested hops may not have been recorded, so this may not be a true leaf"
          >
            <Badge variant="outline" className="h-4 px-1 text-[10px] border-sky-500/40 text-sky-100">
              Mock
            </Badge>
          </Link>
        ) : (
          <Link
            to={mockEditorPath(filename, { scenario })}
            title="Open mock"
            className="text-muted-foreground hover:text-foreground"
          >
            <FileText className="h-3 w-3" />
          </Link>
        )}
        <span className={`tabular-nums text-xs ${statsValueClass(valueTone)}`}>{value}</span>
      </div>
    </div>
  )
}

export default function StatsView({ scenario, onScenarioChange }: StatsViewProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [availableScenarios, setAvailableScenarios] = useState<string[]>([])
  const [switching, setSwitching] = useState(false)
  const { toast } = useToast()
  const navigate = useNavigate()
  const { searchParams, patch } = useLocationQuery()
  const selectedDomain = searchParams.get(DASHBOARD_Q.domain)?.trim() || ''
  const {
    mocks: hopMocks,
    chains: hopChains,
    loading: hopsLoading,
  } = useMockServiceChains(scenario)
  const mocksByFilename = useMemo(() => {
    const byFilename = new Map<string, (typeof hopMocks)[number]>()
    for (const mock of hopMocks) byFilename.set(mock.filename, mock)
    return byFilename
  }, [hopMocks])

  function statsHopCopy(item: {
    filename: string
    method: string
    endpoint: string
    operationName?: string | null
  }): { source: HopPathLabelSource; title: string } {
    const catalog = mocksByFilename.get(item.filename)
    const source = hopPathLabelSourceWithCatalog(item, catalog)
    const endpoint = [item.endpoint, catalog?.endpoint].find(
      (value) => value && !isOpaqueMockFilename(value)
    )
    return { source, title: endpoint || formatHopPathLabel(source) }
  }
  const visibleHopChains = useMemo(() => {
    if (!selectedDomain) return hopChains
    return hopChains.filter((chain) =>
      chain.hops.some((hop) => endpointHostname(hop.endpoint) === selectedDomain)
    )
  }, [hopChains, selectedDomain])
  const hopCount = countServiceChainHops(visibleHopChains)
  const chainLeaves = useMemo(() => indexChainLeafFilenames(visibleHopChains), [visibleHopChains])

  function handleEndpointClick(endpoint: string) {
    navigate(
      mocksListPath({
        scenario,
        [DASHBOARD_Q.q]: endpoint,
      })
    )
  }

  function handleFolderFilter(folderLabel: string) {
    if (folderLabel === '(scenario root)') return
    navigate(
      mocksListPath({
        scenario,
        [DASHBOARD_Q.q]: `${folderLabel}/`,
      })
    )
  }

  useEffect(() => {
    loadScenarios()
  }, [])

  useEffect(() => {
    loadStats()
    const interval = setInterval(() => loadStats(), 30_000)
    return () => clearInterval(interval)
  }, [scenario, selectedDomain])

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
      const data = await getStats(scenarioOverride ?? scenario, selectedDomain || undefined)
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

  function formatDurationMs(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)} ms`
    if (ms < 10_000) return `${(ms / 1000).toFixed(2)} s`
    return `${(ms / 1000).toFixed(1)} s`
  }

  function visibleLeafHops(items: RankedResponseStat[] | undefined): RankedResponseStat[] {
    const list = items ?? []
    if (hopsLoading && visibleHopChains.length === 0) return list
    const chainLeavesOnly = list.filter((item) => isChainLeafHop(item.filename, chainLeaves))
    return chainLeavesOnly.length > 0 ? chainLeavesOnly : list
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

  const replayModes = stats.replayModes ?? EMPTY_REPLAY_MODES
  const upstreamCount = replayModes.live + replayModes.pending + replayModes.refresh
  const domainNames = Object.keys(stats.domains).sort((a, b) => a.localeCompare(b))
  const slowestLeaves = visibleLeafHops(stats.slowestResponses)
  const largestLeaves = visibleLeafHops(stats.largestResponses)

  return (
    <div className="space-y-6">
      {(stats.mockDataPath || domainNames.length > 0) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              {stats.mockDataPath && (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-sm font-medium text-muted-foreground shrink-0">Mock Data Path:</span>
                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded min-w-0 flex-1 truncate">
                    {stats.scenarioPath || stats.mockDataPath}
                  </code>
                </div>
              )}
              {domainNames.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 max-w-[min(100%,18rem)] shrink-0 gap-1.5"
                      title="Show statistics for one domain"
                    >
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{selectedDomain || 'All domains'}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                    <DropdownMenuItem
                      onClick={() => patch({ [DASHBOARD_Q.domain]: null })}
                      className={!selectedDomain ? 'bg-primary/10' : ''}
                    >
                      All domains
                      {!selectedDomain && ' ✓'}
                    </DropdownMenuItem>
                    {domainNames.map((domain) => (
                      <DropdownMenuItem
                        key={domain}
                        onClick={() => patch({ [DASHBOARD_Q.domain]: domain })}
                        className={domain === selectedDomain ? 'bg-primary/10' : ''}
                      >
                        <span className="truncate">{domain}</span>
                        <span className="ml-3 text-muted-foreground tabular-nums">
                          {stats.domains[domain]}
                        </span>
                        {domain === selectedDomain ? ' ✓' : ''}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
            <CardTitle className="text-sm font-medium">Service hops</CardTitle>
            <GitFork className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hopsLoading ? '—' : hopCount}</div>
            <p className="text-xs text-muted-foreground">
              {hopsLoading
                ? 'Loading chains…'
                : `${visibleHopChains.length} request chain${visibleHopChains.length === 1 ? '' : 's'}`}
            </p>
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
        <ServiceHopSummaryCard chains={visibleHopChains} loading={hopsLoading} scenario={scenario} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              Replay mode
            </CardTitle>
            <p className="text-xs text-muted-foreground font-normal">
              Same buckets as hop Replay / Live / Pending / Refresh badges.
              {upstreamCount > 0
                ? ` ${upstreamCount} of ${stats.totalFiles} still call upstream.`
                : stats.totalFiles > 0
                  ? ' All recordings serve stored mocks.'
                  : ''}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-0.5">
              {REPLAY_MODE_ROWS.map((row) => (
                <Link
                  key={row.key}
                  to={mocksListPath({
                    scenario,
                    [DASHBOARD_Q.traffic]: row.key,
                    [DASHBOARD_Q.domain]: selectedDomain || undefined,
                  })}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1 -mx-2 text-sm hover:bg-accent/50"
                  title={`Show ${row.label.toLowerCase()} mocks`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${row.badgeClass}`}>
                      {row.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate" title={row.hint}>
                      {row.hint}
                    </span>
                  </div>
                  <span className="text-foreground font-medium shrink-0 tabular-nums">
                    {replayModes[row.key]}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Slowest leaf hops
            </CardTitle>
            <p className="text-xs text-muted-foreground font-normal">
              Lowest-level calls only — parent hops include nested request time.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-0.5">
              {slowestLeaves.length > 0 ? (
                slowestLeaves.map((item) => {
                  const copy = statsHopCopy(item)
                  return (
                  <StatsHopRow
                    key={item.filename}
                    filename={item.filename}
                    source={copy.source}
                    title={copy.title}
                    value={item.durationMs != null ? formatDurationMs(item.durationMs) : '—'}
                    valueTone="duration"
                    scenario={scenario}
                    isMockReplay={item.trafficMode === 'replay'}
                  />
                  )
                })
              ) : (
                <div className="text-sm text-muted-foreground">
                  No stored round-trip times on these leaf recordings. Dashboard proxy captures did not
                  save duration; new live recordings will.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              Largest leaf hops
            </CardTitle>
            <p className="text-xs text-muted-foreground font-normal">
              Lowest-level recordings — parent payloads include nested responses.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-0.5">
              {largestLeaves.length > 0 ? (
                largestLeaves.map((item) => {
                  const copy = statsHopCopy(item)
                  return (
                  <StatsHopRow
                    key={item.filename}
                    filename={item.filename}
                    source={copy.source}
                    title={copy.title}
                    value={formatFileSize(item.size)}
                    valueTone="size"
                    scenario={scenario}
                    isMockReplay={item.trafficMode === 'replay'}
                  />
                  )
                })
              ) : (
                <div className="text-sm text-muted-foreground">No leaf hop sizes recorded</div>
              )}
            </div>
          </CardContent>
        </Card>

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
                    <CopyableText
                      value={item.endpoint}
                      copyLabel="Copy endpoint URL"
                      className="flex-1 mr-2"
                      textClassName="font-mono text-xs group-hover:text-primary transition-colors"
                    />
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
                    <span className={`font-semibold ${httpMethodTextClass(method)}`}>{method}</span>
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
            <div className="space-y-0.5">
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((item) => {
                  const copy = statsHopCopy(item)
                  return (
                  <StatsHopRow
                    key={`${item.filename}-${item.modified}`}
                    filename={item.filename}
                    source={copy.source}
                    title={copy.title}
                    value={formatStatsDate(item.modified)}
                    valueTone="date"
                    scenario={scenario}
                  />
                  )
                })
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

