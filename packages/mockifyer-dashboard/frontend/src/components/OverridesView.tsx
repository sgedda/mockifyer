import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ExternalLink, Plus, RefreshCw } from 'lucide-react'
import {
  deleteOverrideGroup,
  getDateConfig,
  getMock,
  getMockFieldOverrides,
  getOverrideGroup,
  listOverrideGroups,
  patchOverrideGroupEntry,
  putOverrideGroup,
  setActiveOverrideGroup,
  setMockDateOverrides,
  setMockFieldOverrides,
  type OverrideGroup,
  type OverrideGroupSummary,
} from '@/lib/api'
import type { MockFile, MockResponseDateOverride } from '@/types'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import DateOverridesEditor from '@/components/DateOverridesEditor'
import FieldOverridesEditor from '@/components/FieldOverridesEditor'
import { DASHBOARD_Q, mockEditorPath } from '@/lib/dashboard-urls'
import {
  fieldOverridesToRows,
  rowsToFieldOverrides,
  type FieldOverrideRow,
} from '@/lib/field-overrides'
import {
  countListOverrides,
  normalizeDateOverrideRow,
  sanitizeDateOverridesForSave,
} from '@/lib/mock-overrides'

interface OverridesViewProps {
  scenario: string
  mocks: MockFile[]
  loading?: boolean
  onRefresh?: () => void | Promise<void>
}

