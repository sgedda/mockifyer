import { useState, useEffect, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { vscodeLight, vscodeDark } from '@uiw/codemirror-theme-vscode'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { updateMock, updateMockReplayMode, refreshMockFromLive } from '@/lib/api'
import JsonFieldEditor from './JsonFieldEditor'
import type { MockData, MockFile, MockReplayMode } from '@/types'
import {
  buildMockChainMaps,
  buildMockServiceChainsForDisplay,
  getMockChain,
} from '@/lib/mock-correlation-chains'
import { MockCallChainPanel } from '@/components/MockCallChainPanel'
import { X, Save, Code, Edit, Plus, Copy, Terminal, AlignLeft, RefreshCw } from 'lucide-react'
import { CopyableText } from '@/components/CopyableText'
import MockOverridesLink from '@/components/MockOverridesLink'
import { FavoriteStarButton } from '@/components/FavoriteStarButton'
import { countStoredOverrides } from '@/lib/mock-overrides'
import { formatGraphqlRequestBodyForEditor } from '@/lib/graphql-request-preview'

interface MockEditorProps {
  mock: MockData
  /** Must match the scenario used to list/load this mock (Redis vs filesystem active scenario). */
  scenario?: string
  /** When true, response edits and passthrough toggle cannot be saved (scenario locked). */
  scenarioLocked?: boolean
  /** All mocks in the scenario — used to show multi-service call chain. */
  allMocks?: MockFile[]
  /** Navigate to another hop in the chain from the editor. */
  onSelectRelatedMock?: (file: MockFile) => void
  onClose: () => void
  onSave: () => void
  /** Called after replay mode changes to refresh the list without reloading selectedMock. */
  onListRefresh?: () => Promise<void>
  /** `page`: dedicated editor route. `default` is the inline card layout. */
  variant?: 'default' | 'page'
}

function resolveReplayModeFromMock(mock: MockData): MockReplayMode {
  if (mock.data.alwaysUseRealApi === true || mock.data.responsePending === true) return 'passthrough'
  if (mock.data.alwaysRefreshFromLive === true) return 'always-refresh'
  if (mock.data.refreshOnNextRequest === true) return 'refresh-next'
  return 'stored'
}

const REPLAY_MODE_OPTIONS: Array<{ value: MockReplayMode; label: string; description: string }> = [
  {
    value: 'stored',
    label: 'Use saved mock',
    description: 'Serve the stored response body (field and date overrides still apply).',
  },
  {
    value: 'refresh-next',
    label: 'Refresh on next request',
    description: 'The next app request fetches upstream, updates this file, then returns to saved mock mode.',
  },
  {
    value: 'always-refresh',
    label: 'Always refresh from live',
    description: 'Every request hits the live API, updates the stored snapshot, and returns fresh data (+ overrides).',
  },
  {
    value: 'passthrough',
    label: 'Always use live API',
    description: 'Never serve the mock; traffic always goes upstream (file kept for reference).',
  },
]

/** Above this serialized size, default to JSON tab — form editor is too heavy for huge GraphQL payloads. */
const LARGE_RESPONSE_CHAR_THRESHOLD = 48_000

/**
 * Above this size, initial editor text is minified (single line) to avoid multi‑MB indented strings blocking the tab.
 * Smaller payloads use pretty-printed JSON (`null, 2`). Use "Prettify" for large minified bodies.
 */
const MAX_JSON_PRETTY_INITIAL_CHARS = 2_000_000

const jsonLanguageExtensions: Extension[] = [json(), EditorView.lineWrapping]

function formatMockRequestBody(data: unknown): string {
  const fromObject = formatGraphqlRequestBodyForEditor(data)
  if (fromObject) return fromObject
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data)
      const formatted = formatGraphqlRequestBodyForEditor(parsed)
      if (formatted) return formatted
    } catch {
      // keep the raw string
    }
    return data
  }
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

