import { useState, useEffect, forwardRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { updateMock } from '@/lib/api'
import JsonFieldEditor from './JsonFieldEditor'
import type { MockData } from '@/types'
import { X, Save, Code, Edit, Plus, Copy, Terminal } from 'lucide-react'

interface MockEditorProps {
  mock: MockData
  onClose: () => void
  onSave: () => void
}

const MockEditor = forwardRef<HTMLDivElement, MockEditorProps>(({ mock, onClose, onSave }, ref) => {
  const [responseData, setResponseData] = useState('')
  const [responseObject, setResponseObject] = useState<any>(null)
  const [editMode, setEditMode] = useState<'json' | 'form'>('form')
  const [saving, setSaving] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const data = mock.data.response.data
    // Handle string responses - try to parse as JSON, otherwise keep as string
    let parsedData = data
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data)
      } catch {
        // Keep as string if not valid JSON
        parsedData = data
      }
    }
    setResponseObject(parsedData)
    setResponseData(JSON.stringify(parsedData, null, 2))
  }, [mock])

  function validateJSON(text: string): boolean {
    try {
      JSON.parse(text)
      setJsonError(null)
      return true
    } catch (error: any) {
      setJsonError(error.message)
      return false
    }
  }

  function syncJsonFromObject() {
    try {
      setResponseData(JSON.stringify(responseObject, null, 2))
      setJsonError(null)
    } catch (error: any) {
      setJsonError(error.message)
    }
  }

  function syncObjectFromJson() {
    try {
      const parsed = JSON.parse(responseData)
      setResponseObject(parsed)
      setJsonError(null)
    } catch (error: any) {
      setJsonError(error.message)
    }
  }

  async function handleSave() {
    let dataToSave = responseObject
    
    if (editMode === 'json') {
      if (!validateJSON(responseData)) {
        toast({
          title: 'Invalid JSON',
          description: jsonError || 'Please fix JSON syntax errors',
          variant: 'destructive',
        })
        return
      }
      dataToSave = JSON.parse(responseData)
    }

    try {
      setSaving(true)
      await updateMock(mock.filename, dataToSave)
      toast({
        title: 'Success',
        description: 'Mock updated successfully',
      })
      onSave()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update mock',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  function generateCurlCommand(): string {
    const request = mock.data.request
    const method = request.method.toUpperCase()
    let url = request.url

    // Add query parameters to URL
    if (request.queryParams && Object.keys(request.queryParams).length > 0) {
      try {
        // Try to parse as absolute URL first
        let urlObj: URL
        try {
          urlObj = new URL(url)
        } catch {
          // If relative URL, prepend a base URL for parsing
          urlObj = new URL(url, 'http://localhost')
        }
        
        Object.entries(request.queryParams).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            urlObj.searchParams.append(key, String(value))
          }
        })
        
        // If it was a relative URL, remove the base
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = urlObj.pathname + urlObj.search + (urlObj.hash || '')
        } else {
          url = urlObj.toString()
        }
      } catch (error) {
        // Fallback: manually append query params
        const params = new URLSearchParams()
        Object.entries(request.queryParams).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            params.append(key, String(value))
          }
        })
        const queryString = params.toString()
        url += (url.includes('?') ? '&' : '?') + queryString
      }
    }

    let curlParts = [`curl -X ${method}`]

    // Add headers
    if (request.headers && Object.keys(request.headers).length > 0) {
      Object.entries(request.headers).forEach(([key, value]) => {
        // Escape quotes in header values
        const escapedValue = String(value).replace(/"/g, '\\"')
        curlParts.push(`-H "${key}: ${escapedValue}"`)
      })
    }

    // Add Content-Type header if body exists and no Content-Type header is present
    const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE']
    const hasBody = methodsWithBody.includes(method) && request.data !== undefined && request.data !== null
    const hasContentType = request.headers && Object.keys(request.headers).some(
      key => key.toLowerCase() === 'content-type'
    )
    
    if (hasBody && !hasContentType && typeof request.data === 'object') {
      curlParts.push(`-H "Content-Type: application/json"`)
    }

    // Add body for methods that support it
    if (hasBody) {
      let bodyData = request.data
      
      // Convert to JSON string if it's an object
      if (typeof bodyData === 'object') {
        bodyData = JSON.stringify(bodyData)
      }
      
      // Escape quotes and newlines in body
      const escapedBody = String(bodyData)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
      
      curlParts.push(`-d "${escapedBody}"`)
    }

    // Add URL at the end (escape URL if needed)
    const escapedUrl = url.replace(/"/g, '\\"')
    curlParts.push(`"${escapedUrl}"`)

    return curlParts.join(' \\\n  ')
  }

  async function handleCopyCurl() {
    try {
      const curlCommand = generateCurlCommand()
      await navigator.clipboard.writeText(curlCommand)
      toast({
        title: 'Success',
        description: 'cURL command copied to clipboard',
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to copy cURL command',
        variant: 'destructive',
      })
    }
  }

  return (
    <Card ref={ref} className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Edit Mock: <span className="text-primary font-mono">{mock.filename}</span></CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-destructive/20 hover:text-destructive">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="response" className="space-y-4">
          <TabsList>
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          </TabsList>

          <TabsContent value="request" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Request Details</div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCurl}
                className="h-8"
              >
                <Terminal className="h-4 w-4 mr-2" />
                Copy cURL
              </Button>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Method</div>
              <div className="font-mono text-sm bg-muted p-2 rounded">
                {mock.data.request.method}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">URL</div>
              <div className="font-mono text-sm bg-muted p-2 rounded break-all">
                {mock.data.request.url}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">cURL Command</div>
              <div className="relative">
                <pre className="text-xs bg-muted p-3 rounded overflow-auto font-mono">
                  {generateCurlCommand()}
                </pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={handleCopyCurl}
                  title="Copy cURL command"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {mock.data.request.headers && Object.keys(mock.data.request.headers).length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Headers</div>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                  {JSON.stringify(mock.data.request.headers, null, 2)}
                </pre>
              </div>
            )}
            {mock.data.request.queryParams && Object.keys(mock.data.request.queryParams).length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Query Parameters</div>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                  {JSON.stringify(mock.data.request.queryParams, null, 2)}
                </pre>
              </div>
            )}
            {mock.data.request.data && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Request Body</div>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                  {typeof mock.data.request.data === 'string'
                    ? mock.data.request.data
                    : JSON.stringify(mock.data.request.data, null, 2)}
                </pre>
              </div>
            )}
          </TabsContent>

          <TabsContent value="response" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Response Data</div>
                <div className="text-xs text-muted-foreground">
                  Status: {mock.data.response.status}
                </div>
              </div>
              
              <div className="flex gap-2 border rounded-md p-1 w-fit">
                <Button
                  variant={editMode === 'form' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setEditMode('form')
                    syncJsonFromObject()
                  }}
                  className="h-8 px-4 text-sm"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Form Editor
                </Button>
                <Button
                  variant={editMode === 'json' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setEditMode('json')
                    syncObjectFromJson()
                  }}
                  className="h-8 px-4 text-sm"
                >
                  <Code className="h-4 w-4 mr-2" />
                  JSON Editor
                </Button>
              </div>
              
              {editMode === 'form' ? (
                <div className="border rounded-md p-4 bg-muted/30 max-h-[600px] overflow-auto">
                  {responseObject !== null && responseObject !== undefined ? (
                    (typeof responseObject === 'object' && !Array.isArray(responseObject) && Object.keys(responseObject).length === 0) ? (
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground mb-2">Empty object - add fields to start editing</div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResponseObject({ field1: '' })}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Field
                        </Button>
                      </div>
                    ) : (Array.isArray(responseObject) && responseObject.length === 0) ? (
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground mb-2">Empty array - add items to start editing</div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResponseObject([''])}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Item
                        </Button>
                      </div>
                    ) : (
                      <JsonFieldEditor
                        data={responseObject}
                        onChange={setResponseObject}
                      />
                    )
                  ) : (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  )}
                </div>
              ) : (
                <textarea
                  value={responseData}
                  onChange={(e) => {
                    setResponseData(e.target.value)
                    validateJSON(e.target.value)
                  }}
                  className="w-full h-96 font-mono text-sm bg-muted p-3 rounded-md border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                  spellCheck={false}
                />
              )}
              {jsonError && (
                <div className="text-sm text-destructive">{jsonError}</div>
              )}
            </div>
            {mock.data.response.headers && Object.keys(mock.data.response.headers).length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Response Headers</div>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                  {JSON.stringify(mock.data.response.headers, null, 2)}
                </pre>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !!jsonError}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="metadata" className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">File Size</div>
              <div className="text-sm text-muted-foreground">
                {mock.metadata.size} bytes
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Created</div>
              <div className="text-sm text-muted-foreground">
                {new Date(mock.metadata.created).toLocaleString()}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Modified</div>
              <div className="text-sm text-muted-foreground">
                {new Date(mock.metadata.modified).toLocaleString()}
              </div>
            </div>
            {mock.data.timestamp && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Timestamp</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(mock.data.timestamp).toLocaleString()}
                </div>
              </div>
            )}
            {mock.data.duration !== undefined && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Duration</div>
                <div className="text-sm text-muted-foreground">
                  {mock.data.duration}ms
                </div>
              </div>
            )}
            {mock.data.scenario && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Scenario</div>
                <div className="text-sm text-muted-foreground">
                  {mock.data.scenario}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
})

MockEditor.displayName = 'MockEditor'

export default MockEditor