/** Sentinel edit target: mock-level overlays stored on the mock file. */
const EDIT_MOCK_LEVEL = '__mock_level__'

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
}: OverridesViewProps) {
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filter, setFilter] = useState('')
  const [selectedFilename, setSelectedFilename] = useState<string | null>(
    () => searchParams.get(DASHBOARD_Q.file)
  )
  const [drafts, setDrafts] = useState<FieldOverrideRow[]>([])
  const [dateOverrides, setDateOverrides] = useState<MockResponseDateOverride[]>([])
  const [responseBody, setResponseBody] = useState<unknown>(null)
  const [mockifyerNow, setMockifyerNow] = useState(() => new Date())
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)

  const [groups, setGroups] = useState<OverrideGroupSummary[]>([])
  const [currentGroup, setCurrentGroup] = useState<string | null>(null)
  const [defaultGroup, setDefaultGroup] = useState<string | null>(null)
  const [laneGroup, setLaneGroup] = useState<string | null>(null)
  const [selectionSource, setSelectionSource] = useState<string>('none')
  const [laneClientId, setLaneClientId] = useState('')
  const laneClientIdRef = useRef(laneClientId)
  laneClientIdRef.current = laneClientId
  const [editTarget, setEditTarget] = useState<string>(EDIT_MOCK_LEVEL)
  const [editGroup, setEditGroup] = useState<OverrideGroup | null>(null)
  const [newGroupLabel, setNewGroupLabel] = useState('')
  const [addMockFilename, setAddMockFilename] = useState('')

  /**
   * Reads `laneClientId` via ref so Reload/Refresh/post-activate always send the typed
   * client without putting it in the callback deps (which would refetch on every keystroke).
   */
  const loadGroups = useCallback(async () => {
    const res = await listOverrideGroups(scenario, laneClientIdRef.current.trim() || undefined)
    setGroups(res.groups)
    setCurrentGroup(res.currentGroup)
    setDefaultGroup(res.defaultGroup ?? null)
    setLaneGroup(res.laneGroup ?? null)
    setSelectionSource(res.source ?? 'none')
    return res
  }, [scenario])

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
    let cancelled = false
    void getDateConfig(scenario)
      .then((config) => {
        if (cancelled) return
        const parsed = new Date(config.currentDate)
        setMockifyerNow(Number.isNaN(parsed.getTime()) ? new Date() : parsed)
      })
      .catch(() => {
        if (!cancelled) setMockifyerNow(new Date())
      })
    return () => {
      cancelled = true
    }
  }, [scenario])

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
  const urlFilename = searchParams.get(DASHBOARD_Q.file)

  const selectFilename = useCallback(
    (filename: string | null) => {
      setSelectedFilename(filename)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (filename) next.set(DASHBOARD_Q.file, filename)
          else next.delete(DASHBOARD_Q.file)
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  useEffect(() => {
    if (urlFilename && urlFilename !== selectedFilename) {
      setSelectedFilename(urlFilename)
    }
  }, [urlFilename, selectedFilename])

  const listItems = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const focused = urlFilename

    function toItem(mock: MockFile) {
      return {
        filename: mock.filename,
        method: mock.method,
        endpoint: mock.endpoint,
        fieldCount: mock.responseFieldOverridesCount ?? 0,
        dateCount: mock.responseDateOverridesCount ?? 0,
        hasDates: mock.hasResponseDateOverrides === true,
        preview: (mock.responseFieldOverridesPreview ?? []).map((p) => p.path),
        overrideCount: countListOverrides(mock),
      }
    }

    if (editingGroup && editGroup) {
      const byName = new Map(mocks.map((m) => [m.filename, m]))
      return editGroup.entries
        .map((entry) => {
          const mock = byName.get(entry.filename)
          const fieldCount = entry.responseFieldOverrides?.length ?? 0
          const dateCount = entry.responseDateOverrides?.length ?? 0
          return {
            filename: entry.filename,
            method: mock?.method,
            endpoint: mock?.endpoint,
            fieldCount,
            dateCount,
            hasDates: dateCount > 0,
            preview: (entry.responseFieldOverrides ?? []).slice(0, 3).map((p) => p.path),
            overrideCount: fieldCount + dateCount,
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

    const withOverrides = mocks.filter(
      (m) => m.hasResponseFieldOverrides === true || m.hasResponseDateOverrides === true
    )
    const focusedMock = focused ? mocks.find((m) => m.filename === focused) : undefined
    const source =
      focusedMock && !withOverrides.some((m) => m.filename === focused)
        ? [focusedMock, ...withOverrides]
        : withOverrides

    return source
      .filter((m) => {
        if (!q) return true
        return (
          m.filename.toLowerCase().includes(q) ||
          (m.endpoint ?? '').toLowerCase().includes(q) ||
          (m.method ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
      .map((m) => toItem(m))
  }, [editingGroup, editGroup, mocks, filter, urlFilename])

  const selectedMeta = useMemo(
    () => listItems.find((m) => m.filename === selectedFilename) ?? null,
    [listItems, selectedFilename]
  )

  const loadSelected = useCallback(
    async (filename: string) => {
      setLoadingDetail(true)
      try {
        const mock = await getMock(filename, scenario).catch(() => null)
        setResponseBody(mock?.data.response?.data ?? null)

        if (editingGroup && editGroup) {
          const entry = editGroup.entries.find((e) => e.filename === filename)
          setDrafts(fieldOverridesToRows(entry?.responseFieldOverrides ?? []))
          setDateOverrides(
            (entry?.responseDateOverrides ?? []).map(normalizeDateOverrideRow)
          )
        } else {
          const fieldRes = await getMockFieldOverrides(filename, scenario)
          setDrafts(fieldOverridesToRows(fieldRes.responseFieldOverrides ?? []))
          if (mock) {
            setDateOverrides(
              (mock.data.responseDateOverrides ?? []).map(normalizeDateOverrideRow)
            )
          } else {
            setDateOverrides([])
          }
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
    const listed = listItems.some((m) => m.filename === selectedFilename)
    const knownMock = mocks.some((m) => m.filename === selectedFilename)
    if (!listed && !knownMock) {
      setSelectedFilename(null)
      setDrafts([])
      setDateOverrides([])
      setResponseBody(null)
      return
    }
    void loadSelected(selectedFilename)
  }, [selectedFilename, listItems, loadSelected, mocks, selectFilename])

  const handleSave = async () => {
    if (!selectedFilename) return
    const parsed = rowsToFieldOverrides(drafts)
    if (parsed.error) {
      toast({ title: 'Save failed', description: parsed.error, variant: 'destructive' })
      return
    }
    const dates = sanitizeDateOverridesForSave(dateOverrides)
    setSaving(true)
    try {
      if (editingGroup && editTarget !== EDIT_MOCK_LEVEL) {
        const res = await patchOverrideGroupEntry(
          editTarget,
          {
            filename: selectedFilename,
            responseFieldOverrides: parsed.overrides,
            responseDateOverrides: dates,
          },
          scenario
        )
        setEditGroup(res.group)
        toast({ title: 'Group overrides saved' })
      } else {
        await setMockFieldOverrides(
          selectedFilename,
          parsed.overrides.length ? parsed.overrides : null,
          { scenario }
        )
        await setMockDateOverrides(selectedFilename, dates.length ? dates : null, scenario)
        toast({ title: 'Overrides saved' })
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
          {
            filename: selectedFilename,
            responseFieldOverrides: [],
            responseDateOverrides: [],
          },
          scenario
        )
        setEditGroup(res.group)
        setDrafts([])
        setDateOverrides([])
        toast({ title: 'Group entry cleared' })
      } else {
        await setMockFieldOverrides(selectedFilename, null, { scenario })
        await setMockDateOverrides(selectedFilename, null, scenario)
        setDrafts([])
        setDateOverrides([])
        toast({ title: 'Overrides cleared' })
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
      selectFilename(null)
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
      selectFilename(filename)
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
            Field, date, and remove overlays for mocks, plus switchable override groups. Use “Set for
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
                  selectFilename(null)
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

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-muted-foreground">
            {editingGroup ? 'Add mock to group' : 'Open mock for overlays'}
          </span>
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
          onClick={() => {
            if (editingGroup) {
              void handleAddMockToGroup()
              return
            }
            selectFilename(addMockFilename.trim())
            setAddMockFilename('')
          }}
        >
          {editingGroup ? 'Add to group' : 'Edit overlays'}
        </Button>
      </div>

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
                  : 'No mock-level overlays yet. Pick a mock above to add field, date, or remove overlays.'}
              </p>
            ) : null}
            {listItems.map((mock) => {
              const active = mock.filename === selectedFilename
              return (
                <button
                  key={mock.filename}
                  type="button"
                  onClick={() => selectFilename(mock.filename)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="truncate font-medium">{mock.filename}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {mock.overrideCount > 0 ? (
                      <Badge variant="secondary">{mock.overrideCount} overlay{mock.overrideCount === 1 ? '' : 's'}</Badge>
                    ) : (
                      <Badge variant="outline">none yet</Badge>
                    )}
                    {mock.fieldCount > 0 ? (
                      <Badge variant="secondary">fields {mock.fieldCount}</Badge>
                    ) : null}
                    {mock.hasDates ? (
                      <Badge variant="outline">dates {mock.dateCount || ''}</Badge>
                    ) : null}
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
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <span className="min-w-0 break-all">
                {selectedFilename ? selectedFilename : 'Select a mock'}
              </span>
              {selectedFilename ? (
                <Link
                  to={mockEditorPath(selectedFilename, { scenario })}
                  className="inline-flex items-center gap-1 text-xs font-medium text-sky-300 hover:underline"
                  title="Open this mock in the editor"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                  Open mock
                </Link>
              ) : null}
            </CardTitle>
            <CardDescription>
              {selectedMeta?.endpoint
                ? `${selectedMeta.method ?? ''} ${selectedMeta.endpoint}`.trim()
                : editingGroup
                  ? 'Saving writes into the selected override group entry.'
                  : 'Field, date, and remove overlays apply at replay without rewriting stored response.data.'}
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
                    disabled={saving}
                    onClick={() => void handleSave()}
                  >
                    Save overlays
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving || (drafts.length === 0 && dateOverrides.length === 0)}
                    onClick={() => void handleClear()}
                  >
                    Clear overlays
                  </Button>
                </div>

                <FieldOverridesEditor
                  rows={drafts}
                  onChange={setDrafts}
                  responseBody={responseBody}
                />

                <div className="border-t border-border pt-4">
                  <DateOverridesEditor
                    dateOverrides={dateOverrides}
                    onChange={setDateOverrides}
                    responseBody={responseBody}
                    mockifyerNow={mockifyerNow}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
