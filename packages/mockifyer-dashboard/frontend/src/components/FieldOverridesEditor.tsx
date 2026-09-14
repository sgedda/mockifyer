import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import OverrideRelatedData from '@/components/OverrideRelatedData'
import type { FieldOverrideRow } from '@/lib/field-overrides'
import { emptyFieldOverrideRow } from '@/lib/field-overrides'
import type { MockResponseFieldOverrideMode } from '@/types'

const FIELD_OVERRIDE_MODES: Array<{
  value: MockResponseFieldOverrideMode
  label: string
  hint: string
}> = [
  { value: 'replace', label: 'Replace', hint: 'Set this path to the JSON value' },
  { value: 'extend', label: 'Extend', hint: 'Append to arrays or shallow-merge objects' },
  { value: 'remove', label: 'Remove', hint: 'Delete this path at serve time (body on disk stays)' },
]

interface FieldOverridesEditorProps {
  rows: FieldOverrideRow[]
  onChange: (rows: FieldOverrideRow[]) => void
  responseBody?: unknown
  readOnly?: boolean
}

/**
 * Replay-time field overlays, including `remove` (delete path) and `extend`.
 */
export default function FieldOverridesEditor({
  rows,
  onChange,
  responseBody = null,
  readOnly = false,
}: FieldOverridesEditorProps) {
  function updateRow(index: number, patch: Partial<FieldOverrideRow>) {
    const next = [...rows]
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Field overrides</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Replay-time overlays on the stored JSON. <strong>Replace</strong> sets a value,{' '}
          <strong>Extend</strong> appends/merges, <strong>Remove</strong> deletes the path when the
          mock is served (the recorded body is not rewritten).
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No field overrides.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={`field-${index}`} className="space-y-2 rounded-md border border-border p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="text-xs text-muted-foreground">Path</span>
                  <Input
                    className="h-9 font-mono text-xs"
                    placeholder="e.g. bookings.0.status"
                    value={row.path}
                    readOnly={readOnly}
                    onChange={(event) => updateRow(index, { path: event.target.value })}
                  />
                </div>
                <div className="space-y-1 sm:w-[8.5rem]">
                  <span className="text-xs text-muted-foreground">Mode</span>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={row.mode}
                    disabled={readOnly}
                    title={
                      FIELD_OVERRIDE_MODES.find((mode) => mode.value === row.mode)?.hint ?? ''
                    }
                    onChange={(event) =>
                      updateRow(index, {
                        mode: event.target.value as MockResponseFieldOverrideMode,
                      })
                    }
                  >
                    {FIELD_OVERRIDE_MODES.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 shrink-0 text-destructive hover:text-destructive sm:mt-5"
                  aria-label="Remove field override"
                  disabled={readOnly}
                  onClick={() => onChange(rows.filter((_, other) => other !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <OverrideRelatedData path={row.path} responseBody={responseBody} />
              {row.mode === 'remove' ? (
                <p className="text-[11px] text-muted-foreground">
                  At serve time this path is deleted (array splice or object key). No value needed.
                </p>
              ) : (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    {row.mode === 'extend' ? 'Value to append / merge (JSON)' : 'Value (JSON)'}
                  </span>
                  <textarea
                    className="flex min-h-[2.5rem] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    rows={2}
                    placeholder={
                      row.mode === 'extend'
                        ? 'e.g. {"id":"2"} or ["extra"]'
                        : 'e.g. "CONFIRMED"'
                    }
                    value={row.valueText}
                    readOnly={readOnly}
                    onChange={(event) => updateRow(index, { valueText: event.target.value })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8"
        disabled={readOnly}
        onClick={() => onChange([...rows, emptyFieldOverrideRow()])}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add field override
      </Button>
    </div>
  )
}
