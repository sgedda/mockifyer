import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { getScenarioConfig, setScenario, type ScenarioConfig } from '@/lib/api'
import MockFileBrowser from '@/components/MockFileBrowser'
import RequestTemplates from '@/components/RequestTemplates'
import StatusBanner from '@/components/StatusBanner'
import ClientConfig from '@/components/ClientConfig'
import UnifiedEndpointTester from '@/components/UnifiedEndpointTester'
import { Copy, Download, Clock, CheckCircle2, XCircle, Globe, Zap, FolderOpen } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { prism } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from '@/lib/use-theme'

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
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const syntaxStyle = isDark ? vscDarkPlus : prism
  // Use a nice light blue-grey for light mode instead of plain grey
  const bgColor = isDark ? '#1e1e1e' : '#f0f4f8'
  
  const [response, setResponse] = useState<any>(null)
  const [requestHistory, setRequestHistory] = useState<RequestHistory[]>([])
  const [endpoint, setEndpoint] = useState('')
  const [method, setMethod] = useState<'GET' | 'POST'>('GET')
  const [requestBody, setRequestBody] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [clientType, setClientType] = useState<'axios' | 'fetch'>('axios')
  const [scope, setScope] = useState<'local' | 'global'>('local')
  const [scenarioConfig, setScenarioConfig] = useState<ScenarioConfig | null>(null)
  const [scenarioLoading, setScenarioLoading] = useState(false)
  const [_graphqlQuery, setGraphqlQuery] = useState(`{
  characters {
    results {
      id
      name
      status
      species
    }
  }
}`)
  const [_graphqlVariables, setGraphqlVariables] = useState('{}')
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
    loadScenarioConfig()
  }, [])

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

  const saveToHistory = (req: RequestHistory) => {
    const updated = [req, ...requestHistory].slice(0, 20) // Keep last 20
    setRequestHistory(updated)
    localStorage.setItem('playground-history', JSON.stringify(updated))
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
    if (!response) return 'No request made yet'
    
    // Use URL and method from response, or fallback to state
    let requestUrl = response.url
    const requestMethod = (response.method || method || 'GET').toUpperCase()
    const queryParams = response.queryParams || {}
    
    // Debug: log what we have
    console.log('[Curl Gen]', { 
      hasResponse: !!response, 
      responseUrl: response.url, 
      responseMethod: response.method,
      queryParams,
      endpoint,
      method,
      requestUrl,
      requestMethod
    })
    
    // If no URL in response, try to use endpoint from state
    if (!requestUrl || requestUrl.trim() === '') {
      if (endpoint && endpoint.trim() !== '') {
        // Use endpoint from state and add query params
        let fullUrl = endpoint.startsWith('http') ? endpoint : `${window.location.origin}${endpoint}`
        
        // Add query parameters from state if they exist
        const validParams = queryParams.filter((p: any) => p.key && p.key.trim() !== '')
        if (validParams.length > 0) {
          try {
            const urlObj = new URL(fullUrl)
            validParams.forEach((p: any) => {
              urlObj.searchParams.set(p.key.trim(), p.value.trim())
            })
            fullUrl = urlObj.toString()
          } catch {
            // Fallback: append manually
            const searchParams = new URLSearchParams()
            validParams.forEach((p: any) => {
              searchParams.append(p.key.trim(), p.value.trim())
            })
            const queryString = searchParams.toString()
            if (queryString) {
              fullUrl = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}${queryString}`
            }
          }
        }
        
        let curl = `curl -X ${requestMethod} "${fullUrl}"`
        
        // Add headers for POST
        if (requestMethod === 'POST') {
          curl += ` \\\n  -H "Content-Type: application/json"`
        }
        
        // Add body for POST
        if (requestMethod === 'POST' && requestBody) {
          try {
            const parsed = JSON.parse(requestBody)
            const formatted = JSON.stringify(parsed)
            const escapedBody = formatted.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
            curl += ` \\\n  -d "${escapedBody}"`
          } catch {
            const escapedBody = requestBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
            curl += ` \\\n  -d "${escapedBody}"`
          }
        }
        
        return curl
      }
      return 'No request made yet'
    }
    
    // Build full URL and add query parameters if they exist separately
    let fullUrl = requestUrl.startsWith('http') ? requestUrl : `${window.location.origin}${requestUrl}`
    
    // If queryParams exist as an object, merge them into the URL
    if (queryParams && typeof queryParams === 'object' && !Array.isArray(queryParams)) {
      try {
        const urlObj = new URL(fullUrl)
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            urlObj.searchParams.set(key, String(value))
          }
        })
        fullUrl = urlObj.toString()
      } catch {
        // If URL parsing fails, append query params manually
        const searchParams = new URLSearchParams()
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value))
          }
        })
        const queryString = searchParams.toString()
        if (queryString) {
          fullUrl = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}${queryString}`
        }
      }
    }
    
    // Build curl command
    let curl = `curl -X ${requestMethod} "${fullUrl}"`
    
    // Add headers
    const headers: Record<string, string> = {}
    
    // Add Content-Type for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(requestMethod)) {
      headers['Content-Type'] = 'application/json'
    }
    
    // Add any custom headers from response if available (but these are response headers, not request headers)
    // We should use request headers if available, but for now skip response headers
    
    // Add headers to curl command
    Object.entries(headers).forEach(([key, value]) => {
      const escapedValue = String(value).replace(/"/g, '\\"')
      curl += ` \\\n  -H "${key}: ${escapedValue}"`
    })
    
    // Add body for POST/PUT/PATCH requests
    const body = response.requestBody || requestBody
    if (['POST', 'PUT', 'PATCH'].includes(requestMethod) && body) {
      try {
        // Try to parse if it's a string
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
        const parsed = JSON.parse(bodyStr)
        const formatted = JSON.stringify(parsed)
        const escapedBody = formatted.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
        curl += ` \\\n  -d "${escapedBody}"`
      } catch {
        // If not valid JSON, escape as string
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
        const escapedBody = bodyStr.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
        curl += ` \\\n  -d "${escapedBody}"`
      }
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

  const copyHeaders = () => {
    if (response?.headers) {
      navigator.clipboard.writeText(JSON.stringify(response.headers, null, 2))
      toast({
        title: 'Copied',
        description: 'Headers copied to clipboard',
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
    
    // Always refresh after successful requests to catch new recordings
    // In record mode, new files are saved even if response doesn't have mockFilename header
    if (!response.error) {
      setTimeout(() => {
        console.log('[Playground] Triggering mock file refresh after unified request')
        window.dispatchEvent(new CustomEvent('mock-file-created', { 
          detail: { 
            filename: response.mockFilename || 'new-recording',
            url: response.url 
          } 
        }))
      }, 1500)
    }
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

      {scenarioConfig && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Scenario:</span>
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
            </div>
          </CardContent>
        </Card>
      )}

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
        <Card className={response.error ? 'border-destructive' : response.mocked ? 'border-green-600 dark:border-green-500' : 'border-orange-500'}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="flex flex-wrap items-center gap-2">
                Response
                {response.error ? (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                ) : response.mocked ? (
                  <Badge variant="default" className="bg-green-600 dark:bg-green-500">
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
                  <Badge variant="outline" className="text-xs">
                    Status: {response.status} {response.statusText}
                  </Badge>
                )}
                {response.duration && (
                  <Badge variant="outline" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    {response.duration}ms
                  </Badge>
                )}
              </CardTitle>
              <div className="flex gap-2 shrink-0">
                {!response.error && (
                  <>
                    <Button variant="outline" size="sm" onClick={copyResponse} className="flex-1 sm:flex-initial">
                      <Copy className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Copy</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadResponse} className="flex-1 sm:flex-initial">
                      <Download className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Download</span>
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
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-green-600 dark:text-green-400 font-semibold">
                          This response was served from a mock file
                        </p>
                        {response.mockFilename && (
                          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                            File: {response.mockFilename}
                          </p>
                        )}
                        {response.mockTimestamp && (
                          <p className="text-xs text-green-700 dark:text-green-300">
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
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Response Data</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyResponse}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <div className="border rounded-md max-h-96 p-4 curl-scroll-container overflow-auto" style={{ backgroundColor: bgColor }}>
                        <SyntaxHighlighter
                          language="json"
                          style={syntaxStyle}
                          customStyle={{
                            margin: 0,
                            padding: 0,
                            fontSize: '0.875rem',
                            lineHeight: '1.5',
                            background: bgColor,
                            display: 'block',
                            width: 'max-content',
                          }}
                          codeTagProps={{
                            style: {
                              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                              whiteSpace: 'pre',
                              display: 'block',
                              width: 'max-content',
                              wordBreak: 'keep-all',
                              overflowWrap: 'normal',
                              padding: 0,
                              margin: 0,
                              background: bgColor,
                            }
                          }}
                          PreTag={({ children, ...props }: any) => (
                            <pre {...props} style={{ 
                              margin: 0, 
                              padding: 0, 
                              display: 'block',
                              width: 'max-content',
                              whiteSpace: 'pre',
                              background: bgColor,
                            }}>
                              {children}
                            </pre>
                          )}
                          wrapLines={false}
                          wrapLongLines={false}
                        >
                          {typeof response.data === 'string'
                            ? response.data
                            : JSON.stringify(response.data, null, 2)}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="headers" className="mt-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Headers</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyHeaders}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <div className="border rounded-md max-h-96 p-4 curl-scroll-container overflow-auto" style={{ backgroundColor: bgColor }}>
                        <SyntaxHighlighter
                          language="json"
                          style={syntaxStyle}
                          customStyle={{
                            margin: 0,
                            padding: 0,
                            fontSize: '0.875rem',
                            lineHeight: '1.5',
                            background: bgColor,
                            display: 'block',
                            width: 'max-content',
                          }}
                          codeTagProps={{
                            style: {
                              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                              whiteSpace: 'pre',
                              display: 'block',
                              width: 'max-content',
                              wordBreak: 'keep-all',
                              overflowWrap: 'normal',
                              padding: 0,
                              margin: 0,
                              background: bgColor,
                            }
                          }}
                          PreTag={({ children, ...props }: any) => (
                            <pre {...props} style={{ 
                              margin: 0, 
                              padding: 0, 
                              display: 'block',
                              width: 'max-content',
                              whiteSpace: 'pre',
                              background: bgColor,
                            }}>
                              {children}
                            </pre>
                          )}
                          wrapLines={false}
                          wrapLongLines={false}
                        >
                          {JSON.stringify(response.headers, null, 2)}
                        </SyntaxHighlighter>
                      </div>
                    </div>
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
                      <div className="border rounded-md max-h-96 p-4 curl-scroll-container overflow-auto" style={{ backgroundColor: bgColor }}>
                        <SyntaxHighlighter
                          language="bash"
                          style={syntaxStyle}
                          customStyle={{
                            margin: 0,
                            padding: 0,
                            fontSize: '0.875rem',
                            lineHeight: '1.5',
                            background: bgColor,
                            display: 'block',
                            width: 'max-content',
                          }}
                          codeTagProps={{
                            style: {
                              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                              whiteSpace: 'pre',
                              display: 'block',
                              width: 'max-content',
                              wordBreak: 'keep-all',
                              overflowWrap: 'normal',
                              padding: 0,
                              margin: 0,
                              background: bgColor,
                            }
                          }}
                          PreTag={({ children, ...props }: any) => (
                            <pre {...props} style={{ 
                              margin: 0, 
                              padding: 0, 
                              display: 'block',
                              width: 'max-content',
                              whiteSpace: 'pre',
                              background: bgColor,
                            }}>
                              {children}
                            </pre>
                          )}
                          wrapLines={false}
                          wrapLongLines={false}
                        >
                          {generateCurlCommand()}
                        </SyntaxHighlighter>
                      </div>
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
                      <span className={req.mocked ? 'text-green-600 dark:text-green-500' : 'text-orange-500'}>
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

      <MockFileBrowser key={scenarioConfig?.currentScenario || 'default'} />
    </div>
  )
}
