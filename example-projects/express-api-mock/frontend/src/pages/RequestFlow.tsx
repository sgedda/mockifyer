import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Clock, List, Network, GitBranch, FileText, ArrowRight } from 'lucide-react'
import { getMockFiles } from '@/lib/api'
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

type ViewMode = 'timeline' | 'graph' | 'list'

export default function RequestFlow() {
  const [requests, setRequests] = useState<FlowRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')
  const [selectedRequest, setSelectedRequest] = useState<FlowRequest | null>(null)
  const [sessionInfo, setSessionInfo] = useState<{
    sessionId: string
    totalRequests: number
    duration: string
    started: string
  } | null>(null)

  useEffect(() => {
    loadFlowData()
  }, [])

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
              sessionId: mockData.data?.sessionId || generateSessionId(file.modified),
              requestId: mockData.data?.requestId || file.filename,
              parentRequestId: mockData.data?.parentRequestId,
              source: mockData.data?.source || mockData.data?.callStack?.[0] || 'Unknown',
              duration: mockData.data?.duration || mockData.data?.responseTime,
              timestamp: mockData.data?.timestamp || file.modified,
              modified: file.modified,
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
              sessionId: generateSessionId(file.modified),
              requestId: file.filename,
              timestamp: file.modified,
              modified: file.modified,
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
            duration: duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`,
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

  function getMethodBadgeClass(method: string): string {
    const classes: Record<string, string> = {
      GET: 'bg-green-500/20 text-green-400 border-green-500/30',
      POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      PUT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      PATCH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
    }
    return classes[method] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString()
  }

  function formatDuration(duration?: number): string {
    if (!duration) return 'N/A'
    return `${duration}ms`
  }

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

  const sessionMap = groupBySession(requests)
  const sessions = Array.from(sessionMap.entries())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Network className="h-8 w-8" />
          Request Flow Visualization
        </h1>
        <p className="text-muted-foreground mt-2">
          Visualize the order and origin of API requests
        </p>
      </div>

      {/* Session Info */}
      {sessionInfo && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Session ID</div>
                <div className="text-sm font-mono font-semibold">{sessionInfo.sessionId.substring(0, 20)}...</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Total Requests</div>
                <div className="text-sm font-semibold">{sessionInfo.totalRequests}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Duration</div>
                <div className="text-sm font-semibold text-green-500">{sessionInfo.duration}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Started</div>
                <div className="text-sm font-semibold">{sessionInfo.started}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Request Flow</CardTitle>
            <div className="flex gap-2 border rounded-md p-1">
              <Button
                variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('timeline')}
                className="h-8 px-3 text-sm"
              >
                <Clock className="h-4 w-4 mr-2" />
                Timeline
              </Button>
              <Button
                variant={viewMode === 'graph' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('graph')}
                className="h-8 px-3 text-sm"
              >
                <Network className="h-4 w-4 mr-2" />
                Graph
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8 px-3 text-sm"
              >
                <List className="h-4 w-4 mr-2" />
                List
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No request flow data available. Make some API calls to see the flow visualization.
            </div>
          ) : viewMode === 'timeline' ? (
            <div className="space-y-8">
              {sessions.map(([sessionId, sessionRequests], sessionIndex) => (
                <div key={sessionId} className="relative pl-8 border-l-2 border-primary/30">
                  <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-primary border-4 border-background"></div>
                  <Card className="ml-4 mb-6">
                    <CardHeader className="bg-primary/10">
                      <CardTitle className="text-lg">
                        Session #{sessionIndex + 1}: {sessionId.substring(0, 20)}...
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {sessionRequests.length} request(s) • Started: {formatDate(sessionRequests[0].timestamp || sessionRequests[0].modified)} • Duration: {calculateSessionDuration(sessionRequests)}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  {sessionRequests.map((req, reqIndex) => (
                    <div key={req.filename} className="relative pl-8 mb-4">
                      <div className="absolute -left-2 top-2 w-3 h-3 rounded-full bg-primary/50 border-2 border-background"></div>
                      <Card 
                        className="ml-4 hover:border-primary/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedRequest(req)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="px-2 py-0.5 rounded text-xs font-mono bg-primary/20 text-primary border border-primary/30">
                                  #{req.sequence || reqIndex + 1}
                                </span>
                                <Badge className={`${getMethodBadgeClass(req.method)} border`}>
                                  {req.method}
                                </Badge>
                                <span className="text-sm font-mono text-foreground truncate flex-1">
                                  {req.url || req.filename}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                {req.parentRequestId ? (
                                  <span className="text-primary flex items-center gap-1">
                                    <GitBranch className="h-3 w-3" />
                                    Parent: {req.parentRequestId.substring(0, 20)}...
                                  </span>
                                ) : (
                                  <span className="text-green-500">🌱 Root request</span>
                                )}
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {req.filename}
                                </span>
                                {req.source && <span>📍 {req.source}</span>}
                                {req.duration && <span>⏱ {formatDuration(req.duration)}</span>}
                                <span>🕐 {formatDate(req.timestamp || req.modified)}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-3">
              {requests.map((req, index) => (
                <Card 
                  key={req.filename} 
                  className="hover:border-primary/50 transition-all hover:shadow-md cursor-pointer"
                  onClick={() => setSelectedRequest(req)}
                >
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-[60px_80px_1fr_200px_150px] gap-4 items-center">
                      <div className="flex items-center gap-2 md:block">
                        <span className="px-2 py-1 rounded text-xs font-mono bg-primary/20 text-primary border border-primary/30 text-center">
                          #{req.sequence || index + 1}
                        </span>
                        <Badge className={`${getMethodBadgeClass(req.method)} border md:mt-2`}>
                          {req.method}
                        </Badge>
                      </div>
                      <span className="text-sm font-mono text-foreground truncate" title={req.url || req.filename}>
                        {req.url || req.filename}
                      </span>
                      <span className="text-xs text-muted-foreground truncate" title={req.source || req.filename}>
                        {req.source || req.filename}
                      </span>
                      <div className="text-left md:text-right">
                        <div className="text-xs text-green-500 font-mono">{formatDuration(req.duration)}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(req.timestamp || req.modified)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {sessions.map(([sessionId, sessionRequests]) => (
                <div key={sessionId} className="space-y-4">
                  {sessionRequests.map((req, index) => {
                    const nextReq = sessionRequests[index + 1]
                    const isLast = index === sessionRequests.length - 1
                    
                    return (
                      <div key={req.filename} className="flex items-center gap-4">
                        <Card 
                          className="flex-1 hover:border-primary/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedRequest(req)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-1 rounded text-xs font-mono bg-primary/20 text-primary border border-primary/30">
                                #{req.sequence || index + 1}
                              </span>
                              <Badge className={`${getMethodBadgeClass(req.method)} border`}>
                                {req.method}
                              </Badge>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-mono truncate">{req.url || req.filename}</div>
                                <div className="text-xs text-muted-foreground truncate">{req.source || req.filename}</div>
                              </div>
                              <div className="text-xs text-green-500 font-mono">{formatDuration(req.duration)}</div>
                            </div>
                          </CardContent>
                        </Card>
                        {!isLast && (
                          <ArrowRight className="h-5 w-5 text-primary flex-shrink-0" />
                        )}
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

            {selectedRequest.source && (
              <div>
                <h3 className="font-semibold mb-2">Source Location</h3>
                <div className="bg-muted p-4 rounded-md text-sm">
                  <div><strong>Source:</strong> <code className="bg-background px-1 rounded">{selectedRequest.source}</code></div>
                </div>
              </div>
            )}

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
              <div>
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
    if (duration < 1000) return `${duration}ms`
    return `${(duration / 1000).toFixed(2)}s`
  }
}
