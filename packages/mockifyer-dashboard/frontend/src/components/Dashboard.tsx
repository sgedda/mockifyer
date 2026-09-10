import { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import MockList from './MockList'
import MockEditor from './MockEditor'
import StatsView from './StatsView'
import Settings from './Settings'
import Timeline from './Timeline'
import Atlas from './Atlas'
import Network from './Network'
import DateConfig from './DateConfig'
import FixturePool from './FixturePool'
import SidebarNav from './SidebarNav'
import ClientConnectionsPanel from './ClientConnectionsPanel'
import { getMocks, getMock, getScenarioConfig, getProxyConfig, searchMocks, setScenario, updateProxyConfig } from '@/lib/api'
import type { MockFile, MockData, SimilarBodyGroupSummary } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Lock } from 'lucide-react'
import {
  formatScratchTtlHours,
  isScratchScenario,
  scenarioDisplayName,
} from '@/lib/scenario-display'

interface DashboardProps {
  scenario: string
  onScenarioChange: (scenario: string) => void
}

export default function Dashboard({ scenario, onScenarioChange }: DashboardProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [availableScenarios, setAvailableScenarios] = useState<string[]>([])
  const [scenarioLocks, setScenarioLocks] = useState<Record<string, boolean>>({})
  const [scratchTtlSec, setScratchTtlSec] = useState<number | undefined>(undefined)
  const [switchingScenario, setSwitchingScenario] = useState(false)
  const [scenarioFilter, setScenarioFilter] = useState('')
  const [proxyRecordOnMiss, setProxyRecordOnMiss] = useState<boolean | null>(null)
  const [proxyAllowUpstream, setProxyAllowUpstream] = useState<boolean | null>(null)
  const [proxySaving, setProxySaving] = useState(false)
  
  // Get active tab from URL path
  const getActiveTabFromPath = () => {
    const path = location.pathname
    if (path === '/mocks') return 'mocks'
    if (path === '/timeline') return 'timeline'
    if (path === '/atlas') return 'atlas'
    if (path === '/network') return 'network'
    if (path === '/fixture-pool') return 'fixture-pool'
    if (path === '/date-config') return 'date-config'
    if (path === '/settings') return 'settings'
    return 'stats' // default to stats (root path)
  }
  
  const [activeTab, setActiveTab] = useState(getActiveTabFromPath())
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mocks, setMocks] = useState<MockFile[]>([])
  const [allMocks, setAllMocks] = useState<MockFile[]>([])
  const [selectedMock, setSelectedMock] = useState<MockData | null>(null)
  const [loadingMock, setLoadingMock] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [similarBodyGroups, setSimilarBodyGroups] = useState<SimilarBodyGroupSummary[]>([])
  const mocksLoadAbortRef = useRef<AbortController | null>(null)
  const searchQueryRef = useRef(searchQuery)
  const { toast } = useToast()

  useEffect(() => {
    searchQueryRef.current = searchQuery
  }, [searchQuery])

  function isAbortError(error: unknown): boolean {
    return (
      (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError')
    )
  }

  const refreshScenarioConfig = useCallback(async () => {
    try {
      const cfg = await getScenarioConfig()
      const next = cfg.availableScenarios?.length ? cfg.availableScenarios : ['default', '_scratch']
      setAvailableScenarios(next)
      setScenarioLocks(cfg.scenarioLocks ?? {})
      setScratchTtlSec(cfg.scratchTtlSec)
    } catch {
      setAvailableScenarios(['default', '_scratch'])
      setScenarioLocks({})
      setScratchTtlSec(undefined)
    }
  }, [])

  useEffect(() => {
    void refreshScenarioConfig()
  }, [scenario, refreshScenarioConfig])

  useEffect(() => {
    void (async () => {
      try {
        const cfg = await getProxyConfig(scenario)
        setProxyRecordOnMiss(cfg.recordOnMiss)
        setProxyAllowUpstream(cfg.allowUpstream)
      } catch {
        // Provider might not be redis; keep null (hide)
        setProxyRecordOnMiss(null)
        setProxyAllowUpstream(null)
      }
    })()
  }, [scenario])

  async function saveProxyConfig(next: { recordOnMiss: boolean; allowUpstream: boolean }) {
    try {
      setProxySaving(true)
      await updateProxyConfig({ scenario, ...next })
      setProxyRecordOnMiss(next.recordOnMiss)
      setProxyAllowUpstream(next.allowUpstream)
      toast({
        title: 'Saved',
        description: `Proxy settings updated for "${scenario}"`,
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update proxy settings',
        variant: 'destructive',
      })
    } finally {
      setProxySaving(false)
    }
  }

  async function handleHeaderScenarioChange(nextScenario: string) {
    if (!nextScenario || nextScenario === scenario) return
    try {
      setSwitchingScenario(true)
      await setScenario(nextScenario)
      onScenarioChange(nextScenario)
      setSelectedMock(null)
      toast({
        title: 'Scenario changed',
        description: `Switched to "${nextScenario}"`,
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to change scenario',
        variant: 'destructive',
      })
    } finally {
      setSwitchingScenario(false)
    }
  }

  // Sync activeTab with URL path
  useEffect(() => {
    const tabFromPath = getActiveTabFromPath()
    if (tabFromPath !== activeTab) {
      setActiveTab(tabFromPath)
    }
  }, [location.pathname])

  useEffect(() => {
    if (activeTab === 'mocks') {
      loadMocks()
      // Check for endpoint query parameter
      const params = new URLSearchParams(location.search)
      const qParam = params.get('q')
      const endpointParam = params.get('endpoint')
      if (qParam) {
        setSearchQuery(qParam)
      } else if (endpointParam) {
        setSearchQuery(endpointParam)
      }
    } else {
      mocksLoadAbortRef.current?.abort()
    }
  }, [scenario, activeTab, location.search])

  // Handle tab change - update URL
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setSidebarOpen(false) // Close sidebar on mobile when navigating
    const pathMap: Record<string, string> = {
      'mocks': '/mocks',
      'timeline': '/timeline',
      'atlas': '/atlas',
      'network': '/network',
      'fixture-pool': '/fixture-pool',
      'stats': '/',
      'date-config': '/date-config',
      'settings': '/settings',
    }
    navigate(pathMap[tab] || '/')
  }

  async function loadMocks() {
    mocksLoadAbortRef.current?.abort()
    const ac = new AbortController()
    mocksLoadAbortRef.current = ac
    const { signal } = ac
    const requestedSearchQuery = searchQuery.trim()
    try {
      setLoading(true)
      setSimilarBodyGroups([])
      // List first without similarGroups so an empty/cleared scenario is not blocked
      // by GraphQL clustering (or by a previous scenario's in-flight cluster).
      const data = await getMocks(scenario, { signal })
      if (signal.aborted) return
      if (searchQueryRef.current.trim() !== requestedSearchQuery) return
      setMocks(data.files)
      setAllMocks(data.files)
      setLoading(false)

      const graphqlCount = data.files.reduce(
        (n, file) => (file.graphqlInfo?.query ? n + 1 : n),
        0
      )
      if (graphqlCount < 2) return

      try {
        const grouped = await getMocks(scenario, { similarGroups: true, signal })
        if (signal.aborted) return
        if (searchQueryRef.current.trim() !== requestedSearchQuery) return
        // Only update mocks if no search is active (clustering should not overwrite search results)
        if (!requestedSearchQuery) {
          setMocks(grouped.files)
        }
        setAllMocks(grouped.files)
        setSimilarBodyGroups(grouped.similarBodyGroups ?? [])
      } catch (error) {
        if (isAbortError(error)) return
        // List already rendered; similar clusters are optional.
      }
    } catch (error) {
      if (isAbortError(error)) return
      toast({
        title: 'Error',
        description: 'Failed to load mocks',
        variant: 'destructive',
      })
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab !== 'mocks') return

    const q = searchQuery.trim()
    if (!q) {
      // Restore full list when clearing search.
      if (allMocks.length > 0) {
        setMocks(allMocks)
        return
      }
      loadMocks()
      return
    }

    const t = window.setTimeout(() => {
      void (async () => {
        try {
          setLoading(true)
          const result = await searchMocks({ q, scenario, limit: 200 })
          setMocks(result.files)
        } catch (error) {
          toast({
            title: 'Error',
            description: 'Failed to search mocks',
            variant: 'destructive',
          })
        } finally {
          setLoading(false)
        }
      })()
    }, 350)

    return () => window.clearTimeout(t)
  }, [activeTab, scenario, searchQuery])

  async function handleMockSaved() {
    await loadMocks()
    const filename = selectedMock?.filename
    if (!filename) return
    try {
      const mockData = await getMock(filename, scenario)
      setSelectedMock(mockData)
    } catch {
      // Keep the editor open with the last loaded mock if refresh fails.
    }
  }

  async function handleSelectMock(file: MockFile) {
    try {
      setLoadingMock(true)
      const mockData = await getMock(file.filename, scenario)
      setSelectedMock(mockData)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load mock data',
        variant: 'destructive',
      })
    } finally {
      setLoadingMock(false)
    }
  }

  // Mocks come from GET /mocks or /mocks/search (full JSON); extra client filtering hid response-body hits.

  const filteredScenarioOptions = availableScenarios
    .filter((s) => s && s.trim())
    .filter((s) => {
      const f = scenarioFilter.trim().toLowerCase()
      if (!f) return true
      return s.toLowerCase().includes(f)
    })
    .sort((a, b) => {
      if (a === scenario) return -1
      if (b === scenario) return 1
      return a.localeCompare(b)
    })

  const scenarioLocked = scenarioLocks[scenario] === true
  const viewingScratch = isScratchScenario(scenario)
  const scratchTtlLabel = formatScratchTtlHours(scratchTtlSec)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - hidden on mobile, shown via hamburger */}
      <div
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <SidebarNav 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          onNavigate={() => setSidebarOpen(false)}
        />
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            {/* Hamburger menu button - visible on mobile */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-md hover:bg-accent transition-colors"
              aria-label="Toggle menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {sidebarOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-semibold">Mockifyer Dashboard</h1>
              <p className="text-sm text-muted-foreground">Manage and view your API mock data</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {proxyRecordOnMiss !== null && proxyAllowUpstream !== null && (
              <div className="hidden md:flex items-center gap-2 mr-2">
                <Button
                  type="button"
                  variant={proxyRecordOnMiss ? 'default' : 'outline'}
                  size="sm"
                  className="h-9"
                  disabled={proxySaving}
                  title="When enabled, proxy writes a mock to Redis on upstream miss."
                  onClick={() =>
                    saveProxyConfig({
                      recordOnMiss: !proxyRecordOnMiss,
                      allowUpstream: proxyAllowUpstream,
                    })
                  }
                >
                  Record: {proxyRecordOnMiss ? 'On' : 'Off'}
                </Button>
                <Button
                  type="button"
                  variant={proxyAllowUpstream ? 'outline' : 'destructive'}
                  size="sm"
                  className="h-9"
                  disabled={proxySaving}
                  title={
                    proxyAllowUpstream
                      ? 'Upstream calls allowed on miss.'
                      : 'Offline mode: upstream calls blocked on miss.'
                  }
                  onClick={() =>
                    saveProxyConfig({
                      recordOnMiss: proxyRecordOnMiss,
                      allowUpstream: !proxyAllowUpstream,
                    })
                  }
                >
                  Upstream: {proxyAllowUpstream ? 'Allow' : 'Block'}
                </Button>
              </div>
            )}
            <span className="hidden sm:inline text-xs text-muted-foreground">Scenario</span>
            <DropdownMenu
              onOpenChange={(open) => {
                if (!open) setScenarioFilter('')
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2"
                  disabled={switchingScenario}
                  title={
                    viewingScratch
                      ? `Temporary unscoped traffic (expires in ~${scratchTtlLabel}). Select a named scenario to keep mocks.`
                      : scenarioLocked
                        ? 'Scenario is locked (read-only mocks)'
                        : 'Change scenario'
                  }
                >
                  {scenarioLocked ? (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  ) : null}
                  {viewingScratch ? (
                    <Badge variant="secondary">Temporary</Badge>
                  ) : null}
                  <Badge variant="outline" className="font-mono" title={scenario}>
                    {scenarioDisplayName(scenario)}
                  </Badge>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[min(24rem,92vw)] p-2">
                <div className="p-1">
                  <Input
                    value={scenarioFilter}
                    onChange={(e) => setScenarioFilter(e.target.value)}
                    placeholder="Filter scenarios…"
                    className="h-9"
                    autoFocus
                  />
                </div>
                <div className="mt-1 max-h-[18rem] overflow-auto">
                  {filteredScenarioOptions.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No scenarios match.</div>
                  ) : (
                    filteredScenarioOptions.map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => handleHeaderScenarioChange(s)}
                        disabled={s === scenario || switchingScenario}
                        className={`${s === scenario ? 'bg-primary/10' : ''}`}
                        title={s}
                      >
                        <span className={isScratchScenario(s) ? '' : 'font-mono'}>
                          {scenarioDisplayName(s)}
                        </span>
                        {isScratchScenario(s) ? (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            expires
                          </Badge>
                        ) : null}
                        {s === scenario ? ' ✓' : ''}
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {viewingScratch ? (
          <div className="border-b border-amber-500/40 bg-amber-500/10 px-6 py-2.5 text-sm text-amber-950 dark:text-amber-100 flex flex-wrap items-center justify-between gap-2">
            <p>
              Unscoped traffic is stored temporarily (~{scratchTtlLabel}) and expires automatically.
              Select a named scenario (for example <span className="font-mono">default</span>) to keep
              mocks long-term.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-600/50 bg-background/80"
              disabled={switchingScenario || scenario === 'default'}
              onClick={() => handleHeaderScenarioChange('default')}
            >
              Switch to default
            </Button>
          </div>
        ) : null}
        <ClientConnectionsPanel />
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route
              path="/"
              element={
                <StatsView
                  scenario={scenario}
                  onScenarioChange={(newScenario) => {
                    onScenarioChange(newScenario)
                  }}
                />
              }
            />
            <Route
              path="/mocks"
              element={
                <div className="space-y-6">
                  <MockList
                    mocks={mocks}
                    allMocks={allMocks}
                    similarBodyGroups={similarBodyGroups}
                    scenario={scenario}
                    scenarioLocked={scenarioLocked}
                    loading={loading}
                    loadingMock={loadingMock}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    selectedMock={selectedMock}
                    onSelectMock={handleSelectMock}
                    onRefresh={loadMocks}
                  />
                  <Dialog
                    open={!!selectedMock}
                    onOpenChange={(open) => {
                      if (!open) setSelectedMock(null)
                    }}
                  >
                    <DialogContent
                      showCloseButton
                      className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96rem,96vw)] w-[min(96rem,96vw)]"
                    >
                      {selectedMock ? (
                        <>
                          <DialogTitle className="sr-only">Edit mock {selectedMock.filename}</DialogTitle>
                          <MockEditor
                            variant="modal"
                            mock={selectedMock}
                            allMocks={allMocks}
                            onSelectRelatedMock={handleSelectMock}
                            scenario={scenario}
                            scenarioLocked={scenarioLocked}
                            onClose={() => setSelectedMock(null)}
                            onSave={handleMockSaved}
                            onListRefresh={loadMocks}
                          />
                        </>
                      ) : null}
                    </DialogContent>
                  </Dialog>
                </div>
              }
            />
            <Route path="/timeline" element={<Timeline scenario={scenario} />} />
            <Route path="/atlas" element={<Atlas scenario={scenario} />} />
            <Route path="/network" element={<Network scenario={scenario} />} />
            <Route path="/fixture-pool" element={<FixturePool scenario={scenario} />} />
            <Route path="/date-config" element={<DateConfig />} />
            <Route
              path="/settings"
              element={
                <Settings
                  scenario={scenario}
                  scenarioLocks={scenarioLocks}
                  onScenarioChange={(newScenario) => {
                    onScenarioChange(newScenario)
                    setSelectedMock(null)
                  }}
                  onScenarioConfigRefresh={refreshScenarioConfig}
                  onMocksChanged={async () => {
                    setSelectedMock(null)
                    await loadMocks()
                  }}
                />
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  )
}
