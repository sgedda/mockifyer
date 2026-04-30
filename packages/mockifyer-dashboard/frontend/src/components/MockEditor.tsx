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
import { updateMock } from '@/lib/api'
import JsonFieldEditor from './JsonFieldEditor'
import type { MockData, MockResponseDateOverride } from '@/types'
import { Input } from '@/components/ui/input'
import { X, Save, Code, Edit, Plus, Copy, Terminal, Trash2, CalendarSearch, AlignLeft } from 'lucide-react'
import {
  detectDateLikeFields,
  getValueAtResponsePath,
  inferFormatForOverrideValue,
} from '@/lib/detect-date-fields'

interface MockEditorProps {
  mock: MockData
  onClose: () => void
  onSave: () => void
  /** `modal`: full-height scrollable body for use inside `Dialog` (default list view uses `default`). */
  variant?: 'default' | 'modal'
}

/** Above this serialized size, default to JSON tab — form editor is too heavy for huge GraphQL payloads. */
const LARGE_RESPONSE_CHAR_THRESHOLD = 48_000

/**
 * Above this size, initial editor text is minified (single line) to avoid multi‑MB indented strings blocking the tab.
 * Smaller payloads use pretty-printed JSON (`null, 2`). Use "Prettify" for large minified bodies.
 */
const MAX_JSON_PRETTY_INITIAL_CHARS = 2_000_000

const jsonLanguageExtensions: Extension[] = [json(), EditorView.lineWrapping]

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
  isModal: boolean
}