function useCodeMirrorVscodeTheme(): Extension {
  const [theme, setTheme] = useState<Extension>(() => {
    if (typeof document === 'undefined') return vscodeLight
    const root = document.documentElement
    return root.classList.contains('dark') || root.classList.contains('dim') ? vscodeDark : vscodeLight
  })

  useEffect(() => {
    const update = () => {
      const root = document.documentElement
      const dark = root.classList.contains('dark') || root.classList.contains('dim')
      setTheme(dark ? vscodeDark : vscodeLight)
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  return theme
}

interface JsonResponseCodeMirrorProps {
  value: string
  onChange: (text: string) => void
  isPage: boolean
  readOnly?: boolean
}

function JsonResponseCodeMirror({ value, onChange, isPage, readOnly = false }: JsonResponseCodeMirrorProps) {
  const vscodeTheme = useCodeMirrorVscodeTheme()
  return (
    <div className="w-full overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
      <CodeMirror
        value={value}
        height={isPage ? 'min(32rem, 50vh)' : '24rem'}
        minHeight={isPage ? 'min(280px, 35vh)' : undefined}
        theme={vscodeTheme}
        extensions={jsonLanguageExtensions}
        onChange={onChange}
        readOnly={readOnly}
        className="text-sm font-mono"
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
        }}
      />
    </div>
  )
}

function estimateResponsePayloadSize(data: unknown): number {
  if (data === undefined || data === null) return 0
  if (typeof data === 'string') return data.length
  try {
    return JSON.stringify(data).length
  } catch {
    return 0
  }
}

export default function MockEditor({
  mock,
  scenario,
  onClose,
  onSave,
  onListRefresh,
  variant = 'default',
  scenarioLocked = false,
  allMocks = [],
  onSelectRelatedMock,
}: MockEditorProps) {
  const readOnly = scenarioLocked === true
  const [responseData, setResponseData] = useState('')
  const [responseObject, setResponseObject] = useState<any>(null)
  const [responseCharSize, setResponseCharSize] = useState(0)
  const preferJsonEditor = responseCharSize > LARGE_RESPONSE_CHAR_THRESHOLD
  const [editMode, setEditMode] = useState<'json' | 'form'>(() =>
    estimateResponsePayloadSize(mock.data.response.data) > LARGE_RESPONSE_CHAR_THRESHOLD ? 'json' : 'form'
  )
  const [saving, setSaving] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [replayMode, setReplayMode] = useState<MockReplayMode>('stored')
  const [refreshingLive, setRefreshingLive] = useState(false)
  const { toast } = useToast()
  const overrideCount = countStoredOverrides(mock)

  const serviceChain = useMemo(() => {
    if (!allMocks.length) return []
    const displayChains = buildMockServiceChainsForDisplay(allMocks)
    const containing = displayChains.find((c) => c.hops.some((h) => h.filename === mock.filename))
    if (containing) return containing.hops
    const maps = buildMockChainMaps(allMocks)
    const listFile = allMocks.find((m) => m.filename === mock.filename)
    const hop: MockFile = listFile ?? {
      filename: mock.filename,
      filePath: '',
      size: 0,
      created: mock.metadata.created,
      modified: mock.metadata.modified,
      endpoint: mock.data.request?.url ?? null,
      method: mock.data.request?.method ?? null,
      graphqlInfo: null,
      sessionId: mock.data.sessionId ?? null,
      requestId: mock.data.requestId ?? null,
      parentRequestId: mock.data.parentRequestId ?? null,
    }
    const chain = getMockChain(hop, maps.byRequestId, maps.childrenByParent)
    return chain.length >= 2 ? chain : []
  }, [allMocks, mock])

  useEffect(() => {
    const data = mock.data.response?.data
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
    const size = estimateResponsePayloadSize(parsedData)
    setResponseCharSize(size)
    setEditMode(size > LARGE_RESPONSE_CHAR_THRESHOLD ? 'json' : 'form')
    const usePretty =
      size <= MAX_JSON_PRETTY_INITIAL_CHARS && typeof parsedData !== 'string'
    setResponseData(
      parsedData === undefined
        ? ''
        : usePretty
          ? JSON.stringify(parsedData, null, 2)
          : typeof parsedData === 'string'
            ? parsedData
            : JSON.stringify(parsedData)
    )
    setReplayMode(resolveReplayModeFromMock(mock))
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

  function handlePrettifyJson() {
    try {
      const parsed = JSON.parse(responseData)
      setResponseData(JSON.stringify(parsed, null, 2))
      setJsonError(null)
      toast({
        title: 'JSON formatted',
        description: 'Indented with 2 spaces.',
      })
    } catch (e: any) {
      toast({
        title: 'Cannot format JSON',
        description: e?.message ?? 'Invalid JSON',
        variant: 'destructive',
      })
    }
  }

  async function handleSave() {
    if (readOnly) {
      toast({
        title: 'Scenario locked',
        description: 'Unlock this scenario in Settings to edit mocks.',
        variant: 'destructive',
      })
      return
    }
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
      await updateMock(
        mock.filename,
        dataToSave,
        undefined,
        replayMode,
        scenario
      )
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

  async function handleReplayModeChange(next: MockReplayMode) {
    if (readOnly) {
      toast({
        title: 'Scenario locked',
        description: 'Unlock this scenario in Settings to change replay mode.',
        variant: 'destructive',
      })
      return
    }
    setReplayMode(next)
    try {
      setSaving(true)
      // Intentionally preserve the current on-disk/Redis mock body and overrides.
      // This avoids overwriting unsaved edits (or invalid JSON) when the user just flips passthrough.
      await updateMockReplayMode(mock.filename, next, scenario)
      toast({
        title: 'Saved',
        description:
          next === 'stored'
            ? 'This mock will be served from Mockifyer.'
            : REPLAY_MODE_OPTIONS.find((o) => o.value === next)?.description ?? 'Replay mode updated.',
      })
      if (onListRefresh) {
        await onListRefresh()
      }
    } catch (error: any) {
      setReplayMode(resolveReplayModeFromMock(mock))
      toast({
        title: 'Error',
        description: error.message || 'Failed to update replay mode',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleRefreshFromLiveNow() {
    try {
      setRefreshingLive(true)
      await refreshMockFromLive(mock.filename, scenario)
      toast({
        title: 'Refreshed',
        description: 'Captured the latest live response into this mock file.',
      })
      onSave()
    } catch (error: any) {
      toast({
        title: 'Refresh failed',
        description: error.message || 'Could not fetch from live API',
        variant: 'destructive',
      })
    } finally {
      setRefreshingLive(false)
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

  const isPage = variant === 'page'

  const header = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="text-xl min-w-0">
          Edit Mock:{' '}
          <span className="text-primary font-mono break-all">{mock.filename}</span>
        </CardTitle>
        <div className="flex items-center gap-1 shrink-0">
          <FavoriteStarButton
            filename={mock.filename}
            requestHash={allMocks?.find((file) => file.filename === mock.filename)?.requestHash}
          />
          {!isPage && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-destructive/20 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {serviceChain.length >= 2 && onSelectRelatedMock && (
        <MockCallChainPanel
          chain={serviceChain}
          selectedFilename={mock.filename}
          onSelectHop={onSelectRelatedMock}
        />
      )}
    </div>
  )

  const editorTabs = (
    <Tabs defaultValue="response" className="space-y-4">
          <TabsList>
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          </TabsList>

          <TabsContent value="request" className="space-y-4">
            <div className="rounded-lg border border-border/70 bg-muted/25 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">Replay mode</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={refreshingLive || saving || readOnly}
                  onClick={() => void handleRefreshFromLiveNow()}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshingLive ? 'animate-spin' : ''}`} />
                  Refresh now
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The stored response below is the last captured snapshot. Refresh modes update it from upstream;
                field and date overrides apply on top when serving live or saved responses.
              </p>
              <div className="space-y-2">
                {REPLAY_MODE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                      replayMode === option.value
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border/70 hover:bg-muted/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mockifyer-replay-mode"
                      value={option.value}
                      checked={replayMode === option.value}
                      disabled={saving || readOnly}
                      onChange={() => void handleReplayModeChange(option.value)}
                      className="mt-1 h-4 w-4 shrink-0"
                    />
                    <span className="min-w-0 space-y-1">
                      <span className="text-sm font-medium leading-snug block">{option.label}</span>
                      <span className="text-xs text-muted-foreground leading-relaxed block">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
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
              <div className="font-mono text-sm bg-muted p-2 rounded">
                <CopyableText
                  value={mock.data.request.url}
                  copyLabel="Copy request URL"
                  textClassName="font-mono text-sm"
                />
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
                <pre className="text-xs bg-muted p-3 rounded overflow-auto whitespace-pre-wrap break-all">
                  {formatMockRequestBody(mock.data.request.data)}
                </pre>
              </div>
            )}
          </TabsContent>

          <TabsContent value="response" className="space-y-4">
            <div className="space-y-4">
              {readOnly && (
                <p className="text-sm rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100">
                  This scenario is locked. Mock edits are read-only until you unlock it in Settings.
                </p>
              )}
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Response Data</div>
                <div className="text-xs text-muted-foreground">
                  Status: {mock.data.response.status}
                </div>
              </div>
              
              {preferJsonEditor && (
                <p className="text-xs text-muted-foreground">
                  Large response (~{Math.round(responseCharSize / 1024)} KB) — opened in JSON mode for performance. Form
                  editor will ask for confirmation (it can freeze the tab on huge payloads).
                </p>
              )}
              {responseCharSize > MAX_JSON_PRETTY_INITIAL_CHARS && editMode === 'json' && (
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  Very large body (&gt;{Math.round(MAX_JSON_PRETTY_INITIAL_CHARS / 1_000_000)} MB serialized): loaded
                  minified for speed. Use <strong>Prettify</strong> if you need indented lines (may take a moment).
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 border rounded-md p-1 w-fit">
                <Button
                  variant={editMode === 'form' ? 'default' : 'ghost'}
                  size="sm"
                  disabled={readOnly}
                  onClick={() => {
                    if (
                      preferJsonEditor &&
                      typeof window !== 'undefined' &&
                      !window.confirm(
                        'The form editor loads the full response as editable fields and can freeze the browser on large JSON. Continue?'
                      )
                    ) {
                      return
                    }
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
                  disabled={readOnly}
                  onClick={() => {
                    setEditMode('json')
                    syncObjectFromJson()
                  }}
                  className="h-8 px-4 text-sm"
                >
                  <Code className="h-4 w-4 mr-2" />
                  JSON Editor
                </Button>
                {editMode === 'json' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-sm"
                    disabled={readOnly}
                    onClick={handlePrettifyJson}
                    title="Parse and re-indent with 2 spaces"
                  >
                    <AlignLeft className="h-4 w-4 mr-1.5" />
                    Prettify
                  </Button>
                )}
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
                          disabled={readOnly}
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
                          disabled={readOnly}
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
                        readOnly={readOnly}
                      />
                    )
                  ) : (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  )}
                </div>
              ) : (
                <JsonResponseCodeMirror
                  value={responseData}
                  onChange={(text) => {
                    setResponseData(text)
                    validateJSON(text)
                  }}
                  isPage={isPage}
                  readOnly={readOnly}
                />
              )}
              {jsonError && (
                <div className="text-sm text-destructive">{jsonError}</div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/20 p-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">Overrides</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Field, date, and remove overlays live on the Overrides page. They apply at serve
                  time and do not rewrite this stored JSON.
                </p>
              </div>
              <MockOverridesLink
                filename={mock.filename}
                count={overrideCount}
                scenario={scenario}
                showWhenEmpty
              />
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
              <Button onClick={handleSave} disabled={readOnly || saving || !!jsonError}>
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
  )

  if (isPage) {
    return (
      <Card>
        <CardHeader>{header}</CardHeader>
        <CardContent>{editorTabs}</CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-6">
      <CardHeader>{header}</CardHeader>
      <CardContent>{editorTabs}</CardContent>
    </Card>
  )
}

