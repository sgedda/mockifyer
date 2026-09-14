import { useEffect, useId, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getValueAtResponsePath } from '@/lib/detect-date-fields'
import {
  defaultInspectPath,
  formatJsonPreview,
  formatLeafPreview,
  isUnmatchedOverridePath,
  joinOverridePath,
  pathCrumbs,
  relatedChildKeys,
} from '@/lib/override-related-data'
import { cn } from '@/lib/utils'

interface OverrideRelatedDataProps {
  path: string
  responseBody: unknown
}

/**
 * Expandable stored-JSON inspector for one override path.
 * Path crumbs and related keys drill into parent objects (booking, timeline item, …).
 */
export default function OverrideRelatedData({ path, responseBody }: OverrideRelatedDataProps) {
  const panelId = useId()
  const trimmed = path.trim()
  const crumbs = useMemo(() => pathCrumbs(trimmed), [trimmed])
  const storedValue = useMemo(
    () => (trimmed ? getValueAtResponsePath(responseBody, trimmed) : undefined),
    [responseBody, trimmed]
  )
  const [open, setOpen] = useState(false)
  const [inspectPath, setInspectPath] = useState<string | null>(null)

  useEffect(() => {
    setOpen(false)
    setInspectPath(null)
  }, [trimmed])

  const effectiveInspect = inspectPath ?? (open ? defaultInspectPath(responseBody, trimmed) : trimmed)
  const inspectValue = useMemo(
    () => (effectiveInspect ? getValueAtResponsePath(responseBody, effectiveInspect) : undefined),
    [responseBody, effectiveInspect]
  )
  const childKeys = relatedChildKeys(inspectValue)
  const leafPreview = formatLeafPreview(storedValue)

  function inspect(nextPath: string) {
    setInspectPath(nextPath)
    setOpen(true)
  }

  if (!trimmed) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Enter a path to inspect stored JSON around it.
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
          onClick={() => setOpen((current) => !current)}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          Related data
        </Button>
        {storedValue !== undefined ? (
          <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground" title={leafPreview}>
            stored {leafPreview}
          </span>
        ) : (
          <span className="text-[11px] font-medium text-destructive" role="status">
            Nothing at this path in the stored body
          </span>
        )}
      </div>

      {crumbs.length > 0 ? (
        <nav
          aria-label="Override path"
          className="flex flex-wrap items-center gap-y-0.5 font-mono text-[11px] leading-snug"
        >
          {crumbs.map((crumb, index) => {
            const selected = effectiveInspect === crumb.path && open
            const crumbUnmatched = isUnmatchedOverridePath(responseBody, crumb.path)
            return (
              <span key={crumb.path} className="inline-flex items-center">
                {index > 0 ? <span className="mx-0.5 text-muted-foreground">›</span> : null}
                <button
                  type="button"
                  className={cn(
                    'rounded px-0.5 hover:underline',
                    crumbUnmatched ? 'text-destructive' : 'text-sky-300',
                    selected && (crumbUnmatched ? 'bg-destructive/20' : 'bg-sky-500/20 text-sky-100')
                  )}
                  title={
                    crumbUnmatched
                      ? `No stored JSON at ${crumb.path}`
                      : `Inspect stored JSON at ${crumb.path}`
                  }
                  onClick={() => inspect(crumb.path)}
                >
                  {crumb.label}
                </button>
              </span>
            )
          })}
        </nav>
      ) : null}

      {open ? (
        <div
          id={panelId}
          className="space-y-3 rounded-md border border-border bg-muted/30 p-2.5"
        >
          {trimmed !== effectiveInspect && storedValue !== undefined ? (
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Stored at {trimmed}</div>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 font-mono text-[11px] leading-snug">
                {formatJsonPreview(storedValue)}
              </pre>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <div className="text-[11px] text-muted-foreground">
              {effectiveInspect
                ? `Related JSON at ${effectiveInspect}`
                : 'Stored response body'}
            </div>
            {inspectValue === undefined ? (
              <p className="text-[11px] font-medium text-destructive">
                Nothing at this path in the stored response body.
              </p>
            ) : (
              <>
                {childKeys.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {childKeys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-sky-200 hover:bg-muted/80"
                        title={`Inspect ${joinOverridePath(effectiveInspect, key)}`}
                        onClick={() => inspect(joinOverridePath(effectiveInspect, key))}
                      >
                        {Array.isArray(inspectValue) ? `[${key}]` : key}
                      </button>
                    ))}
                  </div>
                ) : null}
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 font-mono text-[11px] leading-snug">
                  {formatJsonPreview(inspectValue)}
                </pre>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
