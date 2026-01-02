import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { getMockFiles, type MockFile } from '@/lib/api'
import MockFileBrowser from '@/components/MockFileBrowser'
import QueryParamsBuilder from '@/components/QueryParamsBuilder'
import RequestTemplates from '@/components/RequestTemplates'
import StatusBanner from '@/components/StatusBanner'
import ClientConfig from '@/components/ClientConfig'
import UnifiedEndpointTester from '@/components/UnifiedEndpointTester'
import { Copy, Download, Clock, CheckCircle2, XCircle, Globe, Zap, Terminal, Sparkles } from 'lucide-react'

interface RequestHistory {
  id: string
  url: string
  method: string
  timestamp: Date
  status: number
  mocked: boolean
  duration: number
}

export default function Playground() {
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [requestHistory, setRequestHistory] = useState<RequestHistory[]>([])
  const [endpoint, setEndpoint] = useState('')
  const [method, setMethod] = useState<'GET' | 'POST'>('GET')
  const [requestBody, setRequestBody] = useState('')
  const [queryParams, setQueryParams] = useState<Array<{ key: string; value: string }>>([])
  const [city, setCity] = useState('London')
  const [showTemplates, setShowTemplates] = useState(false)
  const [clientType, setClientType] = useState<'axios' | 'fetch'>('axios')
  const [scope, setScope] = useState<'local' | 'global'>('local')
  const [graphqlQuery, setGraphqlQuery] = useState(`{
  characters {
    results {
      id
      name
      status
      species
    }
  }
}`)
  const [graphqlVariables, setGraphqlVariables] = useState('{}')
  const { toast } = useToast()

  useEffect(() => {
    // Load request history from localStorage
    const saved = localStorage.getItem('playground-history')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Convert timestamp strings back to Date objects
        const history = parsed.map((req: any) => ({
          ...req,
          timestamp: new Date(req.timestamp),
        }))
        setRequestHistory(history)
      } catch (e) {
        console.error('Failed to load request history:', e)
      }
    }
  }, [])

  const saveToHistory = (req: RequestHistory) => {
    const updated = [req, ...requestHistory].slice(0, 20) // Keep last 20
    setRequestHistory(updated)
    localStorage.setItem('playground-history', JSON.stringify(updated))
  }

  const handleRequest = async (url: string, options: RequestInit = {}) => {
    const startTime = Date.now()
    setLoading(true)
    setResponse(null)
    
    try {
      // Add clientType and scope query parameters
      // Handle both absolute and relative URLs
      const baseUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`
      const urlObj = new URL(baseUrl)
      urlObj.searchParams.set('clientType', clientType)
      urlObj.searchParams.set('scope', scope)
      const finalUrl = urlObj.pathname + urlObj.search
      
      const res = await fetch(finalUrl, options)
      const duration = Date.now() - startTime
      
      let data
      const contentType = res.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        data = await res.json()
      } else {
        data = await res.text()
      }
      
      // Check if response is an error
      if (!res.ok) {
        const errorMessage = data?.error || data?.message || `HTTP ${res.status}: ${res.statusText}`
        const errorDetails = data?.details || data?.stack
        throw new Error(errorDetails ? `${errorMessage}\n\n${errorDetails}` : errorMessage)
      }
      
      const mocked = res.headers.get('x-mockifyer') === 'true'
      const mockFilename = res.headers.get('x-mockifyer-filename')
      const mockTimestamp = res.headers.get('x-mockifyer-timestamp')
      
      const responseData = {
        data,
        mocked,
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        mockFilename,
        mockTimestamp,
        duration,
      }
      
      setResponse(responseData)
      
      // Save to history
      saveToHistory({
        id: Date.now().toString(),
        url: finalUrl,
        method: options.method || 'GET',
        timestamp: new Date(),
        status: res.status,
        mocked,
        duration,
      })
      
      toast({
        title: mocked ? 'Mocked Response' : 'Real API Response',
        description: `Status: ${res.status} (${duration}ms)`,
      })
    } catch (error: any) {
      const duration = Date.now() - startTime
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
      setResponse({
        error: error.message,
        duration,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleWeatherRequest = (type: 'current' | 'forecast') => {
    if (type === 'current') {
      handleRequest(`/api/weather-unified/current/${encodeURIComponent(city)}`)
    } else {
      handleRequest(`/api/weather-unified/forecast/${encodeURIComponent(city)}?days=3`)
    }
  }

  const handleGraphQLRequest = () => {
    let variables
    try {
      variables = JSON.parse(graphqlVariables || '{}')
    } catch (e) {
      toast({
        title: 'Invalid JSON',
        description: 'GraphQL variables must be valid JSON',
        variant: 'destructive',
      })
      return
    }

    handleRequest('/api/graphql-unified/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables,
      }),
    })
  }

  const handleCustomRequest = () => {
    if (!endpoint) {
      toast({
        title: 'Error',
        description: 'Please enter an endpoint',
        variant: 'destructive',
      })
      return
    }

    // Build URL with query parameters
    let url = endpoint
    const validParams = queryParams.filter((p) => p.key.trim() !== '')
    if (validParams.length > 0 && method === 'GET') {
      const searchParams = new URLSearchParams()
      validParams.forEach((p) => {
        searchParams.append(p.key.trim(), p.value.trim())
      })
      const queryString = searchParams.toString()
      url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}${queryString}`
    }

    const options: RequestInit = {
      method,
    }

    if (method === 'POST' && requestBody) {
      try {
        JSON.parse(requestBody)
        options.headers = {
          'Content-Type': 'application/json',
        }
        options.body = requestBody
      } catch (e) {
        toast({
          title: 'Invalid JSON',
          description: 'Request body must be valid JSON',
          variant: 'destructive',
        })
        return
      }
    }

    handleRequest(url, options)
  }

  const handleTemplateSelect = (template: any) => {
    setEndpoint(template.endpoint)
    setMethod(template.method)
    if (template.body) {
      setRequestBody(template.body)
    }
    setShowTemplates(false)
    
    // If it's a GraphQL template, switch to GraphQL tab
    if (template.category === 'GraphQL') {
      setGraphqlQuery(JSON.parse(template.body).query)
      setGraphqlVariables(JSON.stringify(JSON.parse(template.body).variables || {}, null, 2))
    }
  }

  const generateCurlCommand = () => {
    if (!response || !endpoint) return ''
    
    let curl = `curl -X ${method} "${window.location.origin}${endpoint}"`
    
    if (method === 'POST' && requestBody) {
      const escapedBody = requestBody.replace(/"/g, '\\"')
      curl += ` \\\n  -H "Content-Type: application/json" \\\n  -d "${escapedBody}"`
    }
    
    return curl
  }

  const copyResponse = () => {
    if (response?.data) {
      navigator.clipboard.writeText(JSON.stringify(response.data, null, 2))
      toast({
        title: 'Copied',
        description: 'Response copied to clipboard',
      })
    }
  }

  const downloadResponse = () => {
    if (response?.data) {
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `response-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleUnifiedResponse = (response: any) => {
    setResponse(response)
    if (response.data) {
      saveToHistory({
        id: Date.now().toString(),
        url: response.endpointName || '',
        method: 'GET',
        timestamp: new Date(),
        status: response.status || 200,
        mocked: response.mocked || false,
        duration: response.duration || 0,
      })
    }
  }

  return (
    <div className="space-y-6">
      <StatusBanner />
      
      <ClientConfig
        clientType={clientType}
        scope={scope}
        onClientTypeChange={setClientType}
        onScopeChange={setScope}
      />

      <UnifiedEndpointTester
        clientType={clientType}
        scope={scope}
        onResponse={handleUnifiedResponse}
      />

      {showTemplates && (
        <RequestTemplates onSelect={handleTemplateSelect} />
      )}

      {response && (
        <Card className={response.error ? 'border-destructive' : response.mocked ? 'border-green-500' : 'border-orange-500'}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Response
                {response.error ? (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                ) : response.mocked ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Mocked
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-orange-500 text-orange-500">
                    <Globe className="h-3 w-3 mr-1" />
                    Real API
                  </Badge>
                )}
                {!response.error && (
                  <Badge variant="outline">
                    Status: {response.status} {response.statusText}
                  </Badge>
                )}
                {response.duration && (
                  <Badge variant="outline">
                    <Zap className="h-3 w-3 mr-1" />
                    {response.duration}ms
                  </Badge>
                )}
              </CardTitle>
              <div className="flex gap-2">
                {!response.error && (
                  <>
                    <Button variant="outline" size="sm" onClick={copyResponse}>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadResponse}>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {response.error ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
                <p className="text-sm text-destructive font-semibold">Error</p>
                <p className="text-sm text-destructive mt-1">{response.error}</p>
              </div>
            ) : (
              <>
                {response.mocked && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-md p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-green-400 font-semibold">
                          This response was served from a mock file
                        </p>
                        {response.mockFilename && (
                          <p className="text-xs text-green-300 mt-1">
                            File: {response.mockFilename}
                          </p>
                        )}
                        {response.mockTimestamp && (
                          <p className="text-xs text-green-300">
                            Recorded: {new Date(response.mockTimestamp).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {!response.mocked && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-md p-3">
                    <div className="flex items-start gap-2">
                      <Globe className="h-4 w-4 text-orange-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-orange-400 font-semibold">
                          This response came from a real API call
                        </p>
                        <p className="text-xs text-orange-300 mt-1">
                          Enable recording mode to save it as a mock
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <Tabs defaultValue="data">
                  <TabsList>
                    <TabsTrigger value="data">Response Data</TabsTrigger>
                    <TabsTrigger value="headers">Headers</TabsTrigger>
                    <TabsTrigger value="curl">cURL</TabsTrigger>
                  </TabsList>
                  <TabsContent value="data" className="mt-4">
                    <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-xs">
                      {typeof response.data === 'string'
                        ? response.data
                        : JSON.stringify(response.data, null, 2)}
                    </pre>
                  </TabsContent>
                  <TabsContent value="headers" className="mt-4">
                    <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-xs">
                      {JSON.stringify(response.headers, null, 2)}
                    </pre>
                  </TabsContent>
                  <TabsContent value="curl" className="mt-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">cURL Command</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const curl = generateCurlCommand()
                            navigator.clipboard.writeText(curl)
                            toast({
                              title: 'Copied',
                              description: 'cURL command copied to clipboard',
                            })
                          }}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-xs">
                        {generateCurlCommand() || 'No request made yet'}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {requestHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Request History
            </CardTitle>
            <CardDescription>
              Recent API requests ({requestHistory.length})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {requestHistory.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => {
                    setEndpoint(req.url)
                    setMethod(req.method as 'GET' | 'POST')
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {req.method}
                      </Badge>
                      <span className="text-sm font-medium truncate">{req.url}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{req.timestamp.toLocaleTimeString()}</span>
                      <span className={req.mocked ? 'text-green-500' : 'text-orange-500'}>
                        {req.mocked ? 'Mocked' : 'Real'}
                      </span>
                      <span>Status: {req.status}</span>
                      <span>{req.duration}ms</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <MockFileBrowser />
    </div>
  )
}
