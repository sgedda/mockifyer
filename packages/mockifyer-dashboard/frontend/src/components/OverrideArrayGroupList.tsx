import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import OverrideRelatedData from '@/components/OverrideRelatedData'
import { useOverrideArrayCollapse } from '@/components/OverrideArrayCollapseContext'
import {
  arrayItemGroupLabel,
  groupOverridesByTopLevelArray,
  summarizeOverrideArrayItemAtPath,
} from '@/lib/override-path-groups'
import { pathCrumbs } from '@/lib/override-related-data'

interface OverrideArrayGroupListProps<T extends { path: string }> {
  rows: T[]
  responseBody: unknown
  instanceKey: string
  renderRow: (item: T, index: number, grouped: boolean) => ReactNode
}

function ArrayItemIdentity({
  arrayItemPath,
  overrideCount,
  responseBody,
}: {
  arrayItemPath: string
  overrideCount: number
  responseBody: unknown
}) {
  const identity = summarizeOverrideArrayItemAtPath(responseBody, arrayItemPath)
  const crumbs = pathCrumbs(arrayItemPath)
  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-xs font-medium text-foreground">
          {arrayItemGroupLabel(arrayItemPath)}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {overrideCount} override{overrideCount === 1 ? '' : 's'}
        </span>
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

/**
 * Groups override rows by top-level array item. Collapse/expand is shared for the
 * whole array (every index), including related-data panels on that array.
 */
export default function OverrideArrayGroupList<T extends { path: string }>({
  rows,
  responseBody,
  instanceKey,
  renderRow,
}: OverrideArrayGroupListProps<T>) {
  const sections = groupOverridesByTopLevelArray(rows)
  const { isArrayCollapsed, toggleArray, isRelatedOpen, setRelatedOpen } = useOverrideArrayCollapse()

  return (
    <div className="space-y-3">
      {sections.map((section) => {
        if (section.kind === 'ungrouped') {
          return (
            <div key={`${instanceKey}-ungrouped-${section.index}`}>
              {renderRow(section.item, section.index, false)}
            </div>
          )
        }

        const collapsed = isArrayCollapsed(section.collapseKey)
        const relatedOpen = isRelatedOpen(section.collapseKey)
        const overrideCount = section.itemGroups.reduce((sum, group) => sum + group.items.length, 0)
        const panelId = `${instanceKey}-array-${section.collapseKey}`

        return (
          <div
            key={`${instanceKey}-array-${section.collapseKey}`}
            className="space-y-2 rounded-md border border-sky-500/20 bg-sky-500/5 p-2.5"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-start gap-1.5 px-1.5 py-1 text-left text-xs"
              aria-expanded={!collapsed}
              aria-controls={panelId}
              onClick={() => toggleArray(section.collapseKey)}
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              <span className="font-mono font-medium">{section.label}</span>
              <span className="font-normal text-muted-foreground">
                {section.itemGroups.length} item{section.itemGroups.length === 1 ? '' : 's'} ·{' '}
                {overrideCount} override{overrideCount === 1 ? '' : 's'}
              </span>
            </Button>
            {!collapsed ? (
              <div id={panelId} className="space-y-3">
                {section.itemGroups.map((group) => (
                  <div
                    key={group.arrayItemPath}
                    className="space-y-2 rounded-md border border-border bg-background p-2.5"
                  >
                    <ArrayItemIdentity
                      arrayItemPath={group.arrayItemPath}
                      overrideCount={group.items.length}
                      responseBody={responseBody}
                    />
                    <OverrideRelatedData
                      path={group.arrayItemPath}
                      responseBody={responseBody}
                      open={relatedOpen}
                      onOpenChange={(open) => setRelatedOpen(section.collapseKey, open)}
                    />
                    {group.items.map(({ item, index }) => (
                      <div key={`${instanceKey}-${index}`}>{renderRow(item, index, true)}</div>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
