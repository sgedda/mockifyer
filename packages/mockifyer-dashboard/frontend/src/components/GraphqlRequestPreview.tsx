import { useLayoutEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  graphqlQueryPreviewText,
  graphqlVariablesOneLineText,
  graphqlVariablesPreviewText,
  type GraphqlListInfo,
} from '@/lib/graphql-request-preview'

const QUERY_CLAMP_LINES = 2
const VARIABLES_CLAMP_LINES = 1

interface GraphqlRequestPreviewProps {
  graphqlInfo: GraphqlListInfo | null | undefined
  compact?: boolean
  className?: string
}

interface ExpandablePreviewTextProps {
  collapsedText: string
  expandedText: string
  lines: 1 | 2
  /** Tighter max height when expanded (overrides picker). */
  compact?: boolean
  'aria-label'?: string
}

function stopNestedActivation(event: SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}

/**
 * Clamped preview with show more/less. Uses a span (not a button) so it works
 * inside the Overrides mock picker, which is already a button.
 */
function ExpandablePreviewText({
  collapsedText,
  expandedText,
  lines,
  compact,
  'aria-label': ariaLabel,
}: ExpandablePreviewTextProps) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const textRef = useRef<HTMLPreElement>(null)
  const displayText = expanded ? expandedText : collapsedText

  useLayoutEffect(() => {
    setExpanded(false)
  }, [collapsedText, expandedText])

  useLayoutEffect(() => {
    const el = textRef.current
    if (!el || expanded) return

    const measure = () => {
      setOverflows(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [collapsedText, expanded, lines])

  const exceedsByLines = collapsedText.split('\n').length > lines
  const canToggle = expanded || overflows || exceedsByLines
  const clampClass =
    lines === 1
      ? 'overflow-hidden text-ellipsis whitespace-nowrap'
      : 'line-clamp-2 overflow-hidden whitespace-pre-wrap break-all'

  function toggle(event: SyntheticEvent) {
    stopNestedActivation(event)
    setExpanded((open) => !open)
  }

  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    toggle(event)
  }

  return (
    <div className="flex items-start gap-1">
      <pre
        ref={textRef}
        className={cn(
          'min-w-0 flex-1 rounded bg-muted/40 p-2 font-mono text-[11px] leading-snug text-muted-foreground',
          expanded
            ? cn('max-h-64 overflow-auto whitespace-pre-wrap break-all', compact && 'max-h-32')
            : clampClass
        )}
      >
        {displayText}
      </pre>
      {canToggle ? (
        <span
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${ariaLabel ?? 'preview'}` : `Expand ${ariaLabel ?? 'preview'}`}
          title={expanded ? 'Show less' : 'Show more'}
          className="mt-1 inline-flex h-6 shrink-0 cursor-pointer items-center gap-0.5 rounded-md px-1.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={toggle}
          onPointerDown={stopNestedActivation}
          onKeyDown={onKeyDown}
        >
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )}
          {expanded ? 'Less' : 'More'}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Operation name, query excerpt, and variables for mock list / Overrides picker.
 * Query is clamped to 2 lines; variables to 1 line, each with an expand control when truncated.
 */
export default function GraphqlRequestPreview({
  graphqlInfo,
  compact = false,
  className,
}: GraphqlRequestPreviewProps) {
  if (!graphqlInfo) return null
  const queryPreview = graphqlQueryPreviewText(graphqlInfo)
  const variablesPreview = graphqlVariablesPreviewText(graphqlInfo)
  const variablesOneLine = graphqlVariablesOneLineText(graphqlInfo)
  const operationName =
    typeof graphqlInfo.operationName === 'string' && graphqlInfo.operationName.trim()
      ? graphqlInfo.operationName.trim()
      : null
  if (!queryPreview && !variablesPreview && !operationName) return null

  return (
    <div className={cn('mt-1 space-y-1 text-left', className)}>
      {operationName ? (
        <div className="text-[11px] font-medium text-purple-200/90">
          GraphQL · {operationName}
        </div>
      ) : null}
      {queryPreview ? (
        <ExpandablePreviewText
          collapsedText={queryPreview}
          expandedText={queryPreview}
          lines={QUERY_CLAMP_LINES}
          compact={compact}
          aria-label="GraphQL query"
        />
      ) : null}
      {variablesOneLine ? (
        <ExpandablePreviewText
          collapsedText={`# Variables ${variablesOneLine}`}
          expandedText={`# Variables\n${variablesPreview ?? variablesOneLine}`}
          lines={VARIABLES_CLAMP_LINES}
          compact={compact}
          aria-label="GraphQL variables"
        />
      ) : null}
    </div>
  )
}
