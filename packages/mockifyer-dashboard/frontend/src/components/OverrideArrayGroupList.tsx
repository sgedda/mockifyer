import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import OverrideRelatedData from '@/components/OverrideRelatedData'
import OverrideItemIdentity from '@/components/OverrideItemIdentity'
import { useOverrideArrayCollapse } from '@/components/OverrideArrayCollapseContext'
import type { OverrideAddPathControlProps } from '@/components/OverrideAddPathControl'
import {
  countOverrideItemRows,
  countOverrideSectionRows,
  groupOverridesByTopLevelArray,
  type OverrideArrayItemGroup,
  type OverrideArraySection,
  type OverrideEditorSection,
} from '@/lib/override-path-groups'
import { cn } from '@/lib/utils'

type RelatedAddProps = Pick<
  OverrideAddPathControlProps,
  'existingPaths' | 'readOnly' | 'onAddFieldOverride' | 'onAddDateOverride'
>

interface OverrideArrayGroupListProps<T extends { path: string }> extends RelatedAddProps {
  rows: T[]
  responseBody: unknown
  instanceKey: string
  renderRow: (item: T, index: number, groupPath: string | null) => ReactNode
}

interface SectionListProps<T extends { path: string }> extends RelatedAddProps {
  sections: OverrideEditorSection<T>[]
  responseBody: unknown
  instanceKey: string
  groupPath: string | null
  nested: boolean
  renderRow: (item: T, index: number, groupPath: string | null) => ReactNode
}

function CollapseChevron({ collapsed }: { collapsed: boolean }) {
  return collapsed ? (
    <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
  ) : (
    <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
  )
}

function relatedAddProps(props: RelatedAddProps): RelatedAddProps {
  return {
    existingPaths: props.existingPaths,
    readOnly: props.readOnly,
    onAddFieldOverride: props.onAddFieldOverride,
    onAddDateOverride: props.onAddDateOverride,
  }
}

function ArrayItemBlock<T extends { path: string }>({
  group,
  arrayCollapseKey,
  responseBody,
  instanceKey,
  nested,
  renderRow,
  ...addProps
}: {
  group: OverrideArrayItemGroup<T>
  arrayCollapseKey: string
  responseBody: unknown
  instanceKey: string
  nested: boolean
  renderRow: (item: T, index: number, groupPath: string | null) => ReactNode
} & RelatedAddProps) {
  const { isItemCollapsed, toggleItem, isRelatedOpen, setRelatedOpen } = useOverrideArrayCollapse()
  const collapsed = isItemCollapsed(group.arrayItemPath)
  const relatedOpen = isRelatedOpen(arrayCollapseKey)
  const overrideCount = countOverrideItemRows(group)
  const panelId = `${instanceKey}-item-${group.arrayItemPath}`

  return (
    <div
      className={cn(
        'space-y-2 rounded-md border p-2.5',
        nested ? 'border-border/80 bg-muted/20' : 'border-border bg-background'
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto w-full items-start justify-start gap-1.5 px-1.5 py-1 text-left"
        aria-expanded={!collapsed}
        aria-controls={panelId}
        onClick={() => toggleItem(group.arrayItemPath)}
      >
        <CollapseChevron collapsed={collapsed} />
        <OverrideItemIdentity
          arrayItemPath={group.arrayItemPath}
          overrideCount={overrideCount}
          responseBody={responseBody}
        />
      </Button>
      {!collapsed ? (
        <div id={panelId} className="space-y-2">
          <OverrideRelatedData
            path={group.arrayItemPath}
            responseBody={responseBody}
            open={relatedOpen}
            onOpenChange={(open) => setRelatedOpen(arrayCollapseKey, open)}
            {...relatedAddProps(addProps)}
          />
          <OverrideSectionList
            sections={group.children}
            responseBody={responseBody}
            instanceKey={instanceKey}
            groupPath={group.arrayItemPath}
            nested
            renderRow={renderRow}
            {...relatedAddProps(addProps)}
          />
        </div>
      ) : null}
    </div>
  )
}

function ArraySectionBlock<T extends { path: string }>({
  section,
  responseBody,
  instanceKey,
  nested,
  renderRow,
  ...addProps
}: {
  section: OverrideArraySection<T>
  responseBody: unknown
  instanceKey: string
  nested: boolean
  renderRow: (item: T, index: number, groupPath: string | null) => ReactNode
} & RelatedAddProps) {
  const { isArrayCollapsed, toggleArray } = useOverrideArrayCollapse()
  const collapsed = isArrayCollapsed(section.collapseKey)
  const overrideCount = countOverrideSectionRows(section)
  const panelId = `${instanceKey}-array-${section.collapseKey}`

  return (
    <div
      className={cn(
        'space-y-2 rounded-md border p-2.5',
        nested ? 'border-sky-500/15 bg-sky-500/[0.03]' : 'border-sky-500/20 bg-sky-500/5'
      )}
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
        <CollapseChevron collapsed={collapsed} />
        <span className="font-mono font-medium">{section.label}</span>
        <span className="font-normal text-muted-foreground">
          {section.itemGroups.length} item{section.itemGroups.length === 1 ? '' : 's'} ·{' '}
          {overrideCount} override{overrideCount === 1 ? '' : 's'}
        </span>
      </Button>
      {!collapsed ? (
        <div id={panelId} className="space-y-3">
          {section.itemGroups.map((group) => (
            <ArrayItemBlock
              key={group.arrayItemPath}
              group={group}
              arrayCollapseKey={section.collapseKey}
              responseBody={responseBody}
              instanceKey={instanceKey}
              nested={nested}
              renderRow={renderRow}
              {...relatedAddProps(addProps)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function OverrideSectionList<T extends { path: string }>({
  sections,
  responseBody,
  instanceKey,
  groupPath,
  nested,
  renderRow,
  ...addProps
}: SectionListProps<T>) {
  return (
    <div className="space-y-3">
      {sections.map((section) => {
        if (section.kind === 'ungrouped') {
          return (
            <div key={`${instanceKey}-ungrouped-${section.index}`}>
              {renderRow(section.item, section.index, groupPath)}
            </div>
          )
        }
        return (
          <ArraySectionBlock
            key={`${instanceKey}-array-${section.collapseKey}`}
            section={section}
            responseBody={responseBody}
            instanceKey={instanceKey}
            nested={nested}
            renderRow={renderRow}
            {...relatedAddProps(addProps)}
          />
        )
      })}
    </div>
  )
}

/**
 * Groups override rows by each array in the path. Collapse/expand is shared for
 * the same array and for the same array item (`bookings[0]`, nested `accommodations[0]`, …).
 */
export default function OverrideArrayGroupList<T extends { path: string }>({
  rows,
  responseBody,
  instanceKey,
  renderRow,
  ...addProps
}: OverrideArrayGroupListProps<T>) {
  const sections = groupOverridesByTopLevelArray(rows)
  return (
    <OverrideSectionList
      sections={sections}
      responseBody={responseBody}
      instanceKey={instanceKey}
      groupPath={null}
      nested={false}
      renderRow={renderRow}
      {...relatedAddProps(addProps)}
    />
  )
}
