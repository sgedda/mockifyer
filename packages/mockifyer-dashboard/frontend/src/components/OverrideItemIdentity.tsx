import { arrayItemGroupLabel, summarizeOverrideArrayItemAtPath } from '@/lib/override-path-groups'
import { pathCrumbs } from '@/lib/override-related-data'

interface OverrideItemIdentityProps {
  arrayItemPath: string
  responseBody: unknown
  overrideCount?: number
  showCrumbs?: boolean
}

/** Identity header matching grouped override cards (`bookings[18]` + booking number / dates). */
export default function OverrideItemIdentity({
  arrayItemPath,
  responseBody,
  overrideCount,
  showCrumbs = true,
}: OverrideItemIdentityProps) {
  const identity = summarizeOverrideArrayItemAtPath(responseBody, arrayItemPath)
  const crumbs = showCrumbs ? pathCrumbs(arrayItemPath) : []
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-xs font-medium text-foreground">
          {arrayItemGroupLabel(arrayItemPath)}
        </span>
        {overrideCount != null ? (
          <span className="text-[11px] text-muted-foreground">
            {overrideCount} override{overrideCount === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      {identity ? (
        <div className="text-[11px] leading-snug text-sky-200/90" title={identity}>
          {identity}
        </div>
      ) : null}
      {crumbs.length > 0 ? (
        <div className="font-mono text-[10px] text-muted-foreground">
          {crumbs.map((crumb) => crumb.label).join(' › ')}
        </div>
      ) : null}
    </div>
  )
}
