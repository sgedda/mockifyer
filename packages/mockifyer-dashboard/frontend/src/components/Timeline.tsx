import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { getMocks } from '@/lib/api'
import type { MockFile } from '@/types'
import { Clock, GitBranch } from 'lucide-react'

interface FlowRequest extends Omit<MockFile, 'sessionId'> {
  sessionId?: string | null
  requestId?: string
  parentRequestId?: string
  sequence?: number
  source?: string
  duration?: number
  timestamp?: string
}

export default function Timeline({ scenario }: { scenario: string }) {
  const [mocks, setMocks] = useState<FlowRequest[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadFlowData()
  }, [scenario])

  async function loadFlowData() {
    try {
      setLoading(true)
      const data = await getMocks(scenario)
      // Enrich mocks with flow data from metadata
      const flowMocks = await Promise.all(
        data.files.map(async (file) => {
          try {
            const response = await fetch(`/api/mocks/${file.filename}`)
            const mockData = await response.json()
            return {
              ...file,
              sessionId: mockData.data?.sessionId || generateSessionId(file.modified),
              requestId: mockData.data?.requestId || file.filename,
              parentRequestId: mockData.data?.parentRequestId,
              sequence: mockData.data?.sequence,
              source: mockData.data?.source || mockData.data?.callStack?.[0] || 'Unknown',
              duration: mockData.data?.duration || mockData.data?.responseTime,
              timestamp: mockData.data?.timestamp || file.modified,
            } as FlowRequest
          } catch {
            return {
              ...file,
              sessionId: generateSessionId(file.modified),
              requestId: file.filename,
              timestamp: file.modified,
            } as FlowRequest
          }
        })
      )
      setMocks(flowMocks)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load timeline data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  function generateSessionId(timestamp: string): string {
    // Group requests within 5 minutes
    const time = new Date(timestamp).getTime()
    const sessionWindow = 5 * 60 * 1000 // 5 minutes
    return `session-${Math.floor(time / sessionWindow)}`
  }

  function groupBySession(requests: FlowRequest[]): Map<string, FlowRequest[]> {
    const sessionMap = new Map<string, FlowRequest[]>()
    requests.forEach((req) => {
      const sessionId = req.sessionId || generateSessionId(req.timestamp || req.modified)
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, [])
      }
      sessionMap.get(sessionId)!.push(req)
    })
    // Sort requests within each session by timestamp
    sessionMap.forEach((sessionRequests) => {
      sessionRequests.sort((a, b) => {
        const timeA = new Date(a.timestamp || a.modified).getTime()
        const timeB = new Date(b.timestamp || b.modified).getTime()
        return timeA - timeB
      })
      // Assign sequence numbers if not present
      sessionRequests.forEach((req, index) => {
        if (!req.sequence) {
          req.sequence = index + 1
        }
      })
    })
    return sessionMap
  }

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

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString()
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

  function getMethodColor(method: string): string {
    const colors: Record<string, string> = {
      GET: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      POST: 'bg-green-500/20 text-green-300 border-green-500/30',
      PUT: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      PATCH: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      DELETE: 'bg-red-500/20 text-red-300 border-red-500/30',
    }
    return colors[method] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'
  }


  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading timeline...</div>
        </CardContent>
      </Card>
    )
  }

  const sessionMap = groupBySession(mocks)
  const sessions = Array.from(sessionMap.entries())

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Timeline</h2>
        <p className="text-sm text-muted-foreground">
          Visualize API request sequences and dependencies
        </p>
      </div>

      {mocks.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">No timeline data available</div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Session Grouping:</strong> Requests are automatically grouped into sessions based on their timestamps. 
                Requests occurring within 5 minutes of each other are grouped into the same session, helping visualize related API calls 
                from a single user interaction or test scenario.
              </p>
            </CardContent>
          </Card>
          <div className="space-y-8">
          {sessions.map(([sessionId, sessionRequests], sessionIndex) => (
            <div key={sessionId} className="relative pl-8 border-l-2 border-primary/30">
              <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-primary border-4 border-background"></div>
              <Card className="ml-4 mb-6">
                <CardHeader className="bg-primary/10">
                  <CardTitle className="text-lg">
                    Session #{sessionIndex + 1}: {sessionId.substring(0, 20)}...
                  </CardTitle>
                  <div className="text-sm text-muted-foreground mt-2">
                    {sessionRequests.length} request(s) • Started: {formatDate(sessionRequests[0].timestamp || sessionRequests[0].modified)} • Duration: {calculateSessionDuration(sessionRequests)}
                  </div>
                </CardHeader>
              </Card>
              {sessionRequests.map((req, reqIndex) => (
                <div key={req.filename} className="relative pl-8 mb-4">
                  <div className="absolute -left-2 top-2 w-3 h-3 rounded-full bg-primary/50 border-2 border-background"></div>
                  <Card className="ml-4 hover:border-primary/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded text-xs font-mono bg-muted">
                              #{req.sequence || reqIndex + 1}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getMethodColor(extractMethod(req.endpoint))}`}>
                              {extractMethod(req.endpoint)}
                            </span>
                            <span className="text-sm font-mono text-foreground truncate flex-1">
                              {extractUrl(req.endpoint) || req.filename}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            {req.parentRequestId ? (
                              <span className="text-primary">
                                <GitBranch className="h-3 w-3 inline mr-1" />
                                Parent: {req.parentRequestId.substring(0, 20)}...
                              </span>
                            ) : (
                              <span className="text-green-500">🌱 Root request</span>
                            )}
                            <span>📄 {req.filename}</span>
                            {req.source && <span>📍 {req.source}</span>}
                            {req.duration !== undefined && (
                              <span className="flex items-center gap-1 font-mono text-primary">
                                <Clock className="h-3 w-3" />
                                {req.duration}ms
                              </span>
                            )}
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
        </div>
      )}
    </div>
  )
}
