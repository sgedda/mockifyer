import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { getMockFiles, getMockFile, deleteMockFile, updateMockFile, type MockFile } from '@/lib/api'
import { Trash2, Eye, RefreshCw, Edit2, Copy } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import JsonFieldEditor from './JsonFieldEditor'

export default function MockFileBrowser() {
  const [files, setFiles] = useState<MockFile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<any>(null)
  const [editingFile, setEditingFile] = useState<any>(null)
  const [editContent, setEditContent] = useState('')
  const [editData, setEditData] = useState<any>(null)
  const [editError, setEditError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [editMode, setEditMode] = useState<'json' | 'fields' | 'curl' | 'jest'>('fields')
  const [testCode, setTestCode] = useState<string>('// Loading test code...')
  
  // Generate test code when Jest tab is opened
  useEffect(() => {
    if (editMode === 'jest' && editingFile?.data) {
      setTestCode('// Generating test code...')
      fetch('/api/test/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mockData: editingFile.data,
          httpClientType: 'fetch',
        }),
      })
        .then(res => res.json())
        .then(data => {
          setTestCode(data.testCode || '// Error generating test')
        })
        .catch(error => {
          setTestCode(`// Error generating test: ${error.message}`)
        })
    }
  }, [editMode, editingFile?.data])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const loadFiles = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMockFiles()
      setFiles(data.files)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load mock files',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  // Listen for new mock file creation events
  useEffect(() => {
    const handleMockFileCreated = (event: Event) => {
      const customEvent = event as CustomEvent
      console.log('[MockFileBrowser] Received mock-file-created event:', customEvent.detail)
      // Refresh the file list when a new mock file is created
      loadFiles()
    }
    
    window.addEventListener('mock-file-created', handleMockFileCreated)
    return () => {
      window.removeEventListener('mock-file-created', handleMockFileCreated)
    }
  }, [loadFiles])

  async function handleViewFile(filename: string) {
    try {
      const data = await getMockFile(filename)
      setSelectedFile(data)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load mock file',
        variant: 'destructive',
      })
    }
  }

  async function handleDeleteFile(filename: string) {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) {
      return
    }

    try {
      await deleteMockFile(filename)
      toast({
        title: 'Success',
        description: 'Mock file deleted successfully',
      })
      loadFiles()
      if (selectedFile?.filename === filename) {
        setSelectedFile(null)
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete mock file',
        variant: 'destructive',
      })
    }
  }

  async function handleEditFile(filename: string) {
    try {
      const data = await getMockFile(filename)
      // Extract response data for editing
      const responseData = data.data?.response?.data || data.data?.response || {}
      setEditContent(JSON.stringify(responseData, null, 2))
      setEditData(responseData)
      setEditingFile(data)
      setEditError('')
      setEditMode('fields')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load file for editing',
        variant: 'destructive',
      })
    }
  }

  function validateJSON(jsonString: string): boolean {
    if (!jsonString.trim()) {
      setEditError('')
      return true
    }
    try {
      JSON.parse(jsonString)
      setEditError('')
      return true
    } catch (e: any) {
      setEditError(`Invalid JSON: ${e.message}`)
      return false
    }
  }

  async function handleSaveEdit() {
    if (!editingFile) {
      return
    }

    try {
      let parsedData: any
      if (editMode === 'json') {
        if (!validateJSON(editContent)) {
          return
        }
        parsedData = editContent.trim() ? JSON.parse(editContent) : {}
      } else {
        parsedData = editData || {}
      }

      await updateMockFile(editingFile.filename, parsedData)
      toast({
        title: 'Success',
        description: 'Mock file updated successfully',
      })
      setEditingFile(null)
      setEditContent('')
      setEditData(null)
      loadFiles()
      if (selectedFile?.filename === editingFile.filename) {
        handleViewFile(editingFile.filename)
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update mock file',
        variant: 'destructive',
      })
    }
  }

  function generateJestTest() {
    return testCode
  }

  function generateCurlCommand() {
    if (!editingFile?.data?.request) return 'No request data available'
    
    const request = editingFile.data.request
    const method = request.method || 'GET'
    let url = request.url || request.path || ''
    const headers = request.headers || {}
    const body = request.body || request.data
    const queryParams = request.queryParams || {}
    
    // Build URL with query parameters
    if (Object.keys(queryParams).length > 0) {
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `http://example.com${url}`)
        // Add query parameters
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            urlObj.searchParams.set(key, String(value))
          }
        })
        // Reconstruct URL (preserve original protocol/host if it was absolute)
        if (url.startsWith('http')) {
          url = urlObj.toString()
        } else {
          url = urlObj.pathname + urlObj.search
        }
      } catch (e) {
        // If URL parsing fails, append query params manually
        const searchParams = new URLSearchParams()
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value))
          }
        })
        const queryString = searchParams.toString()
        if (queryString) {
          url = `${url}${url.includes('?') ? '&' : '?'}${queryString}`
        }
      }
    }
    
    // Build base curl command
    let curl = `curl -X ${method} "${url}"`
    
    // Add headers
    Object.entries(headers).forEach(([key, value]) => {
      if (key.toLowerCase() !== 'content-length' && value) {
        const headerValue = String(value).replace(/"/g, '\\"')
        curl += ` \\\n  -H "${key}: ${headerValue}"`
      }
    })
    
    // Add body for POST/PUT/PATCH requests
    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      let bodyStr = ''
      if (typeof body === 'string') {
        try {
          // Try to parse and format JSON
          const parsed = JSON.parse(body)
          bodyStr = JSON.stringify(parsed)
        } catch {
          bodyStr = body
        }
      } else {
        bodyStr = JSON.stringify(body)
      }
      const escapedBody = bodyStr.replace(/"/g, '\\"').replace(/\n/g, '\\n')
      curl += ` \\\n  -d "${escapedBody}"`
    }
    
    return curl
  }

  const filteredFiles = files.filter((file) =>
    file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.endpoint?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mock Files Browser</CardTitle>
              <CardDescription>
                View and manage recorded mock files ({files.length} total)
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadFiles}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by filename or endpoint..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchTerm ? 'No files match your search' : 'No mock files found'}
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredFiles.map((file) => (
                <Card key={file.filename}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium truncate">{file.filename}</p>
                          <Badge variant="outline" className="text-xs">
                            {(file.size / 1024).toFixed(1)} KB
                          </Badge>
                        </div>
                        {file.endpoint && (
                          <p className="text-xs text-muted-foreground truncate">
                            {file.endpoint}
                          </p>
                        )}
                        {file.graphqlInfo && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            GraphQL
                          </Badge>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Modified: {new Date(file.modified).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewFile(file.filename)}
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditFile(file.filename)}
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteFile(file.filename)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedFile && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Mock File: {selectedFile.filename}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Request</h4>
                <pre className="bg-muted p-4 rounded-md overflow-auto max-h-64 text-xs">
                  {JSON.stringify(selectedFile.data.request, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Response</h4>
                <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-xs">
                  {JSON.stringify(selectedFile.data.response, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingFile} onOpenChange={(open) => !open && setEditingFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" style={{ width: '90vw', maxWidth: '1200px', overflowX: 'hidden' }}>
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Edit Mock File: {editingFile?.filename}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm leading-tight sm:leading-normal">
              Edit only the response data (request and other fields will be preserved)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4" style={{ width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'hidden', boxSizing: 'border-box' }}>
            <Tabs value={editMode} onValueChange={(value) => {
              setEditMode(value as 'json' | 'fields' | 'curl' | 'jest')
              if (value === 'json' && editData) {
                setEditContent(JSON.stringify(editData, null, 2))
              } else if (value === 'fields' && editContent) {
                try {
                  const parsed = JSON.parse(editContent)
                  setEditData(parsed)
                  setEditError('')
                } catch (e: any) {
                  setEditError(`Invalid JSON: ${e.message}`)
                }
              }
            }}>
              <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 gap-1 h-auto p-1">
                <TabsTrigger value="fields" className="text-xs sm:text-sm px-1.5 sm:px-3 py-2 sm:py-2 min-w-0">
                  <span className="truncate block w-full text-center">Field Editor</span>
                </TabsTrigger>
                <TabsTrigger value="json" className="text-xs sm:text-sm px-1.5 sm:px-3 py-2 sm:py-2 min-w-0">
                  <span className="truncate block w-full text-center">JSON Editor</span>
                </TabsTrigger>
                <TabsTrigger value="curl" className="text-xs sm:text-sm px-1.5 sm:px-3 py-2 sm:py-2 min-w-0">
                  <span className="truncate block w-full text-center">cURL</span>
                </TabsTrigger>
                <TabsTrigger value="jest" className="text-xs sm:text-sm px-1.5 sm:px-3 py-2 sm:py-2 min-w-0">
                  <span className="truncate block w-full text-center">Jest Test</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="fields" className="mt-4">
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground">Editing response.data only</p>
                </div>
                <div className="border rounded-md p-2 sm:p-4 max-h-[60vh] overflow-y-auto bg-muted/30">
                  {editData !== null ? (
                    <JsonFieldEditor
                      value={editData}
                      onChange={(newData) => {
                        setEditData(newData)
                        setEditContent(JSON.stringify(newData, null, 2))
                      }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="json" className="mt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Response Data (JSON) - Only response.data is editable</label>
                  <div className="relative border rounded-md overflow-hidden bg-[#1e1e1e]">
                    <div className="relative h-96 overflow-hidden">
                      <textarea
                        ref={textareaRef}
                        value={editContent}
                        onChange={(e) => {
                          setEditContent(e.target.value)
                          validateJSON(e.target.value)
                          if (!editError) {
                            try {
                              setEditData(JSON.parse(e.target.value))
                            } catch {
                              // Ignore parse errors while typing
                            }
                          }
                        }}
                        onScroll={() => {
                          if (textareaRef.current && highlightRef.current) {
                            highlightRef.current.scrollTop = textareaRef.current.scrollTop
                            highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
                          }
                        }}
                        className="absolute inset-0 w-full h-full p-3 font-mono text-sm resize-none bg-transparent text-transparent caret-white outline-none z-10"
                        placeholder="Enter JSON response data"
                        spellCheck={false}
                        style={{
                          color: 'transparent',
                          caretColor: '#fff',
                          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                          overflow: 'auto',
                        }}
                      />
                      <div 
                        ref={highlightRef}
                        className="absolute inset-0 pointer-events-none z-0 overflow-auto [&::-webkit-scrollbar]:hidden"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                      >
                        <SyntaxHighlighter
                          language="json"
                          style={vscDarkPlus}
                          customStyle={{
                            margin: 0,
                            padding: '12px',
                            background: 'transparent',
                            fontSize: '0.875rem',
                            lineHeight: '1.5',
                            minHeight: '100%',
                          }}
                          codeTagProps={{
                            style: {
                              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                            }
                          }}
                          PreTag="div"
                        >
                          {editContent || '{}'}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  </div>
                  {editError && (
                    <p className="text-sm text-destructive mt-2">{editError}</p>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="curl" className="mt-4" style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
                <div className="space-y-4" style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
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
                  <div 
                    className="border rounded-md bg-[#1e1e1e] max-h-[60vh] p-4 curl-scroll-container"
                    style={{ 
                      width: '100%',
                      maxWidth: '100%',
                      overflowX: 'auto',
                      overflowY: 'auto',
                      position: 'relative',
                      boxSizing: 'border-box',
                      minWidth: 0,
                      flexShrink: 0,
                      margin: '8px 0',
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent',
                    }}
                  >
                    <SyntaxHighlighter
                      language="bash"
                      style={vscDarkPlus}
                      customStyle={{
                        margin: 0,
                        padding: 0,
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                        background: 'transparent',
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
                        }
                      }}
                      PreTag={({ children, ...props }: any) => (
                        <pre {...props} style={{ 
                          margin: 0, 
                          padding: 0, 
                          display: 'block',
                          width: 'max-content',
                          whiteSpace: 'pre',
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
                  {editingFile?.data?.request && (
                    <div className="mt-4 space-y-2">
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Request Details</h4>
                        <div className="bg-muted p-3 rounded-md text-xs space-y-1">
                          <div><strong>Method:</strong> {editingFile.data.request.method || 'GET'}</div>
                          <div><strong>URL:</strong> {editingFile.data.request.url || editingFile.data.request.path || 'N/A'}</div>
                          {editingFile.data.request.headers && Object.keys(editingFile.data.request.headers).length > 0 && (
                            <div>
                              <strong>Headers:</strong>
                              <pre className="mt-1 text-xs bg-background/50 p-2 rounded">
                                {JSON.stringify(editingFile.data.request.headers, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="jest" className="mt-4" style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
                <div className="space-y-4" style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Jest Test Code</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const jestTest = generateJestTest()
                        navigator.clipboard.writeText(jestTest)
                        toast({
                          title: 'Copied',
                          description: 'Jest test code copied to clipboard',
                        })
                      }}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div 
                    className="border rounded-md bg-[#1e1e1e] max-h-[60vh] p-4 curl-scroll-container"
                    style={{ 
                      width: '100%',
                      maxWidth: '100%',
                      overflowX: 'auto',
                      overflowY: 'auto',
                      position: 'relative',
                      boxSizing: 'border-box',
                      minWidth: 0,
                      flexShrink: 0,
                      margin: '8px 0',
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent',
                    }}
                  >
                    <SyntaxHighlighter
                      language="javascript"
                      style={vscDarkPlus}
                      customStyle={{
                        margin: 0,
                        padding: 0,
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                        background: 'transparent',
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
                        }
                      }}
                      PreTag={({ children, ...props }: any) => (
                        <pre {...props} style={{ 
                          margin: 0, 
                          padding: 0, 
                          display: 'block',
                          width: 'max-content',
                          whiteSpace: 'pre',
                        }}>
                          {children}
                        </pre>
                      )}
                      wrapLines={false}
                      wrapLongLines={false}
                    >
                      {generateJestTest()}
                    </SyntaxHighlighter>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFile(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editMode === 'json' && !!editError}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

