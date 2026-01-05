import { useState, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { getMocks } from '@/lib/api'
import type { MockFile } from '@/types'
import { Clock, List, Network, GitBranch } from 'lucide-react'

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
  const [viewMode, setViewMode] = useState<'timeline' | 'graph' | 'list'>('timeline')
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

  function getMethodBadgeColor(method: string): { bg: string; text: string; border: string } {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      GET: { bg: 'rgba(59, 130, 246, 0.2)', text: '#93c5fd', border: 'rgba(59, 130, 246, 0.3)' },
      POST: { bg: 'rgba(34, 197, 94, 0.2)', text: '#86efac', border: 'rgba(34, 197, 94, 0.3)' },
      PUT: { bg: 'rgba(234, 179, 8, 0.2)', text: '#fde047', border: 'rgba(234, 179, 8, 0.3)' },
      PATCH: { bg: 'rgba(249, 115, 22, 0.2)', text: '#fdba74', border: 'rgba(249, 115, 22, 0.3)' },
      DELETE: { bg: 'rgba(239, 68, 68, 0.2)', text: '#fca5a5', border: 'rgba(239, 68, 68, 0.3)' },
    }
    return colors[method] || { bg: 'rgba(107, 114, 128, 0.2)', text: '#d1d5db', border: 'rgba(107, 114, 128, 0.3)' }
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Timeline</h2>
          <p className="text-sm text-muted-foreground">
            Visualize API request sequences and dependencies
          </p>
        </div>
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

      {mocks.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">No timeline data available</div>
          </CardContent>
        </Card>
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
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {mocks.map((req, index) => {
            const method = extractMethod(req.endpoint)
            const url = extractUrl(req.endpoint) || req.filename
            const isRoot = !req.parentRequestId
            
            return (
              <Card 
                key={req.filename} 
                className="hover:border-primary/50 transition-all hover:shadow-md"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Sequence number */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">
                          {req.sequence || index + 1}
                        </span>
                      </div>
                      
                      {/* Method badge */}
                      <div className={`px-3 py-1.5 rounded-md text-xs font-semibold border flex-shrink-0 ${getMethodColor(method)}`}>
                        {method}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-foreground truncate" title={url}>
                            {url}
                          </span>
                          {isRoot && (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30 flex-shrink-0">
                              🌱 Root
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="font-mono" title={req.filename}>
                            📄 {req.filename.length > 50 ? `${req.filename.substring(0, 47)}...` : req.filename}
                          </span>
                          {req.sessionId && (
                            <span className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              Session: {req.sessionId.substring(0, 12)}...
                            </span>
                          )}
                          {req.source && (
                            <span className="flex items-center gap-1">
                              📍 {req.source.length > 30 ? `${req.source.substring(0, 27)}...` : req.source}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Duration */}
                    <div className="flex-shrink-0 text-right">
                      {req.duration ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="font-mono">{req.duration}ms</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDate(req.timestamp || req.modified)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <GraphView 
          requests={mocks} 
          sessions={sessions}
          extractMethod={extractMethod}
          extractUrl={extractUrl}
          getMethodBadgeColor={getMethodBadgeColor}
        />
      )}
    </div>
  )
}

interface GraphViewProps {
  requests: FlowRequest[]
  sessions: Array<[string, FlowRequest[]]>
  extractMethod: (endpoint: string | null) => string
  extractUrl: (endpoint: string | null) => string
  getMethodBadgeColor: (method: string) => { bg: string; text: string; border: string }
}

function GraphView({ sessions, extractMethod, extractUrl, getMethodBadgeColor }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 })

  // Get computed CSS values for SVG - convert HSL to RGB
  const getComputedColor = (cssVar: string, opacity: number = 1): string => {
    if (typeof window === 'undefined') {
      // Fallback colors for SSR
      const fallbacks: Record<string, string> = {
        '--primary': 'hsl(217, 91%, 60%)',
        '--card': 'hsl(240, 10%, 15%)',
        '--border': 'hsl(240, 4%, 25%)',
        '--foreground': 'hsl(210, 40%, 95%)',
        '--muted-foreground': 'hsl(215, 20%, 70%)',
      }
      const fallback = fallbacks[cssVar] || 'hsl(0, 0%, 50%)'
      return opacity < 1 ? fallback.replace(')', ` / ${opacity})`) : fallback
    }
    
    const root = document.documentElement
    const value = getComputedStyle(root).getPropertyValue(cssVar).trim()
    if (!value) {
      // Fallback colors
      const fallbacks: Record<string, string> = {
        '--primary': 'hsl(217, 91%, 60%)',
        '--card': 'hsl(240, 10%, 15%)',
        '--border': 'hsl(240, 4%, 25%)',
        '--foreground': 'hsl(210, 40%, 95%)',
        '--muted-foreground': 'hsl(215, 20%, 70%)',
      }
      const fallback = fallbacks[cssVar] || 'hsl(0, 0%, 50%)'
      return opacity < 1 ? fallback.replace(')', ` / ${opacity})`) : fallback
    }
    
    // Convert HSL space-separated format to hsla() for SVG
    if (value.includes(' ')) {
      // HSL format: "221.2 83.2% 53.3%" or "240 10% 15%"
      const parts = value.split(' ').filter(p => p.trim())
      if (parts.length >= 3) {
        const h = parseFloat(parts[0])
        const s = parts[1].replace('%', '')
        const l = parts[2].replace('%', '')
        return `hsla(${h}, ${s}%, ${l}%, ${opacity})`
      }
    }
    return value
  }

  // Compute colors once on mount
  const [colors, setColors] = useState({
    primary: 'hsla(217, 91%, 60%, 0.4)',
    primaryLight: 'hsla(217, 91%, 60%, 0.15)',
    primaryVeryLight: 'hsla(217, 91%, 60%, 0.05)',
    card: 'hsl(240, 10%, 15%)',
    border: 'hsl(240, 4%, 25%)',
    foreground: 'hsl(210, 40%, 95%)',
    mutedForeground: 'hsl(215, 20%, 70%)',
  })

  useEffect(() => {
    setColors({
      primary: getComputedColor('--primary', 0.4),
      primaryLight: getComputedColor('--primary', 0.15),
      primaryVeryLight: getComputedColor('--primary', 0.05),
      card: getComputedColor('--card', 1),
      border: getComputedColor('--border', 1),
      foreground: getComputedColor('--foreground', 1),
      mutedForeground: getComputedColor('--muted-foreground', 1),
    })
  }, [])

  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current?.parentElement) {
        setDimensions({
          width: svgRef.current.parentElement.clientWidth || 1200,
          height: Math.max(600, sessions.length * 300)
        })
      }
    }
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [sessions.length])

  // Layout configuration
  const NODE_WIDTH = 300
  const NODE_HEIGHT = 140
  const HORIZONTAL_SPACING = 320
  const SESSION_SPACING = 300
  const TEXT_MAX_WIDTH = 150 // Max width for text (leaves room for sequence badge at x=280)

  // Build node and edge structures using useMemo
  const { nodes, edges } = useMemo(() => {
    const nodes: Array<{
      id: string
      request: FlowRequest
      x: number
      y: number
      level: number
      sessionIndex: number
    }> = []
    
    const edges: Array<{
      from: string
      to: string
      sessionIndex: number
    }> = []

    sessions.forEach(([, sessionRequests], sessionIndex) => {
    // Build parent-child map
    const requestMap = new Map<string, FlowRequest>()
    const childrenMap = new Map<string, FlowRequest[]>()
    const rootRequests: FlowRequest[] = []

    sessionRequests.forEach(req => {
      requestMap.set(req.requestId || req.filename, req)
      if (!req.parentRequestId) {
        rootRequests.push(req)
      } else {
        if (!childrenMap.has(req.parentRequestId)) {
          childrenMap.set(req.parentRequestId, [])
        }
        childrenMap.get(req.parentRequestId)!.push(req)
      }
    })

    // If no root requests, use first request as root
    if (rootRequests.length === 0 && sessionRequests.length > 0) {
      rootRequests.push(sessionRequests[0])
    }

    // Layout nodes hierarchically
    let yOffset = sessionIndex * SESSION_SPACING + 100
    let maxLevel = 0

    function layoutNode(request: FlowRequest, level: number, xOffset: number): number {
      const nodeId = request.requestId || request.filename
      const children = childrenMap.get(nodeId) || []
      
      if (level > maxLevel) maxLevel = level

      // Calculate position
      let x = 100 + level * HORIZONTAL_SPACING
      let y = yOffset

      // If has children, center vertically among children
      if (children.length > 0) {
        let minChildY = Infinity
        let maxChildY = -Infinity
        let childXOffset = xOffset

        children.forEach((child) => {
          const childY = layoutNode(child, level + 1, childXOffset)
          minChildY = Math.min(minChildY, childY)
          maxChildY = Math.max(maxChildY, childY)
          childXOffset += 1
        })

        y = (minChildY + maxChildY) / 2
      } else {
        yOffset += NODE_HEIGHT + 40
      }

      nodes.push({
        id: nodeId,
        request,
        x,
        y,
        level,
        sessionIndex
      })

      // Add edges to children
      children.forEach(child => {
        edges.push({
          from: nodeId,
          to: child.requestId || child.filename,
          sessionIndex
        })
      })

      return y
    }

    // Layout all root nodes
    rootRequests.forEach((root) => {
      layoutNode(root, 0, 0)
    })

    // Adjust y positions to account for session spacing
    nodes.forEach(node => {
      if (node.sessionIndex === sessionIndex) {
        node.y += sessionIndex * SESSION_SPACING
      }
    })
    })

    // Adjust all y positions to start from top
    if (nodes.length > 0) {
      const minY = Math.min(...nodes.map(n => n.y))
      nodes.forEach(node => {
        node.y = node.y - minY + 50
      })
    }

    return { nodes, edges }
  }, [sessions])

  const maxX = nodes.length > 0 ? Math.max(...nodes.map(n => n.x)) + NODE_WIDTH : 1200
  const maxY = nodes.length > 0 ? Math.max(...nodes.map(n => n.y)) + NODE_HEIGHT : 600

  if (nodes.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No timeline data available for graph visualization
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="relative overflow-auto bg-muted/20 rounded-lg border" style={{ minHeight: '600px' }}>
          <svg
            ref={svgRef}
            width={Math.max(dimensions.width, maxX + 100)}
            height={Math.max(dimensions.height, maxY + 100)}
            viewBox={`0 0 ${Math.max(dimensions.width, maxX + 100)} ${Math.max(dimensions.height, maxY + 100)}`}
            preserveAspectRatio="xMinYMin meet"
            style={{ display: 'block' }}
          >
            {/* Session backgrounds */}
            {sessions.map(([sessionId], sessionIndex) => {
              const sessionNodes = nodes.filter(n => n.sessionIndex === sessionIndex)
              if (sessionNodes.length === 0) return null
              const sessionMinY = Math.min(...sessionNodes.map(n => n.y))
              const sessionMaxY = Math.max(...sessionNodes.map(n => n.y))
              return (
                <rect
                  key={sessionId}
                  x={0}
                  y={sessionMinY - 20}
                  width={maxX + 100}
                  height={sessionMaxY - sessionMinY + NODE_HEIGHT + 40}
                  fill={colors.primaryVeryLight}
                  stroke={getComputedColor('--primary', 0.2)}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  rx={8}
                />
              )
            })}

            {/* Edges */}
            {edges.map((edge) => {
              const fromNode = nodes.find(n => n.id === edge.from)
              const toNode = nodes.find(n => n.id === edge.to)
              if (!fromNode || !toNode) return null

              const x1 = fromNode.x + NODE_WIDTH
              const y1 = fromNode.y + NODE_HEIGHT / 2
              const x2 = toNode.x
              const y2 = toNode.y + NODE_HEIGHT / 2

              // Curved edge
              const midX = (x1 + x2) / 2
              const controlY1 = y1
              const controlY2 = y2

              return (
                <g key={`${edge.from}-${edge.to}`}>
                  <path
                    d={`M ${x1} ${y1} C ${midX} ${controlY1}, ${midX} ${controlY2}, ${x2} ${y2}`}
                    stroke={colors.primary}
                    opacity={selectedNode === edge.from || selectedNode === edge.to ? 1 : 0.3}
                    strokeWidth={2}
                    fill="none"
                    markerEnd="url(#arrowhead)"
                    className="transition-opacity hover:opacity-100"
                  />
                </g>
              )
            })}

            {/* Arrow marker definition and clip paths */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3, 0 6"
                  fill={getComputedColor('--primary', 0.6)}
                />
              </marker>
              {/* Clip paths for each node - ensures text doesn't overflow */}
              {/* Use tighter clipPath to prevent any overflow */}
              {nodes.map((node) => (
                <clipPath key={`textClip-${node.id}`} id={`textClip-${node.id}`}>
                  <rect x="12" y="38" width={TEXT_MAX_WIDTH - 5} height={60} />
                </clipPath>
              ))}
            </defs>

            {/* Nodes */}
            {nodes.map((node) => {
              const method = extractMethod(node.request.endpoint)
              const url = extractUrl(node.request.endpoint)
              const isSelected = selectedNode === node.id
              const isRoot = !node.request.parentRequestId

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer"
                  onClick={() => setSelectedNode(isSelected ? null : node.id)}
                >
                  {/* Node background */}
                  <rect
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx={8}
                    fill={isSelected ? colors.primaryLight : colors.card}
                    stroke={isSelected ? getComputedColor('--primary', 1) : colors.border}
                    strokeWidth={isSelected ? 2 : 1}
                    className="shadow-lg"
                    style={{ transition: 'all 0.2s ease' }}
                  />

                  {/* Method badge */}
                  <rect
                    x={8}
                    y={8}
                    width={50}
                    height={24}
                    rx={4}
                    fill={getMethodBadgeColor(method).bg}
                    stroke={getMethodBadgeColor(method).border}
                    strokeWidth={1}
                  />
                  <text
                    x={33}
                    y={20}
                    textAnchor="middle"
                    fill={getMethodBadgeColor(method).text}
                    fontSize="11"
                    fontWeight="bold"
                    dominantBaseline="middle"
                  >
                    {method}
                  </text>

                  {/* Overlay to hide text overflow - MUST be drawn BEFORE text */}
                  {/* Covers entire right side from where text should end */}
                  {/* Start overlay earlier to ensure no text leaks through */}
                  <rect
                    x={12 + TEXT_MAX_WIDTH - 10}
                    y={0}
                    width={NODE_WIDTH - 12 - TEXT_MAX_WIDTH + 10}
                    height={NODE_HEIGHT}
                    fill={isSelected ? colors.primaryLight : colors.card}
                  />
                  
                  {/* URL - using foreignObject with CSS overflow for proper text clipping */}
                  {/* Width must match clipPath width exactly */}
                  <foreignObject
                    x={12}
                    y={38}
                    width={TEXT_MAX_WIDTH - 10}
                    height={32}
                    clipPath={`url(#textClip-${node.id})`}
                    style={{ overflow: 'hidden' }}
                  >
                    <div
                      style={{
                        color: colors.foreground,
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        lineHeight: '16px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: `${TEXT_MAX_WIDTH - 10}px`,
                        maxWidth: `${TEXT_MAX_WIDTH - 10}px`,
                      }}
                    >
                      {url.length > 16 ? `${url.substring(0, 13)}...` : url}
                    </div>
                  </foreignObject>

                  {/* Filename */}
                  <foreignObject
                    x={12}
                    y={62}
                    width={TEXT_MAX_WIDTH - 10}
                    height={28}
                    clipPath={`url(#textClip-${node.id})`}
                    style={{ overflow: 'hidden' }}
                  >
                    <div
                      style={{
                        color: colors.mutedForeground,
                        fontSize: '9px',
                        fontFamily: 'monospace',
                        lineHeight: '14px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: `${TEXT_MAX_WIDTH - 10}px`,
                        maxWidth: `${TEXT_MAX_WIDTH - 10}px`,
                      }}
                    >
                      {node.request.filename.length > 16 
                        ? `${node.request.filename.substring(0, 13)}...` 
                        : node.request.filename}
                    </div>
                  </foreignObject>

                  {/* Metadata */}
                  <g transform="translate(12, 95)">
                    {node.request.duration && (
                      <text
                        x={0}
                        y={0}
                        fill={colors.mutedForeground}
                        fontSize="10"
                        dominantBaseline="hanging"
                      >
                        ⏱ {node.request.duration}ms
                      </text>
                    )}
                    {isRoot && (
                      <text
                        x={node.request.duration ? 70 : 0}
                        y={0}
                        fill="#22c55e"
                        fontSize="10"
                        dominantBaseline="hanging"
                      >
                        🌱 Root
                      </text>
                    )}
                  </g>

                  {/* Sequence number - drawn AFTER overlay so it appears on top */}
                  <circle
                    cx={NODE_WIDTH - 20}
                    cy={20}
                    r={12}
                    fill={colors.primaryLight}
                    stroke={getComputedColor('--primary', 1)}
                    strokeWidth={1}
                  />
                  <text
                    x={NODE_WIDTH - 20}
                    y={24}
                    textAnchor="middle"
                    fill={getComputedColor('--primary', 1)}
                    fontSize="10"
                    fontWeight="bold"
                    dominantBaseline="middle"
                  >
                    {node.request.sequence || '?'}
                  </text>
                </g>
              )
            })}

            {/* Session labels */}
            {sessions.map(([sessionId], sessionIndex) => {
              const sessionNodes = nodes.filter(n => n.sessionIndex === sessionIndex)
              if (sessionNodes.length === 0) return null
              const sessionMinY = Math.min(...sessionNodes.map(n => n.y))
              return (
                <text
                  key={sessionId}
                  x={20}
                  y={sessionMinY - 5}
                  fill={colors.mutedForeground}
                  fontSize="14"
                  fontWeight="600"
                >
                  Session {sessionIndex + 1}: {sessionId.substring(0, 20)}...
                </text>
              )
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  )
}

