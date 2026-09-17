import { useEffect, useId, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import OverrideAddPathControl, {
  type OverrideAddPathControlProps,
} from '@/components/OverrideAddPathControl'
import OverrideItemIdentity from '@/components/OverrideItemIdentity'
import { getValueAtResponsePath } from '@/lib/detect-date-fields'
import {
  countOverridesAtOrUnderPath,
  defaultInspectPath,
  formatJsonPreview,
  formatLeafPreview,
  isRecordArray,
  pathCrumbs,
  relatedChildEntries,
  RELATED_FILTER_MIN_COUNT,
} from '@/lib/override-related-data'
import { cn } from '@/lib/utils'

interface OverrideRelatedDataProps
  extends Pick<
    OverrideAddPathControlProps,
    'existingPaths' | 'readOnly' | 'onAddFieldOverride' | 'onAddDateOverride'
  > {
  path: string
  responseBody: unknown
  /** Controlled expand state — share across overrides on the same array. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Header when browsing from the response root to pick a path. */
  browseLabel?: string
}

function inspectCrumbs(inspectPath: string) {
  return [{ path: '', label: 'response' }, ...pathCrumbs(inspectPath)]
}

/**
 * Expandable stored-JSON inspector. Path crumbs and related keys drill into
 * parent objects; array items use the same identity cards as grouped overrides.
 */
export default function OverrideRelatedData({
  path,
  responseBody,
  open: openProp,
  onOpenChange,
  browseLabel,
  existingPaths,
  readOnly,
  onAddFieldOverride,
  onAddDateOverride,
}: OverrideRelatedDataProps) {
  const panelId = useId()
  const trimmed = path.trim()
  const storedValue = useMemo(
    () => getValueAtResponsePath(responseBody, trimmed),
    [responseBody, trimmed]
  )
  const isControlled = onOpenChange != null
  const [localOpen, setLocalOpen] = useState(false)
  const open = isControlled ? Boolean(openProp) : localOpen
  const [inspectPath, setInspectPath] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [showRawJson, setShowRawJson] = useState(false)

  function setOpen(next: boolean) {
    if (isControlled) onOpenChange(next)
    else setLocalOpen(next)
  }

  useEffect(() => {
    setInspectPath(null)
    setFilter('')
    setShowRawJson(false)
    if (!isControlled) setLocalOpen(false)
  }, [trimmed, isControlled])

  const effectiveInspect = inspectPath ?? (open ? defaultInspectPath(responseBody, trimmed) : trimmed)
  const inspectValue = useMemo(
    () => getValueAtResponsePath(responseBody, effectiveInspect),
    [responseBody, effectiveInspect]
  )
  const childResult = useMemo(
    () => relatedChildEntries(inspectValue, effectiveInspect, filter),
    [inspectValue, effectiveInspect, filter]
  )
  const showArrayPicker = isRecordArray(inspectValue)
  const showFilter =
    childResult.total >= RELATED_FILTER_MIN_COUNT || filter.trim().length > 0
  const leafPreview = formatLeafPreview(storedValue)
  const crumbs = inspectCrumbs(effectiveInspect)
  const canAdd =
    (onAddFieldOverride != null || onAddDateOverride != null) && readOnly !== true
  const isRootBrowser = !trimmed
  const headerLabel = isRootBrowser
    ? browseLabel ?? 'Browse JSON to add override'
    : 'Related data'

  function inspect(nextPath: string) {
    setInspectPath(nextPath)
    setFilter('')
    setShowRawJson(false)
    setOpen(true)
  }

  if (responseBody === undefined) {
    return (
      <p className="text-[11px] text-muted-foreground">
        No stored response body to inspect.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          {headerLabel}
        </Button>
        {!isRootBrowser && storedValue !== undefined ? (
          <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground" title={leafPreview}>
            stored {leafPreview}
          </span>
        ) : null}
        {!isRootBrowser && storedValue === undefined ? (
          <span className="text-[11px] text-muted-foreground">
            Nothing at this path in the stored body
          </span>
        ) : null}
        {isRootBrowser && !open ? (
          <span className="text-[11px] text-muted-foreground">
            Click through objects and list items, then add an override
          </span>
        ) : null}
      </div>

      {open ? (
        <div
          id={panelId}
          className="space-y-3 rounded-md border border-border bg-muted/30 p-2.5"
        >
          <nav
            aria-label="Stored JSON path"
            className="flex flex-wrap items-center gap-y-0.5 font-mono text-[11px] leading-snug"
          >
            {crumbs.map((crumb, index) => {
              const selected = effectiveInspect === crumb.path
              return (
                <span key={crumb.path || 'response'} className="inline-flex items-center">
                  {index > 0 ? <span className="mx-0.5 text-muted-foreground">›</span> : null}
                  <button
                    type="button"
                    className={cn(
                      'rounded px-0.5 text-sky-300 hover:underline',
                      selected && 'bg-sky-500/20 text-sky-100'
                    )}
                    title={
                      crumb.path
                        ? `Inspect stored JSON at ${crumb.path}`
                        : 'Inspect stored response body'
                    }
                    onClick={() => inspect(crumb.path)}
                  >
                    {crumb.label}
                  </button>
                </span>
              )
            })}
          </nav>

          {trimmed && trimmed !== effectiveInspect && storedValue !== undefined ? (
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Stored at {trimmed}</div>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 font-mono text-[11px] leading-snug">
                {formatJsonPreview(storedValue)}
              </pre>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] text-muted-foreground">
                {effectiveInspect
                  ? `Related JSON at ${effectiveInspect}`
                  : 'Stored response body'}
              </div>
              {canAdd ? (
                <OverrideAddPathControl
                  path={effectiveInspect}
                  storedValue={inspectValue}
                  existingPaths={existingPaths}
                  readOnly={readOnly}
                  onAddFieldOverride={onAddFieldOverride}
                  onAddDateOverride={onAddDateOverride}
                />
              ) : null}
            </div>

            {inspectValue === undefined ? (
              <p className="text-[11px] text-muted-foreground">
                Nothing at this path in the stored response body.
              </p>
            ) : (
              <>
                {showFilter ? (
                  <Input
                    className="h-8 font-mono text-xs"
                    placeholder={
                      showArrayPicker
                        ? 'Filter items (booking number, id, index…)'
                        : 'Filter keys'
                    }
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    aria-label="Filter stored JSON children"
                  />
                ) : null}

                {showArrayPicker ? (
                  <div className="max-h-72 space-y-1.5 overflow-y-auto">
                    {childResult.entries.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        {filter.trim()
                          ? 'No items match that filter.'
                          : 'No items in this array.'}
                      </p>
                    ) : (
                      childResult.entries.map((entry) => {
                        const overrideCount = existingPaths
                          ? countOverridesAtOrUnderPath(existingPaths, entry.path)
                          : undefined
                        return (
                          <div
                            key={entry.path}
                            className="flex items-start gap-2 rounded-md border border-border/80 bg-background px-2 py-1.5"
                          >
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
                              title={`Inspect ${entry.path}`}
                              onClick={() => inspect(entry.path)}
                            >
                              <ChevronRight
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                              <OverrideItemIdentity
                                arrayItemPath={entry.path}
                                responseBody={responseBody}
                                overrideCount={overrideCount}
                                showCrumbs={false}
                              />
                            </button>
                            {canAdd ? (
                              <OverrideAddPathControl
                                path={entry.path}
                                storedValue={entry.value}
                                existingPaths={existingPaths}
                                readOnly={readOnly}
                                onAddFieldOverride={onAddFieldOverride}
                                onAddDateOverride={onAddDateOverride}
                              />
                            ) : null}
                          </div>
                        )
                      })
                    )}
                  </div>
                ) : childResult.entries.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {childResult.entries.map((entry) => (
                      <button
                        key={entry.key}
                        type="button"
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-sky-200 hover:bg-muted/80"
                        title={`Inspect ${entry.path}`}
                        onClick={() => inspect(entry.path)}
                      >
                        {Array.isArray(inspectValue) ? `[${entry.key}]` : entry.key}
                      </button>
                    ))}
                  </div>
                ) : null}

                {childResult.truncated > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Showing {childResult.entries.length} of {childResult.total}
                    {filter.trim() ? ' matches' : ''}. Filter to find the rest.
                  </p>
                ) : null}

                {showArrayPicker && !showRawJson ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 text-[11px] text-muted-foreground"
                    onClick={() => setShowRawJson(true)}
                  >
                    Show raw JSON
                  </Button>
                ) : (
                  <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 font-mono text-[11px] leading-snug">
                    {formatJsonPreview(inspectValue)}
                  </pre>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
