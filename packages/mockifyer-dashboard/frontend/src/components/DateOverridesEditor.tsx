import { CalendarSearch, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import OverrideRelatedData from '@/components/OverrideRelatedData'
import OverrideArrayGroupList from '@/components/OverrideArrayGroupList'
import { OverrideArrayCollapseScope } from '@/components/OverrideArrayCollapseContext'
import type { MockResponseDateOverride } from '@/types'
import {
  detectDateLikeFields,
  getValueAtResponsePath,
  inferFormatForOverrideValue,
} from '@/lib/detect-date-fields'
import { previewServedDateOverride } from '@/lib/date-override-preview'
import { normalizeDateOverrideRow } from '@/lib/mock-overrides'
import { pathRelativeToArrayItem, topLevelArrayItemPath } from '@/lib/override-path-groups'

interface DateOverridesEditorProps {
  dateOverrides: MockResponseDateOverride[]
  onChange: (next: MockResponseDateOverride[]) => void
  responseBody: unknown
  /** Mockifyer's current date (`getCurrentDate`), used for the served-value preview. */
  mockifyerNow: Date
  /** Remount related-data panels when the mock or row index changes. */
  instanceKey?: string
  readOnly?: boolean
}

function DateOverrideServedPreview({
  override,
  original,
  now,
}: {
  override: MockResponseDateOverride
  original: unknown
  now: Date
}) {
  const preview = previewServedDateOverride(override, original, now)
  const showUnixHint =
    !preview.skipped &&
    (preview.resolvedFormat === 'unix-ms' || preview.resolvedFormat === 'unix-s')

  return (
    <div className="rounded-md border border-sky-500/25 bg-sky-500/5 px-2.5 py-2">
      <div className="text-[11px] font-medium text-muted-foreground">
        {preview.skipped ? 'Will not rewrite' : 'Will serve now'}
      </div>
      <div className="break-all font-mono text-sm text-foreground">{preview.servedText}</div>
      {showUnixHint ? (
        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{preview.instantIso}</div>
      ) : null}
      <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
        Mockifyer now {now.toISOString()}
        {preview.offsetLabel === 'no offset' ? ' (no offset)' : ` + ${preview.offsetLabel}`}
        {preview.skipped ? '. Missing or null paths stay as stored (keeps GraphQL __typename).' : ''}
      </div>
    </div>
  )
}

function DateOverrideCard({
  row,
  index,
  grouped,
  dateOverrides,
  onChange,
  updateRow,
  responseBody,
  mockifyerNow,
  instanceKey,
  readOnly,
}: {
  row: MockResponseDateOverride
  index: number
  grouped: boolean
  dateOverrides: MockResponseDateOverride[]
  onChange: (next: MockResponseDateOverride[]) => void
  updateRow: (index: number, patch: Partial<MockResponseDateOverride>) => void
  responseBody: unknown
  mockifyerNow: Date
  instanceKey: string
  readOnly: boolean
}) {
  const arrayItemPath = topLevelArrayItemPath(row.path)
  const relativePath =
    grouped && arrayItemPath ? pathRelativeToArrayItem(row.path, arrayItemPath) : null

  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={(row.base ?? 'now') === 'now'}
            disabled={readOnly}
            onChange={(event) =>
              updateRow(index, { base: event.target.checked ? 'now' : 'response' })
            }
          />
          Offset from now
        </label>
        {(row.base ?? 'now') !== 'now' && (
          <span className="text-[11px] text-muted-foreground">
            Offsetting from existing response value
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">Path (from response body root)</span>
          {relativePath ? (
            <div className="font-mono text-[11px] text-sky-200/90">in item → {relativePath}</div>
          ) : null}
          <Input
            className="h-9 font-mono text-xs"
            placeholder="e.g. expiresAt or bookings.0.startDate"
            value={row.path}
            readOnly={readOnly}
            onChange={(event) => updateRow(index, { path: event.target.value })}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 shrink-0 text-destructive hover:text-destructive sm:mt-5"
          title="Remove override"
          disabled={readOnly}
          onClick={() => onChange(dateOverrides.filter((_, other) => other !== index))}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {!grouped ? (
        <OverrideRelatedData
          key={`${instanceKey}-${index}`}
          path={row.path}
          responseBody={responseBody}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Offset ms</span>
          <Input
            type="number"
            className="h-9 w-[88px] text-xs"
            value={row.offsetMs ?? 0}
            readOnly={readOnly}
            onChange={(event) => {
              const value = event.target.value === '' ? 0 : Number(event.target.value)
              updateRow(index, { offsetMs: Number.isNaN(value) ? 0 : value })
            }}
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Days</span>
          <Input
            type="number"
            className="h-9 w-[72px] text-xs"
            value={row.offsetDays ?? 0}
            readOnly={readOnly}
            onChange={(event) => {
              const value = event.target.value === '' ? 0 : Number(event.target.value)
              updateRow(index, { offsetDays: Number.isNaN(value) ? 0 : value })
            }}
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Hours</span>
          <Input
            type="number"
            className="h-9 w-[72px] text-xs"
            value={row.offsetHours ?? 0}
            readOnly={readOnly}
            onChange={(event) => {
              const value = event.target.value === '' ? 0 : Number(event.target.value)
              updateRow(index, { offsetHours: Number.isNaN(value) ? 0 : value })
            }}
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Minutes</span>
          <Input
            type="number"
            className="h-9 w-[72px] text-xs"
            value={row.offsetMinutes ?? 0}
            readOnly={readOnly}
            onChange={(event) => {
              const value = event.target.value === '' ? 0 : Number(event.target.value)
              updateRow(index, { offsetMinutes: Number.isNaN(value) ? 0 : value })
            }}
          />
        </div>
        <div className="min-w-[140px] space-y-1">
          <span className="text-xs text-muted-foreground">Format</span>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={row.format ?? ''}
            disabled={readOnly}
            onChange={(event) => {
              const value = event.target.value as MockResponseDateOverride['format'] | ''
              updateRow(index, { format: value === '' ? undefined : value })
            }}
          >
            <option value="">Auto</option>
            <option value="iso">ISO string</option>
            <option value="unix-ms">Unix ms</option>
            <option value="unix-s">Unix s</option>
          </select>
        </div>
      </div>
      <DateOverrideServedPreview
        override={row}
        original={getValueAtResponsePath(responseBody, row.path.trim())}
        now={mockifyerNow}
      />
    </div>
  )
}

/**
 * Relative date overlays (offset from Mockifyer's current date). Stored mock JSON is unchanged.
 */
export default function DateOverridesEditor({
  dateOverrides,
  onChange,
  responseBody,
  mockifyerNow,
  instanceKey = 'date',
  readOnly = false,
}: DateOverridesEditorProps) {
  const dateFieldCandidates = detectDateLikeFields(responseBody)

  function updateRow(index: number, patch: Partial<MockResponseDateOverride>) {
    const next = [...dateOverrides]
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Date overrides</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Relative to Mockifyer&apos;s current date plus an offset. Applied when serving the mock — the
          stored response body is not rewritten. Paths are from the JSON root (e.g.{' '}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">bookings.0.startDate</code>
          ). Naive ISO strings stay naive; values with <code className="rounded bg-muted px-1 font-mono text-[11px]">Z</code> keep{' '}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">Z</code>. GraphQL objects keep{' '}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">__typename</code>.
        </p>
      </div>

      {dateFieldCandidates.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CalendarSearch className="h-3.5 w-3.5 shrink-0" />
            Date-like fields detected in response body
          </div>
          <p className="text-[11px] text-muted-foreground">
            ISO strings and Unix timestamps are scanned. Click a row to add an offset override.
          </p>
          <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-border bg-background p-2">
            {dateFieldCandidates.map((candidate) => {
              const already = dateOverrides.some((row) => row.path.trim() === candidate.path)
              const currentVal = getValueAtResponsePath(responseBody, candidate.path)
              return (
                <div
                  key={candidate.path}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-sm px-1 py-1 text-xs hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1 font-mono text-[11px] leading-snug">
                    <span className="text-foreground">{candidate.path}</span>
                    {candidate.preview ? (
                      <span className="ml-2 text-muted-foreground">
                        → {candidate.preview}
                        {candidate.suggestedFormat ? (
                          <span className="ml-1 rounded bg-muted px-1 text-[10px]">
                            {candidate.suggestedFormat}
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
                    disabled={already || readOnly}
                    title={already ? 'Already in overrides below' : 'Add this path as a date override'}
                    onClick={() => {
                      if (already) return
                      const fmt =
                        inferFormatForOverrideValue(currentVal) ?? candidate.suggestedFormat
                      onChange([
                        ...dateOverrides,
                        normalizeDateOverrideRow({
                          path: candidate.path,
                          base: 'now',
                          ...(fmt ? { format: fmt } : {}),
                        }),
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
        responseBody !== null &&
        typeof responseBody === 'object' && (
          <p className="text-[11px] text-muted-foreground">
            No date-like string or timestamp fields detected in the stored body. You can still add
            paths manually.
          </p>
        )}

      {dateOverrides.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No date overrides — stored values are returned as-is unless a field override sets a static
          date.
        </p>
      ) : (
        <OverrideArrayCollapseScope>
          <OverrideArrayGroupList
            rows={dateOverrides}
            responseBody={responseBody}
            instanceKey={instanceKey}
            renderRow={(row, index, grouped) => (
              <DateOverrideCard
                row={row}
                index={index}
                grouped={grouped}
                dateOverrides={dateOverrides}
                onChange={onChange}
                updateRow={updateRow}
                responseBody={responseBody}
                mockifyerNow={mockifyerNow}
                instanceKey={instanceKey}
                readOnly={readOnly}
              />
            )}
          />
        </OverrideArrayCollapseScope>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8"
        disabled={readOnly}
        onClick={() =>
          onChange([...dateOverrides, normalizeDateOverrideRow({ path: '', base: 'now' })])
        }
      >
        <Plus className="h-3 w-3 mr-1" />
        Add date override
      </Button>
    </div>
  )
}
