import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { getMock, getMockFieldOverrides, setMockFieldOverrides } from '@/lib/api'
import type { MockFile, MockResponseFieldOverride } from '@/types'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

interface OverridesViewProps {
  scenario: string
  mocks: MockFile[]
  loading?: boolean
  onRefresh?: () => void | Promise<void>
  /** Open full mock editor (dates live there today). */
  onOpenMock?: (filename: string) => void
}

interface FieldOverrideDraft {
  path: string
  valueText: string
}

function toDraftRows(overrides: MockResponseFieldOverride[]): FieldOverrideDraft[] {
  return overrides.map((row) => ({
    path: row.path,
    valueText: JSON.stringify(row.value, null, 2),
  }))
}

function parseDraftRows(rows: FieldOverrideDraft[]): MockResponseFieldOverride[] {
  return rows.map((row, index) => {
    const path = row.path.trim()
    if (!path) {
      throw new Error(`Row ${index + 1}: path is required`)
    }
    try {
      return { path, value: JSON.parse(row.valueText) as unknown }
    } catch {
      throw new Error(`Row ${index + 1} (${path}): value must be valid JSON`)
    }
  })
}

/**
 * Dedicated view for mock response field overrides (and date-override discovery).
 * Field overrides are edited here via GET/PATCH …/field-overrides; dates still open in Mock editor.
 */
