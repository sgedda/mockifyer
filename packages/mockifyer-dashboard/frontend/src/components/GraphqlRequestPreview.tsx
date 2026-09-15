import { cn } from '@/lib/utils'
import {
  graphqlQueryPreviewText,
  graphqlVariablesPreviewText,
  type GraphqlListInfo,
} from '@/lib/graphql-request-preview'

interface GraphqlRequestPreviewProps {
  graphqlInfo: GraphqlListInfo | null | undefined
  compact?: boolean
  className?: string
}

function previewClass(compact?: boolean): string {
  return cn(
    'mt-1 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 font-mono text-[11px] leading-snug text-muted-foreground',
    compact ? 'max-h-24' : 'max-h-40'
  )
}

/**
 * Operation name, query excerpt, and variables for mock list / Overrides picker.
 */
export default function GraphqlRequestPreview({
  graphqlInfo,
  compact = false,
  className,
}: GraphqlRequestPreviewProps) {
  if (!graphqlInfo) return null
  const queryPreview = graphqlQueryPreviewText(graphqlInfo)
  const variablesPreview = graphqlVariablesPreviewText(graphqlInfo)
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
        <pre className={previewClass(compact)}>{queryPreview}</pre>
      ) : null}
      {variablesPreview ? (
        <pre className={previewClass(true)}>
          {`# Variables\n${variablesPreview}`}
        </pre>
      ) : null}
    </div>
  )
}