function JsonResponseCodeMirror({ value, onChange, isModal }: JsonResponseCodeMirrorProps) {
  const vscodeTheme = useCodeMirrorVscodeTheme()
  return (
    <div className="w-full overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
      <CodeMirror
        value={value}
        height={isModal ? 'min(32rem, 50vh)' : '24rem'}
        minHeight={isModal ? 'min(280px, 35vh)' : undefined}
        theme={vscodeTheme}
        extensions={jsonLanguageExtensions}
        onChange={onChange}
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

function normalizeOverrideRow(o: MockResponseDateOverride): MockResponseDateOverride {
  return {
    path: o.path ?? '',
    offsetMs: o.offsetMs ?? 0,
    offsetDays: o.offsetDays ?? 0,
    offsetHours: o.offsetHours ?? 0,
    offsetMinutes: o.offsetMinutes ?? 0,
    format: o.format,
  }
}

/** Persist only non-zero offsets and optional format (matches mockifyer-core). */
function sanitizeOverridesForSave(overrides: MockResponseDateOverride[]): MockResponseDateOverride[] {
  return overrides
    .filter((o) => o.path?.trim())
    .map((o) => {
      const path = o.path.trim()
      const out: MockResponseDateOverride = { path }
      if (o.offsetMs !== undefined && o.offsetMs !== 0) out.offsetMs = o.offsetMs
      if (o.offsetDays !== undefined && o.offsetDays !== 0) out.offsetDays = o.offsetDays
      if (o.offsetHours !== undefined && o.offsetHours !== 0) out.offsetHours = o.offsetHours
      if (o.offsetMinutes !== undefined && o.offsetMinutes !== 0) out.offsetMinutes = o.offsetMinutes
      if (o.format) out.format = o.format
      return out
    })
}

export default function MockEditor({ mock, onClose, onSave, variant = 'default' }: MockEditorProps) {
  const [responseData, setResponseData] = useState('')
  const [responseObject, setResponseObject] = useState<any>(null)
  const [responseCharSize, setResponseCharSize] = useState(0)
  const preferJsonEditor = responseCharSize > LARGE_RESPONSE_CHAR_THRESHOLD
  const [editMode, setEditMode] = useState<'json' | 'form'>(() =>
    estimateResponsePayloadSize(mock.data.response.data) > LARGE_RESPONSE_CHAR_THRESHOLD ? 'json' : 'form'
  )
  const [saving, setSaving] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)
  type MockResponseDateOverrideRow = MockResponseDateOverride & { enabled: boolean }

  function normalizeOverrideRowWithEnabled(
    o: MockResponseDateOverride,
    enabled: boolean = true
  ): MockResponseDateOverrideRow {
    return { ...normalizeOverrideRow(o), enabled }
  }

  /** Persist only enabled overrides. */
  function sanitizeOverridesForSaveFromRows(overrides: MockResponseDateOverrideRow[]): MockResponseDateOverride[] {
    return sanitizeOverridesForSave(overrides.filter((o) => o.enabled))
  }

  const [dateOverrides, setDateOverrides] = useState<MockResponseDateOverrideRow[]>([])
  const { toast } = useToast()

  /** Same JSON the user is editing (form vs raw JSON tab). */
  const responseBodyForDetection = useMemo(() => {
    if (editMode === 'json') {
      try {
        return JSON.parse(responseData) as unknown
      } catch {
        return null
      }
    }
    return responseObject
  }, [editMode, responseData, responseObject])

  const dateFieldCandidates = useMemo(
    () => detectDateLikeFields(responseBodyForDetection),
    [responseBodyForDetection]
  )

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
    const size = estimateResponsePayloadSize(parsedData)
    setResponseCharSize(size)
    setEditMode(size > LARGE_RESPONSE_CHAR_THRESHOLD ? 'json' : 'form')
    const usePretty =
      size <= MAX_JSON_PRETTY_INITIAL_CHARS && typeof parsedData !== 'string'
    setResponseData(
      usePretty
        ? JSON.stringify(parsedData, null, 2)
        : typeof parsedData === 'string'
          ? parsedData
          : JSON.stringify(parsedData)
    )
    setDateOverrides((mock.data.responseDateOverrides ?? []).map((o) => normalizeOverrideRowWithEnabled(o, true)))
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
      await updateMock(mock.filename, dataToSave, sanitizeOverridesForSaveFromRows(dateOverrides))
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

  const isModal = variant === 'modal'

  const header = (
    <div className="flex items-center justify-between gap-2 pr-8 sm:pr-10">
      <CardTitle className="text-xl">Edit Mock: <span className="text-primary font-mono">{mock.filename}</span></CardTitle>
      {!isModal && (
        <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-destructive/20 hover:text-destructive shrink-0">
          <X className="h-4 w-4" />
        </Button>
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
                <JsonResponseCodeMirror
                  value={responseData}
                  onChange={(text) => {
                    setResponseData(text)
                    validateJSON(text)
                  }}
                  isModal={isModal}
                />
              )}
              {jsonError && (
                <div className="text-sm text-destructive">{jsonError}</div>
              )}
            </div>

            <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">Response date overrides</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Paths are relative to the response JSON body (e.g.{' '}
                  <code className="rounded bg-muted px-1 font-mono text-[11px]">expiresAt</code> or{' '}
                  <code className="rounded bg-muted px-1 font-mono text-[11px]">items.0.createdAt</code>
                  ). When this mock is served, each field is set to the dashboard &quot;current&quot; date (Date
                  settings) plus the offsets below.
                </p>
              </div>

              {dateFieldCandidates.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <CalendarSearch className="h-3.5 w-3.5 shrink-0" />
                    Date-like fields detected in response body
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    ISO strings and Unix timestamps are scanned. Click a row to add an override (or use
                    &quot;Add date override&quot;).
                  </p>
                  <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-border bg-background p-2">
                    {dateFieldCandidates.map((c) => {
                      const already = dateOverrides.some(
                        (o) => o.path.trim() === c.path
                      )
                      const currentVal = getValueAtResponsePath(
                        responseBodyForDetection,
                        c.path
                      )
                      return (
                        <div
                          key={c.path}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-sm px-1 py-1 text-xs hover:bg-muted/60"
                        >
                          <div className="min-w-0 flex-1 font-mono text-[11px] leading-snug">
                            <span className="text-foreground">{c.path}</span>
                            {c.preview ? (
                              <span className="ml-2 text-muted-foreground">
                                → {c.preview}
                                {c.suggestedFormat ? (
                                  <span className="ml-1 rounded bg-muted px-1 text-[10px]">
                                    {c.suggestedFormat}
                                  </span>
                                ) : null}
                              </span>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 shrink-0 text-[11px]"
                            disabled={already}
                            title={
                              already
                                ? 'Already in overrides below'
                                : 'Add this path as a date override'
                            }
                            onClick={() => {
                              if (already) return
                              const fmt =
                                inferFormatForOverrideValue(currentVal) ?? c.suggestedFormat
                              setDateOverrides([
                                ...dateOverrides,
                                normalizeOverrideRowWithEnabled(
                                  {
                                  path: c.path,
                                  ...(fmt ? { format: fmt } : {}),
                                  },
                                  true
                                ),
                              ])
                            }}
                          >
                            {already ? 'Added' : 'Add'}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {dateFieldCandidates.length === 0 &&
                responseBodyForDetection !== null &&
                typeof responseBodyForDetection === 'object' && (
                  <p className="text-[11px] text-muted-foreground">
                    No date-like string or timestamp fields detected in the current response body. You can
                    still add paths manually.
                  </p>
                )}

              {dateOverrides.length === 0 ? (
                <p className="text-xs text-muted-foreground">No overrides — stored values are returned as-is.</p>
              ) : (
                <div className="space-y-3">
                  {dateOverrides.map((row, i) => (
                    <div key={i} className="space-y-2 rounded-md border border-border bg-background p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={(e) => {
                              const next = [...dateOverrides]
                              next[i] = { ...next[i], enabled: e.target.checked }
                              setDateOverrides(next)
                            }}
                          />
                          Offset from now
                        </label>
                        {!row.enabled && (
                          <span className="text-[11px] text-muted-foreground">
                            Disabled — original stored value will be returned
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1 space-y-1">
                          <span className="text-xs text-muted-foreground">Path (from response body root)</span>
                          <Input
                            className="font-mono text-xs h-9"
                            placeholder="e.g. expiresAt or data.items.0.createdAt"
                            value={row.path}
                            disabled={!row.enabled}
                            onChange={(e) => {
                              const next = [...dateOverrides]
                              next[i] = { ...next[i], path: e.target.value }
                              setDateOverrides(next)
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 shrink-0 text-destructive hover:text-destructive sm:mt-5"
                          title="Remove override"
                          onClick={() => setDateOverrides(dateOverrides.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Offset ms</span>
                          <Input
                            type="number"
                            className="h-9 w-[88px] text-xs"
                            value={row.offsetMs ?? 0}
                            disabled={!row.enabled}
                            onChange={(e) => {
                              const v = e.target.value === '' ? 0 : Number(e.target.value)
                              const next = [...dateOverrides]
                              next[i] = { ...next[i], offsetMs: Number.isNaN(v) ? 0 : v }
                              setDateOverrides(next)
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Days</span>
                          <Input
                            type="number"
                            className="h-9 w-[72px] text-xs"
                            value={row.offsetDays ?? 0}
                            disabled={!row.enabled}
                            onChange={(e) => {
                              const v = e.target.value === '' ? 0 : Number(e.target.value)
                              const next = [...dateOverrides]
                              next[i] = { ...next[i], offsetDays: Number.isNaN(v) ? 0 : v }
                              setDateOverrides(next)
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Hours</span>
                          <Input
                            type="number"
                            className="h-9 w-[72px] text-xs"
                            value={row.offsetHours ?? 0}
                            disabled={!row.enabled}
                            onChange={(e) => {
                              const v = e.target.value === '' ? 0 : Number(e.target.value)
                              const next = [...dateOverrides]
                              next[i] = { ...next[i], offsetHours: Number.isNaN(v) ? 0 : v }
                              setDateOverrides(next)
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Minutes</span>
                          <Input
                            type="number"
                            className="h-9 w-[72px] text-xs"
                            value={row.offsetMinutes ?? 0}
                            disabled={!row.enabled}
                            onChange={(e) => {
                              const v = e.target.value === '' ? 0 : Number(e.target.value)
                              const next = [...dateOverrides]
                              next[i] = { ...next[i], offsetMinutes: Number.isNaN(v) ? 0 : v }
                              setDateOverrides(next)
                            }}
                          />
                        </div>
                        <div className="space-y-1 min-w-[140px]">
                          <span className="text-xs text-muted-foreground">Format</span>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={row.format ?? ''}
                            disabled={!row.enabled}
                            onChange={(e) => {
                              const v = e.target.value as MockResponseDateOverride['format'] | ''
                              const next = [...dateOverrides]
                              next[i] = {
                                ...next[i],
                                format: v === '' ? undefined : v,
                              }
                              setDateOverrides(next)
                            }}
                          >
                            <option value="">Auto</option>
                            <option value="iso">ISO string</option>
                            <option value="unix-ms">Unix ms</option>
                            <option value="unix-s">Unix s</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() =>
                  setDateOverrides([
                    ...dateOverrides,
                    normalizeOverrideRowWithEnabled({ path: '' }, true),
                  ])
                }
              >
                <Plus className="h-3 w-3 mr-1" />
                Add date override
              </Button>
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
  )

  if (isModal) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border px-6 pb-4 pt-1">{header}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{editorTabs}</div>
      </div>
    )
  }

  return (
    <Card className="mt-6">
      <CardHeader>{header}</CardHeader>
      <CardContent>{editorTabs}</CardContent>
    </Card>
  )
}