export default function OverridesView({
  scenario,
  mocks,
  loading,
  onRefresh,
  onOpenMock,
}: OverridesViewProps) {
  const { toast } = useToast()
  const [filter, setFilter] = useState('')
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<FieldOverrideDraft[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [datePreview, setDatePreview] = useState<
    Array<{ path: string; summary?: string }>
  >([])

  const overrideMocks = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return mocks
      .filter(
        (m) =>
          m.hasResponseFieldOverrides === true || m.hasResponseDateOverrides === true
      )
      .filter((m) => {
        if (!q) return true
        return (
          m.filename.toLowerCase().includes(q) ||
          (m.endpoint ?? '').toLowerCase().includes(q) ||
          (m.method ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
  }, [mocks, filter])

  const selectedMeta = useMemo(
    () => overrideMocks.find((m) => m.filename === selectedFilename) ?? null,
    [overrideMocks, selectedFilename]
  )

  const loadSelected = useCallback(
    async (filename: string) => {
      setLoadingDetail(true)
      try {
        const [fieldRes, mock] = await Promise.all([
          getMockFieldOverrides(filename, scenario),
          getMock(filename, scenario),
        ])
        setDrafts(toDraftRows(fieldRes.responseFieldOverrides ?? []))
        const dates = mock.data.responseDateOverrides ?? []
        setDatePreview(
          dates.map((d) => ({
            path: d.path,
            summary: [
              d.base && d.base !== 'now' ? `base=${d.base}` : null,
              d.offsetDays != null ? `days=${d.offsetDays}` : null,
              d.offsetHours != null ? `hours=${d.offsetHours}` : null,
              d.offsetMinutes != null ? `min=${d.offsetMinutes}` : null,
              d.offsetMs != null ? `ms=${d.offsetMs}` : null,
              d.format ? `format=${d.format}` : null,
            ]
              .filter(Boolean)
              .join(' ') || 'no offset',
          }))
        )
      } catch (error) {
        toast({
          title: 'Failed to load overrides',
          description: error instanceof Error ? error.message : String(error),
          variant: 'destructive',
        })
      } finally {
        setLoadingDetail(false)
      }
    },
    [scenario, toast]
  )

  useEffect(() => {
    if (!selectedFilename) return
    if (!overrideMocks.some((m) => m.filename === selectedFilename)) {
      setSelectedFilename(null)
      setDrafts([])
      setDatePreview([])
      return
    }
    void loadSelected(selectedFilename)
  }, [selectedFilename, overrideMocks, loadSelected])

  const handleSave = async () => {
    if (!selectedFilename) return
    setSaving(true)
    try {
      const parsed = parseDraftRows(drafts)
      await setMockFieldOverrides(selectedFilename, parsed.length ? parsed : null, {
        scenario,
      })
      toast({ title: 'Field overrides saved' })
      await onRefresh?.()
      await loadSelected(selectedFilename)
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    if (!selectedFilename) return
    setSaving(true)
    try {
      await setMockFieldOverrides(selectedFilename, null, { scenario })
      setDrafts([])
      toast({ title: 'Field overrides cleared' })
      await onRefresh?.()
    } catch (error) {
      toast({
        title: 'Clear failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overrides</h1>
          <p className="text-sm text-muted-foreground">
            Field and date overlays for mocks in scenario <code>{scenario}</code>. Edit field
            path/value here; open the mock editor for date overrides.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={loading}
          onClick={() => void onRefresh?.()}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Input
        placeholder="Filter by filename, endpoint, method…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-xl"
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Mocks with overrides</CardTitle>
            <CardDescription>
              {loading ? 'Loading…' : `${overrideMocks.length} mock(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto">
            {overrideMocks.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground">
                No field or date overrides in this scenario yet. Use MCP{' '}
                <code>mockifyer_set_field_overrides</code> or add rows below after selecting a mock
                from Mocks.
              </p>
            ) : null}
            {overrideMocks.map((mock) => {
              const active = mock.filename === selectedFilename
              return (
                <button
                  key={mock.filename}
                  type="button"
                  onClick={() => setSelectedFilename(mock.filename)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="truncate font-medium">{mock.filename}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {mock.hasResponseFieldOverrides ? (
                      <Badge variant="secondary">
                        fields {mock.responseFieldOverridesCount ?? '…'}
                      </Badge>
                    ) : null}
                    {mock.hasResponseDateOverrides ? (
                      <Badge variant="outline">dates</Badge>
                    ) : null}
                  </div>
                  {mock.responseFieldOverridesPreview?.length ? (
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {mock.responseFieldOverridesPreview
                        .map((p) => `${p.path}=${p.summary}`)
                        .join(' · ')}
                    </div>
                  ) : mock.responseDateOverridesPreview?.length ? (
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {mock.responseDateOverridesPreview.map((p) => p.path).join(' · ')}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {selectedFilename ? selectedFilename : 'Select a mock'}
            </CardTitle>
            <CardDescription>
              {selectedMeta?.endpoint
                ? `${selectedMeta.method ?? ''} ${selectedMeta.endpoint}`.trim()
                : 'Field overrides apply at replay without rewriting stored response.data.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedFilename ? (
              <p className="text-sm text-muted-foreground">
                Pick a mock on the left, or open any mock from Mocks and set field overrides via API /
                MCP — they will appear here once listed.
              </p>
            ) : loadingDetail ? (
              <p className="text-sm text-muted-foreground">Loading overrides…</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1"
                    onClick={() =>
                      setDrafts((rows) => [...rows, { path: '', valueText: '""' }])
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add field
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={saving}
                    onClick={() => void handleSave()}
                  >
                    Save fields
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving || drafts.length === 0}
                    onClick={() => void handleClear()}
                  >
                    Clear fields
                  </Button>
                  {onOpenMock ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      onClick={() => onOpenMock(selectedFilename)}
                    >
                      <Pencil className="h-4 w-4" />
                      Open mock (dates)
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Field overrides</h3>
                  {drafts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No field overrides.</p>
                  ) : (
                    drafts.map((row, index) => (
                      <div
                        key={`field-${index}`}
                        className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_minmax(0,1.2fr)_auto]"
                      >
                        <Input
                          placeholder="path e.g. bookings.0.status"
                          value={row.path}
                          onChange={(e) => {
                            const value = e.target.value
                            setDrafts((rows) =>
                              rows.map((r, i) => (i === index ? { ...r, path: value } : r))
                            )
                          }}
                        />
                        <Textarea
                          placeholder='JSON value e.g. "CONFIRMED"'
                          value={row.valueText}
                          className="min-h-[2.5rem] font-mono text-xs"
                          onChange={(e) => {
                            const value = e.target.value
                            setDrafts((rows) =>
                              rows.map((r, i) =>
                                i === index ? { ...r, valueText: value } : r
                              )
                            )
                          }}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Remove field override"
                          onClick={() =>
                            setDrafts((rows) => rows.filter((_, i) => i !== index))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2 border-t border-border pt-4">
                  <h3 className="text-sm font-medium">Date overrides</h3>
                  {datePreview.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      None on this mock. Use Open mock (dates) to add them.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {datePreview.map((row) => (
                        <li key={row.path} className="flex flex-wrap gap-2">
                          <code className="text-xs">{row.path}</code>
                          <span className="text-muted-foreground">{row.summary}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
