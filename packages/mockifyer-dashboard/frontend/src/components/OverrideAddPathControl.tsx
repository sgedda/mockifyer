import type { MouseEvent, PointerEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { MockResponseFieldOverrideMode } from '@/types'

const FIELD_ADD_MODES: Array<{
  value: MockResponseFieldOverrideMode
  label: string
  hint: string
}> = [
  { value: 'replace', label: 'Replace value', hint: 'Set this path to the stored JSON (then edit)' },
  { value: 'remove', label: 'Remove path', hint: 'Delete this path when the mock is served' },
  { value: 'extend', label: 'Extend', hint: 'Append to an array or shallow-merge an object' },
]

export interface OverrideAddPathControlProps {
  path: string
  storedValue: unknown
  existingPaths?: Set<string>
  readOnly?: boolean
  onAddFieldOverride?: (
    path: string,
    storedValue: unknown,
    mode: MockResponseFieldOverrideMode
  ) => void
  onAddDateOverride?: (path: string, storedValue: unknown) => void
}

function stopRowClick(event: MouseEvent | PointerEvent) {
  event.stopPropagation()
}

/**
 * Add-override actions for the JSON click-through inspector.
 * Field overlays offer replace / remove / extend; date overlays add a single offset row.
 */
export default function OverrideAddPathControl({
  path,
  storedValue,
  existingPaths,
  readOnly = false,
  onAddFieldOverride,
  onAddDateOverride,
}: OverrideAddPathControlProps) {
  const trimmed = path.trim()
  const already = Boolean(trimmed && existingPaths?.has(trimmed))
  const canAddField = onAddFieldOverride != null && !readOnly
  const canAddDate = onAddDateOverride != null && !readOnly

  if (!trimmed || (!canAddField && !canAddDate)) return null

  if (already) {
    return (
      <span className="shrink-0 text-[11px] text-muted-foreground" onClick={stopRowClick}>
        Added
      </span>
    )
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1" onClick={stopRowClick}>
      {canAddField ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="secondary" size="sm" className="h-7 gap-1 px-2 text-[11px]">
              <Plus className="h-3 w-3" aria-hidden />
              Override
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {FIELD_ADD_MODES.map((mode) => (
              <DropdownMenuItem
                key={mode.value}
                title={mode.hint}
                onSelect={() => onAddFieldOverride(trimmed, storedValue, mode.value)}
              >
                {mode.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {canAddDate ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => onAddDateOverride(trimmed, storedValue)}
        >
          Add date
        </Button>
      ) : null}
    </div>
  )
}
