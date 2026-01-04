import { useState, useEffect, useMemo, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Network, GitBranch, Search, BarChart3, Zap, FolderOpen } from 'lucide-react'
import { getMockFiles, getScenarioConfig, setScenario, type ScenarioConfig } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import CodeBlock from '@/components/CodeBlock'

interface FlowRequest {
  filename: string
  endpoint: string | null
  method: string
  url: string
  sequence?: number
  sessionId?: string
  requestId?: string
  parentRequestId?: string
  source?: string
  duration?: number
  timestamp?: string
  modified: string
  size: number
  requestHeaders?: Record<string, string>
  responseStatus?: number
  responseData?: any
  callStack?: string[]
}

export default function RequestFlow() {
  const [requests, setRequests] = useState<FlowRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<FlowRequest | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sessionInfo, setSessionInfo] = useState<{
    sessionId: string
    totalRequests: number
    duration: string
    started: string
  } | null>(null)
  const [scenarioConfig, setScenarioConfig] = useState<ScenarioConfig | null>(null)
  const [scenarioLoading, setScenarioLoading] = useState(false)
  const { toast } = useToast()
  const responseSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadScenarioConfig()
    loadFlowData()
  }, [])

  useEffect(() => {
    // Reload flow data when scenario changes
    if (scenarioConfig) {
      loadFlowData()
    }
  }, [scenarioConfig?.currentScenario])

  async function loadScenarioConfig() {
    try {
      const config = await getScenarioConfig()
      setScenarioConfig(config)
    } catch (error) {
      console.error('Failed to load scenario config:', error)
    }
  }

  async function handleScenarioChange(scenario: string) {
    try {
      setScenarioLoading(true)
      await setScenario(scenario)
      const config = await getScenarioConfig()
      setScenarioConfig(config)
      toast({
        title: 'Scenario Changed',
        description: `Switched to scenario: ${scenario}`,
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to change scenario',
        variant: 'destructive',
      })
    } finally {
      setScenarioLoading(false)
    }
  }

  async function loadFlowData() {
    try {
      setLoading(true)
      const data = await getMockFiles()
      
      // Fetch details for each mock file
      const flowRequests = await Promise.all(
        data.files.map(async (file, index) => {
          try {
            const response = await fetch(`/api/mocks/${file.filename}`)
            const mockData = await response.json()
            const endpoint = file.endpoint || mockData.data?.request?.url || ''
            const method = extractMethod(endpoint)
            const url = extractUrl(endpoint)
            
            return {
              filename: file.filename,
              endpoint: endpoint,
              method,
              url,
              sequence: mockData.data?.sequence || index + 1,
              sessionId: mockData.data?.sessionId || generateSessionId(file.modified.toISOString()),
              requestId: mockData.data?.requestId || file.filename,
              parentRequestId: mockData.data?.parentRequestId,
              source: mockData.data?.source || mockData.data?.callStack?.[0] || 'Unknown',
              duration: mockData.data?.duration || mockData.data?.responseTime,
              timestamp: mockData.data?.timestamp || file.modified.toISOString(),
              modified: file.modified.toISOString(),
              size: file.size,
              requestHeaders: mockData.data?.request?.headers,
              responseStatus: mockData.data?.response?.status,
              responseData: mockData.data?.response?.data,
              callStack: mockData.data?.callStack,
            } as FlowRequest
          } catch (error) {
            // Fallback if fetching fails
            const endpoint = file.endpoint || ''
            return {
              filename: file.filename,
              endpoint,
              method: extractMethod(endpoint),
              url: extractUrl(endpoint),
              sequence: index + 1,
              sessionId: generateSessionId(file.modified.toISOString()),
              requestId: file.filename,
              timestamp: file.modified.toISOString(),
              modified: file.modified.toISOString(),
              size: file.size,
            } as FlowRequest
          }
        })
      )

      // Sort by timestamp
      flowRequests.sort((a, b) => {
        const timeA = new Date(a.timestamp || a.modified).getTime()
        const timeB = new Date(b.timestamp || b.modified).getTime()
        return timeA - timeB
      })

      setRequests(flowRequests)

      // Calculate session info
      if (flowRequests.length > 0) {
        const sessionMap = groupBySession(flowRequests)
        const firstSession = Array.from(sessionMap.entries())[0]
        if (firstSession) {
          const [sessionId, sessionRequests] = firstSession
          const startTime = new Date(sessionRequests[0].timestamp || sessionRequests[0].modified)
          const endTime = new Date(
            sessionRequests[sessionRequests.length - 1].timestamp || 
            sessionRequests[sessionRequests.length - 1].modified
          )
          const duration = endTime.getTime() - startTime.getTime()
          
          setSessionInfo({
            sessionId,
            totalRequests: flowRequests.length,
            duration: formatDuration(duration),
            started: formatDate(startTime.toISOString()),
          })
        }
      }
    } catch (error) {
      console.error('Failed to load request flow:', error)
    } finally {
      setLoading(false)
    }
  }

  function generateSessionId(timestamp: string): string {
    const time = new Date(timestamp).getTime()
    const sessionWindow = 5 * 60 * 1000 // 5 minutes
    return `session-${Math.floor(time / sessionWindow)}`
  }

  function groupBySession(requests: FlowRequest[]): Map<string, FlowRequest[]> {
    const sessionMap = new Map<string, FlowRequest[]>()
    requests.forEach(req => {
      const sessionId = req.sessionId || generateSessionId(req.modified)
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, [])
      }
      sessionMap.get(sessionId)!.push(req)
    })
    return sessionMap
  }

  function extractMethod(endpoint: string | null): string {
    if (!endpoint) return 'GET'
    const parts = endpoint.split(' ')
    return parts[0] || 'GET'
  }

  function extractUrl(endpoint: string | null): string {
    if (!endpoint) return ''
    const parts = endpoint.split(' ')
    return parts.slice(1).join(' ') || endpoint
  }


  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString()
  }

  function formatDuration(duration?: number): string {
    if (!duration) return 'N/A'
    if (duration < 1000) return `${duration}ms`
    if (duration < 60000) return `${(duration / 1000).toFixed(2)}s`
    if (duration < 3600000) return `${(duration / 60000).toFixed(2)}m`
    return `${(duration / 3600000).toFixed(2)}h`
  }

  function formatRelativeTime(timestamp: string, referenceTime?: string): string {
    const time = new Date(timestamp).getTime()
    const ref = referenceTime ? new Date(referenceTime).getTime() : Date.now()
    const diff = ref - time
    
    if (diff < 0) {
      // Future time
      const absDiff = Math.abs(diff)
      if (absDiff < 1000) return 'now'
      if (absDiff < 60000) return `in ${Math.round(absDiff / 1000)}s`
      if (absDiff < 3600000) return `in ${Math.round(absDiff / 60000)}m`
      if (absDiff < 86400000) return `in ${Math.round(absDiff / 3600000)}h`
      return `in ${Math.round(absDiff / 86400000)}d`
    }
    
    if (diff < 1000) return 'now'
    if (diff < 60000) return `${Math.round(diff / 1000)}s ago`
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
    return `${Math.round(diff / 86400000)}d ago`
  }

  function formatTimeDifference(time1: string, time2: string): string {
    const t1 = new Date(time1).getTime()
    const t2 = new Date(time2).getTime()
    const diff = Math.abs(t2 - t1)
    
    if (diff < 1000) return '0ms'
    if (diff < 60000) return `${Math.round(diff / 1000)}s`
    if (diff < 3600000) return `${Math.round(diff / 60000)}m`
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h`
    return `${Math.round(diff / 86400000)}d`
  }

  // Filter requests based on search and filters
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch = 
          req.url?.toLowerCase().includes(query) ||
          req.filename.toLowerCase().includes(query) ||
          req.method.toLowerCase().includes(query) ||
          req.source?.toLowerCase().includes(query)
        if (!matchesSearch) return false
      }

      // Method filter
      if (methodFilter !== 'all' && req.method !== methodFilter) {
        return false
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'success' && (!req.responseStatus || req.responseStatus < 200 || req.responseStatus >= 300)) {
          return false
        }
        if (statusFilter === 'error' && req.responseStatus && req.responseStatus >= 400) {
          return true
        }
        if (statusFilter === 'error' && (!req.responseStatus || req.responseStatus < 400)) {
          return false
        }
      }

      return true
    })
  }, [requests, searchQuery, methodFilter, statusFilter])

  function extractDomain(url: string | null | undefined): string {
    if (!url) return 'Unknown'
    try {
      // Handle both full URLs and relative paths
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url)
        return urlObj.hostname
      }
      // For relative paths, try to extract from the path
      // If it starts with /api/, it's likely a local API
      if (url.startsWith('/api/')) {
        return 'Local API'
      }
      // Try to extract domain from path-like URLs
      const parts = url.split('/')
      if (parts.length > 0 && parts[0].includes('.')) {
        return parts[0]
      }
      return 'Local'
    } catch (e) {
      return 'Unknown'
    }
  }

  // Calculate statistics
  const statistics = useMemo(() => {
    const stats = {
      totalRequests: requests.length,
      methods: {} as Record<string, number>,
      statusCodes: {} as Record<number, number>,
      avgDuration: 0,
      slowestRequest: null as FlowRequest | null,
      fastestRequest: null as FlowRequest | null,
      errorCount: 0,
      uniqueEndpoints: new Set<string>(),
      domains: {} as Record<string, number>,
    }

    let totalDuration = 0
    let durationCount = 0

    requests.forEach(req => {
      // Count methods
      stats.methods[req.method] = (stats.methods[req.method] || 0) + 1

      // Count status codes
      if (req.responseStatus) {
        stats.statusCodes[req.responseStatus] = (stats.statusCodes[req.responseStatus] || 0) + 1
        if (req.responseStatus >= 400) {
          stats.errorCount++
        }
      }

      // Track durations
      if (req.duration) {
        totalDuration += req.duration
        durationCount++
        if (!stats.slowestRequest || req.duration > (stats.slowestRequest.duration || 0)) {
          stats.slowestRequest = req
        }
        if (!stats.fastestRequest || req.duration < (stats.fastestRequest.duration || 0)) {
          stats.fastestRequest = req
        }
      }

      // Track unique endpoints
      if (req.url) {
        stats.uniqueEndpoints.add(req.url)
      }

      // Count requests per domain
      const domain = extractDomain(req.url)
      stats.domains[domain] = (stats.domains[domain] || 0) + 1
    })

    stats.avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0

    return stats
  }, [requests])

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">Loading request flow...</div>
          </CardContent>
        </Card>
      </div>
    )
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Network className="h-8 w-8" />
            Request Flow Visualization
          </h1>
          <p className="text-muted-foreground mt-2">
            Visualize the order and origin of API requests
          </p>
        </div>
        {scenarioConfig && (
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Scenario:</span>
            <Select
              value={scenarioConfig.currentScenario}
              onValueChange={handleScenarioChange}
              disabled={scenarioLoading}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scenarioConfig.scenarios.map((scenario) => (
                  <SelectItem key={scenario} value={scenario}>
                    {scenario}
                    {scenario === scenarioConfig.currentScenario && ' (current)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Session Info */}
      {sessionInfo && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Session ID</div>
                <div className="text-xs sm:text-sm font-mono font-semibold break-all">{sessionInfo.sessionId.substring(0, 20)}...</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Total Requests</div>
                <div className="text-xs sm:text-sm font-semibold">{sessionInfo.totalRequests}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Duration</div>
                <div className="text-xs sm:text-sm font-semibold text-green-500">{sessionInfo.duration}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Started</div>
                <div className="text-xs sm:text-sm font-semibold break-words">{sessionInfo.started}</div>
              </div>
              {scenarioConfig && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Scenario</div>
                  <div className="text-xs sm:text-sm font-semibold flex items-center gap-1">
                    <FolderOpen className="h-3 w-3" />
                    {scenarioConfig.currentScenario}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Panel */}
      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Request Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              <div className="p-3 sm:p-4 bg-muted rounded-md">
                <div className="text-xs text-muted-foreground mb-1">Total Requests</div>
                <div className="text-xl sm:text-2xl font-bold">{statistics.totalRequests}</div>
              </div>
              <div className="p-3 sm:p-4 bg-muted rounded-md">
                <div className="text-xs text-muted-foreground mb-1">Unique Endpoints</div>
                <div className="text-xl sm:text-2xl font-bold">{statistics.uniqueEndpoints.size}</div>
              </div>
              <div className="p-3 sm:p-4 bg-muted rounded-md">
                <div className="text-xs text-muted-foreground mb-1">Avg Duration</div>
                <div className="text-xl sm:text-2xl font-bold text-green-500">{statistics.avgDuration}ms</div>
              </div>
              <div className="p-3 sm:p-4 bg-muted rounded-md">
                <div className="text-xs text-muted-foreground mb-1">Errors</div>
                <div className="text-xl sm:text-2xl font-bold text-red-500">{statistics.errorCount}</div>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              <div className="space-y-2 text-sm">
                {statistics.slowestRequest && (
                  <div>
                    <span className="text-muted-foreground">Slowest: </span>
                    <span className="font-mono">{formatDuration(statistics.slowestRequest.duration)}</span>
                    <span className="text-muted-foreground ml-2">({statistics.slowestRequest.url?.substring(0, 40)}...)</span>
                  </div>
                )}
                {statistics.fastestRequest && (
                  <div>
                    <span className="text-muted-foreground">Fastest: </span>
                    <span className="font-mono text-green-500">{formatDuration(statistics.fastestRequest.duration)}</span>
                    <span className="text-muted-foreground ml-2">({statistics.fastestRequest.url?.substring(0, 40)}...)</span>
                  </div>
                )}
              </div>
              
              {Object.keys(statistics.domains).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    Requests by Domain
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(statistics.domains)
                      .sort((a, b) => b[1] - a[1])
                      .map(([domain, count]) => (
                        <div key={domain} className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                          <span className="text-xs sm:text-sm font-mono text-foreground break-all">{domain}</span>
                          <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{count} request{count !== 1 ? 's' : ''}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Request Flow Timeline</CardTitle>
          <CardDescription>
            Visualize the order and origin of API requests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by URL, filename, method..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-2 sm:px-3 text-xs sm:text-sm"
            >
              <option value="all">All Methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-2 sm:px-3 text-xs sm:text-sm"
            >
              <option value="all">All Status</option>
              <option value="success">Success (2xx)</option>
              <option value="error">Errors (4xx+)</option>
            </select>
          </div>

          {requests.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No request flow data available. Make some API calls to see the flow visualization.
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No requests match your filters. Try adjusting your search criteria.
            </div>
          ) : (
            <div className="space-y-8">
              {Array.from(groupBySession(filteredRequests).entries()).map(([sessionId, sessionRequests], sessionIndex) => (
                <div key={sessionId} className="relative pl-8 border-l-2 border-primary/30">
                  <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-primary border-4 border-background"></div>
                  <Card className="ml-3 sm:ml-4 mb-4 sm:mb-6">
                    <CardHeader className="bg-primary/10 p-3 sm:p-6">
                      <CardTitle className="text-sm sm:text-lg break-words">
                        Session #{sessionIndex + 1}: {sessionId.substring(0, 20)}...
                      </CardTitle>
                      <CardDescription className="mt-2 text-xs sm:text-sm break-words">
                        {sessionRequests.length} request(s) • Started: {formatDate(sessionRequests[0].timestamp || sessionRequests[0].modified)} • Duration: {calculateSessionDuration(sessionRequests)}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  {sessionRequests.map((req, reqIndex) => {
                    const prevRequest = reqIndex > 0 ? sessionRequests[reqIndex - 1] : null
                    const timeSincePrev = prevRequest 
                      ? formatTimeDifference(
                          prevRequest.timestamp || prevRequest.modified,
                          req.timestamp || req.modified
                        )
                      : null
                    const relativeTime = formatRelativeTime(req.timestamp || req.modified)
                    
                    return (
                      <div key={req.filename} className="relative pl-6 sm:pl-8 mb-3 sm:mb-4">
                        <div className="absolute -left-1.5 sm:-left-2 top-2 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-primary/50 border-2 border-background"></div>
                        <Card 
                          className="ml-3 sm:ml-4 border-0 shadow-none bg-transparent hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedRequest(req)
                            // Scroll to response section after state update
                            setTimeout(() => {
                              responseSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            }, 100)
                          }}
                        >
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex items-start justify-between gap-2 sm:gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
                                  <span className="px-1.5 sm:px-2 py-0.5 rounded text-xs font-mono bg-primary/20 text-primary border border-primary/30 flex-shrink-0">
                                    #{req.sequence || reqIndex + 1}
                                  </span>
                                  {timeSincePrev && (
                                    <span className="px-1.5 sm:px-2 py-0.5 rounded text-xs font-mono bg-muted text-muted-foreground border border-border flex-shrink-0">
                                      +{timeSincePrev}
                                    </span>
                                  )}
                                </div>
                                <div className="mb-2">
                                  <span className="text-xs sm:text-sm font-mono text-foreground break-all">
                                    {req.url ? req.url : req.filename}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2 sm:gap-3 text-xs text-muted-foreground">
                                  {req.parentRequestId ? (
                                    <span className="text-primary flex items-center gap-1 flex-shrink-0">
                                      <GitBranch className="h-3 w-3 flex-shrink-0" />
                                      <span className="break-all">Parent: {req.parentRequestId.substring(0, 15)}...</span>
                                    </span>
                                  ) : (
                                    <span className="text-green-500 flex-shrink-0">🌱 Root request</span>
                                  )}
                                  <span className="text-green-500 font-semibold flex items-center gap-1 flex-shrink-0">
                                    <Zap className="h-3 w-3 flex-shrink-0" />
                                    {formatDuration(req.duration)}
                                  </span>
                                  <span className="flex-shrink-0" title={formatDate(req.timestamp || req.modified)}>
                                    🕐 {relativeTime}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Panel */}
      {selectedRequest && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Request Details</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Request Information</h3>
              <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
                <div><strong>Method:</strong> {selectedRequest.method}</div>
                <div><strong>URL:</strong> <code className="bg-background px-1 rounded">{selectedRequest.url || selectedRequest.filename}</code></div>
                <div><strong>Sequence:</strong> #{selectedRequest.sequence}</div>
                <div><strong>Request ID:</strong> <code className="bg-background px-1 rounded">{selectedRequest.requestId}</code></div>
                <div><strong>Timestamp:</strong> {formatDate(selectedRequest.timestamp || selectedRequest.modified)}</div>
                <div><strong>Duration:</strong> <span className="text-green-500">{formatDuration(selectedRequest.duration)}</span></div>
              </div>
            </div>


            {selectedRequest.callStack && selectedRequest.callStack.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Call Stack</h3>
                <CodeBlock 
                  code={selectedRequest.callStack.join('\n')} 
                  language="text"
                  small
                />
              </div>
            )}

            {selectedRequest.requestHeaders && Object.keys(selectedRequest.requestHeaders).length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Request Headers</h3>
                <CodeBlock 
                  code={JSON.stringify(selectedRequest.requestHeaders, null, 2)} 
                  language="json"
                />
              </div>
            )}

            {selectedRequest.responseStatus && (
              <div ref={responseSectionRef}>
                <h3 className="font-semibold mb-2">Response</h3>
                <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
                  <div><strong>Status:</strong> {selectedRequest.responseStatus}</div>
                  {selectedRequest.responseData && (
                    <div>
                      <strong>Data:</strong>
                      <CodeBlock 
                        code={JSON.stringify(selectedRequest.responseData, null, 2)} 
                        language="json"
                        small
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedRequest.parentRequestId && (
              <div>
                <h3 className="font-semibold mb-2">Relationships</h3>
                <div className="bg-muted p-4 rounded-md text-sm">
                  <div><strong>Parent Request:</strong> <code className="bg-background px-1 rounded">{selectedRequest.parentRequestId}</code></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )

  function calculateSessionDuration(sessionRequests: FlowRequest[]): string {
    if (sessionRequests.length === 0) return '0ms'
    const start = new Date(sessionRequests[0].timestamp || sessionRequests[0].modified).getTime()
    const end = new Date(
      sessionRequests[sessionRequests.length - 1].timestamp || 
      sessionRequests[sessionRequests.length - 1].modified
    ).getTime()
    const duration = end - start
    return formatDuration(duration)
  }
}
