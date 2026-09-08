import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import {
  deleteOverrideGroup,
  getMock,
  getMockFieldOverrides,
  getOverrideGroup,
  listOverrideGroups,
  patchOverrideGroupEntry,
  putOverrideGroup,
  setActiveOverrideGroup,
  setMockFieldOverrides,
  type OverrideGroup,
  type OverrideGroupSummary,
} from '@/lib/api'
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

/** Sentinel edit target: mock-level overlays stored on the mock file. */
const EDIT_MOCK_LEVEL = '__mock_level__'

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

function slugifyGroupId(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || `group-${Date.now()}`
}

/**
 * Dedicated view for mock response field overrides and scenario override groups.
 * Active group overlays apply at serve time on top of mock-level field/date overrides.
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

  const [groups, setGroups] = useState<OverrideGroupSummary[]>([])
  const [currentGroup, setCurrentGroup] = useState<string | null>(null)
  const [defaultGroup, setDefaultGroup] = useState<string | null>(null)
  const [laneGroup, setLaneGroup] = useState<string | null>(null)
  const [selectionSource, setSelectionSource] = useState<string>('none')
  const [laneClientId, setLaneClientId] = useState('')
  const [editTarget, setEditTarget] = useState<string>(EDIT_MOCK_LEVEL)
  const [editGroup, setEditGroup] = useState<OverrideGroup | null>(null)
  const [newGroupLabel, setNewGroupLabel] = useState('')
  const [addMockFilename, setAddMockFilename] = useState('')

  const loadGroups = useCallback(async () => {
    const res = await listOverrideGroups(scenario, laneClientId.trim() || undefined)
    setGroups(res.groups)
    setCurrentGroup(res.currentGroup)
    setDefaultGroup(res.defaultGroup ?? null)
    setLaneGroup(res.laneGroup ?? null)
    setSelectionSource(res.source ?? 'none')
    return res
  }, [scenario, laneClientId])

  useEffect(() => {
    void loadGroups().catch((error) => {
      toast({
        title: 'Failed to load override groups',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    })
  }, [loadGroups, toast])

  useEffect(() => {
    if (editTarget === EDIT_MOCK_LEVEL) {
      setEditGroup(null)
      return
    }
    void getOverrideGroup(editTarget, scenario)
      .then((res) => setEditGroup(res.group))
      .catch((error) => {
        toast({
          title: 'Failed to load group',
          description: error instanceof Error ? error.message : String(error),
          variant: 'destructive',
        })
        setEditTarget(EDIT_MOCK_LEVEL)
      })
  }, [editTarget, scenario, toast])

  const editingGroup = editTarget !== EDIT_MOCK_LEVEL

  const listItems = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (editingGroup && editGroup) {
      const byName = new Map(mocks.map((m) => [m.filename, m]))
      return editGroup.entries
        .map((entry) => {
          const mock = byName.get(entry.filename)
          return {
            filename: entry.filename,
            method: mock?.method,
            endpoint: mock?.endpoint,
            fieldCount: entry.responseFieldOverrides?.length ?? 0,
            hasDates: (entry.responseDateOverrides?.length ?? 0) > 0,
            preview: (entry.responseFieldOverrides ?? []).slice(0, 3).map((p) => p.path),
          }
        })
        .filter((item) => {
          if (!q) return true
          return (
            item.filename.toLowerCase().includes(q) ||
            (item.endpoint ?? '').toLowerCase().includes(q) ||
            (item.method ?? '').toLowerCase().includes(q)
          )
        })
        .sort((a, b) => a.filename.localeCompare(b.filename))
    }

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
      .map((m) => ({
        filename: m.filename,
        method: m.method,
        endpoint: m.endpoint,
        fieldCount: m.responseFieldOverridesCount ?? 0,
        hasDates: m.hasResponseDateOverrides === true,
        preview: (m.responseFieldOverridesPreview ?? []).map((p) => p.path),
      }))
  }, [editingGroup, editGroup, mocks, filter])

  const selectedMeta = useMemo(
    () => listItems.find((m) => m.filename === selectedFilename) ?? null,
    [listItems, selectedFilename]
  )

  const loadSelected = useCallback(
    async (filename: string) => {
      setLoadingDetail(true)
      try {
        if (editingGroup && editGroup) {
          const entry = editGroup.entries.find((e) => e.filename === filename)
          setDrafts(toDraftRows(entry?.responseFieldOverrides ?? []))
          const dates = entry?.responseDateOverrides ?? []
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
        } else {
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
        }
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
    [scenario, toast, editingGroup, editGroup]
  )

  useEffect(() => {
    if (!selectedFilename) return
    if (!listItems.some((m) => m.filename === selectedFilename)) {
      setSelectedFilename(null)
      setDrafts([])
      setDatePreview([])
      return
    }
    void loadSelected(selectedFilename)
  }, [selectedFilename, listItems, loadSelected])

  const handleSave = async () => {
    if (!selectedFilename) return
    setSaving(true)
    try {
      const parsed = parseDraftRows(drafts)
      if (editingGroup && editTarget !== EDIT_MOCK_LEVEL) {
        const res = await patchOverrideGroupEntry(
          editTarget,
          {
            filename: selectedFilename,
            responseFieldOverrides: parsed.length ? parsed : [],
          },
          scenario
        )
        setEditGroup(res.group)
        toast({ title: 'Group field overrides saved' })
      } else {
        await setMockFieldOverrides(selectedFilename, parsed.length ? parsed : null, {
          scenario,
        })
        toast({ title: 'Field overrides saved' })
      }
      await onRefresh?.()
      await loadGroups()
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
      if (editingGroup && editTarget !== EDIT_MOCK_LEVEL) {
        const res = await patchOverrideGroupEntry(
          editTarget,
          { filename: selectedFilename, clear: true },
          scenario
        )
        setEditGroup(res.group)
        setDrafts([])
        toast({ title: 'Group entry cleared' })
      } else {
        await setMockFieldOverrides(selectedFilename, null, { scenario })
        setDrafts([])
        toast({ title: 'Field overrides cleared' })
      }
      await onRefresh?.()
      await loadGroups()
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

  const handleCreateGroup = async () => {
    const label = newGroupLabel.trim()
    if (!label) return
    const id = slugifyGroupId(label)
    setSaving(true)
    try {
      await putOverrideGroup(
        { id, label, updatedAt: new Date().toISOString(), entries: [] },
        scenario
      )
      setNewGroupLabel('')
      await loadGroups()
      setEditTarget(id)
      toast({ title: `Created group "${label}"` })
    } catch (error) {
      toast({
        title: 'Create group failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async (groupId: string | null, scope: 'lane' | 'default') => {
    if (scope === 'lane' && !laneClientId.trim()) {
      toast({
        title: 'Client lane required',
        description: 'Enter a clientId (MOCKIFYER_CLIENT_ID) to set a per-lane group.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const res = await setActiveOverrideGroup(groupId, {
        scenario,
        clientId: scope === 'lane' ? laneClientId.trim() : undefined,
        scope,
      })
      setCurrentGroup(res.currentGroup)
      setDefaultGroup(res.defaultGroup ?? null)
      setLaneGroup(res.laneGroup ?? null)
      setSelectionSource(res.source ?? scope)
      toast({
        title:
          scope === 'lane'
            ? groupId
              ? `Lane ${laneClientId.trim()} → ${groupId}`
              : `Cleared lane group for ${laneClientId.trim()}`
            : groupId
              ? `Scenario default → ${groupId}`
              : 'Cleared scenario default group',
      })
      await loadGroups()
    } catch (error) {
      toast({
        title: 'Activate failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (editTarget === EDIT_MOCK_LEVEL) return
    setSaving(true)
    try {
      await deleteOverrideGroup(editTarget, scenario)
      setEditTarget(EDIT_MOCK_LEVEL)
      setEditGroup(null)
      setSelectedFilename(null)
      await loadGroups()
      toast({ title: 'Override group deleted' })
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAddMockToGroup = async () => {
    const filename = addMockFilename.trim()
    if (!filename || editTarget === EDIT_MOCK_LEVEL) return
    setSaving(true)
    try {
      const res = await patchOverrideGroupEntry(
        editTarget,
        { filename, ensure: true },
        scenario
      )
      setEditGroup(res.group)
      setAddMockFilename('')
      setSelectedFilename(filename)
      await loadGroups()
    } catch (error) {
      toast({
        title: 'Add mock failed',
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
            Field and date overlays for mocks, plus switchable override groups. Use “Set for
            lane” with your <code>clientId</code> so teammates sharing the scenario keep their own
            selection.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={loading}
          onClick={() => {
            void onRefresh?.()
            void loadGroups()
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Override groups</CardTitle>
          <CardDescription>
            Effective:{' '}
            {currentGroup ? (
              <Badge variant="secondary">{currentGroup}</Badge>
            ) : (
              <span className="text-muted-foreground">none</span>
            )}{' '}
            <span className="text-muted-foreground">({selectionSource})</span>
            {' · '}
            default:{' '}
            {defaultGroup ? (
              <code className="text-xs">{defaultGroup}</code>
            ) : (
              <span className="text-muted-foreground">none</span>
            )}
            {' · '}
            lane:{' '}
            {laneGroup ? (
              <code className="text-xs">{laneGroup}</code>
            ) : (
              <span className="text-muted-foreground">none</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <Input
              placeholder="Client lane id (MOCKIFYER_CLIENT_ID)"
              value={laneClientId}
              onChange={(e) => setLaneClientId(e.target.value)}
              className="max-w-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => void loadGroups()}
            >
              Reload for lane
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Edit target</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={editTarget}
                onChange={(e) => {
                  setSelectedFilename(null)
                  setEditTarget(e.target.value)
                }}
              >
                <option value={EDIT_MOCK_LEVEL}>Mock-level (always on)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label} ({g.id}) · {g.entryCount} entries
                    {g.id === currentGroup ? ' · effective' : ''}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={saving || editTarget === EDIT_MOCK_LEVEL || !laneClientId.trim()}
              onClick={() =>
                void handleActivate(
                  editTarget === EDIT_MOCK_LEVEL ? null : editTarget,
                  'lane'
                )
              }
            >
              Set for lane
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving || !laneClientId.trim()}
              onClick={() => void handleActivate(null, 'lane')}
            >
              Clear lane
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving || editTarget === EDIT_MOCK_LEVEL}
              onClick={() =>
                void handleActivate(
                  editTarget === EDIT_MOCK_LEVEL ? null : editTarget,
                  'default'
                )
              }
            >
              Set scenario default
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => void handleActivate(null, 'default')}
            >
              Clear default
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving || editTarget === EDIT_MOCK_LEVEL}
              onClick={() => void handleDeleteGroup()}
            >
              Delete group
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              placeholder="New group label e.g. check-in-open"
              value={newGroupLabel}
              onChange={(e) => setNewGroupLabel(e.target.value)}
              className="max-w-sm"
            />
            <Button
              type="button"
              size="sm"
              disabled={saving || !newGroupLabel.trim()}
              onClick={() => void handleCreateGroup()}
            >
              <Plus className="mr-1 h-4 w-4" />
              Create group
            </Button>
          </div>
        </CardContent>
      </Card>

      <Input
        placeholder="Filter by filename, endpoint, method…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-xl"
      />

      {editingGroup ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Add mock to group</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={addMockFilename}
              onChange={(e) => setAddMockFilename(e.target.value)}
            >
              <option value="">Select mock…</option>
              {mocks.map((m) => (
                <option key={m.filename} value={m.filename}>
                  {m.filename}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            size="sm"
            disabled={saving || !addMockFilename}
            onClick={() => void handleAddMockToGroup()}
          >
            Add to group
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {editingGroup ? 'Group entries' : 'Mocks with overrides'}
            </CardTitle>
            <CardDescription>
              {loading ? 'Loading…' : `${listItems.length} item(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto">
            {listItems.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground">
                {editingGroup
                  ? 'No entries yet. Add a mock above, then edit field overrides.'
                  : 'No mock-level field or date overrides yet. Switch to a group to edit story overlays, or set fields on a mock.'}
              </p>
            ) : null}
            {listItems.map((mock) => {
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
                    {mock.fieldCount > 0 ? (
                      <Badge variant="secondary">fields {mock.fieldCount}</Badge>
                    ) : null}
                    {mock.hasDates ? <Badge variant="outline">dates</Badge> : null}
                  </div>
                  {mock.preview.length ? (
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {mock.preview.join(' · ')}
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
                : editingGroup
                  ? 'Saving writes into the selected override group entry.'
                  : 'Field overrides apply at replay without rewriting stored response.data.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedFilename ? (
              <p className="text-sm text-muted-foreground">
                Pick a mock on the left
                {editingGroup ? ', or add one to this group first' : ''}.
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
                  {onOpenMock && !editingGroup ? (
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
                      {editingGroup
                        ? 'None on this group entry yet (edit via API / future UI).'
                        : 'None on this mock. Use Open mock (dates) to add them.'}
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
