import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'
import type { FieldOverrideRow } from '@/lib/field-overrides'
import { emptyFieldOverrideRow } from '@/lib/field-overrides'
import type { MockResponseFieldOverrideMode } from '@/types'

const FIELD_OVERRIDE_MODES: Array<{ value: MockResponseFieldOverrideMode; label: string }> = [
  { value: 'replace', label: 'Replace' },
  { value: 'extend', label: 'Extend' },
  { value: 'remove', label: 'Remove' },
]

interface FieldOverridesEditorProps {
  rows: FieldOverrideRow[]
  onChange: (rows: FieldOverrideRow[]) => void
  readOnly?: boolean
}

export default function FieldOverridesEditor({
  rows,
  onChange,
  readOnly = false,
}: FieldOverridesEditorProps) {
  function updateRow(index: number, patch: Partial<FieldOverrideRow>) {
    const next = [...rows]
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
      <div className="space-y-1">
        <div className="text-sm font-medium">Response field overrides</div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Replay-time overlays on the stored JSON body (e.g.{' '}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">bookings.0.status</code>
          ). Applied before date overrides. The recorded response is not rewritten.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No field overrides — stored values are returned as-is (date overrides may still apply).
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="space-y-2 rounded-md border border-border bg-background p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="text-xs text-muted-foreground">Path (from response body root)</span>
                  <Input
                    className="h-9 font-mono text-xs"
                    placeholder="e.g. bookings.0.status"
                    value={row.path}
                    readOnly={readOnly}
                    onChange={(e) => updateRow(i, { path: e.target.value })}
                  />
                </div>
                <div className="space-y-1 sm:w-[8.5rem]">
                  <span className="text-xs text-muted-foreground">Mode</span>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={row.mode}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateRow(i, { mode: e.target.value as MockResponseFieldOverrideMode })
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
                  variant="ghost"
                  size="icon"
                  className="h-9 shrink-0 text-destructive hover:text-destructive sm:mt-5"
                  title="Remove field override"
                  disabled={readOnly}
                  onClick={() => onChange(rows.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {row.mode !== 'remove' && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Value (JSON)</span>
                  <textarea
                    className="flex min-h-[2.5rem] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    rows={2}
                    placeholder='e.g. "CONFIRMED" or {"id":"2"}'
                    value={row.valueText}
                    readOnly={readOnly}
                    onChange={(e) => updateRow(i, { valueText: e.target.value })}
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
