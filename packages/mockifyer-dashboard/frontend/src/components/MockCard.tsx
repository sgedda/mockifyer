import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { MockFile, MockData } from '@/types'
import { Copy, ExternalLink, Trash2 } from 'lucide-react'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString()
}

function getGraphqlQueryPreview(query: string | null | undefined): string | null {
  if (!query || typeof query !== 'string') return null
  const compact = query.replace(/#[^\n]*\n/g, '\n').replace(/\s+/g, ' ').trim()
  if (!compact) return null

  // Heuristic: show the first top-level field and the first nested field.
  // Example: myAccount { customerId ... }
  const m = compact.match(
    /\{\s*([_A-Za-z][_0-9A-Za-z]*)\s*(?:\([^)]*\))?\s*\{\s*([_A-Za-z][_0-9A-Za-z]*)/m
  )
  if (!m) return null
  const top = m[1]
  const nested = m[2]
  return `"${top}": { ${nested}, … }`
}

function formatOverridePreviewLine(path: string, summary: string): string {
  if (!path) return summary
  if (!summary) return path
  return `${path}: ${summary}`
}

function deriveDisplayName(mock: MockFile): string {
  if (mock.endpoint) {
    try {
      const url = new URL(mock.endpoint)
      const last = url.pathname.split('/').filter(Boolean).pop()
      return last || '/'
    } catch {
      // ignore
    }
  }
  return mock.filename.includes('/') ? mock.filename.split('/').pop()! : mock.filename
}

export function MockCard({
  mock,
  selectedMock,
  onSelectMock,
  onDelete,
  onDuplicate,
  deleting,
  showActions = true,
}: {
  mock: MockFile
  selectedMock: MockData | null
  onSelectMock: (file: MockFile) => void
  onDelete?: (filename: string, e: React.MouseEvent) => void
  onDuplicate?: (filename: string, e: React.MouseEvent) => void
  deleting?: string | null
  showActions?: boolean
}) {
  const isSelected = selectedMock?.filename === mock.filename
  const displayName = deriveDisplayName(mock)
  const hasOverrides = mock.hasResponseDateOverrides === true
  const overridePreview = Array.isArray(mock.responseDateOverridesPreview)
    ? mock.responseDateOverridesPreview.slice(0, 3)
    : []

  const canShowActions = showActions && onDelete && onDuplicate

  return (
    <Card
      key={mock.filename}
      className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-md ${
        isSelected ? 'border-primary bg-primary/5' : ''
      }`}
      onClick={() => onSelectMock(mock)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="mb-2 text-foreground break-all font-mono text-sm">{displayName}</CardTitle>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="text-primary">📦</span>
                {formatFileSize(mock.size)}
              </span>
              <span className="flex items-center gap-1">
                <span className="text-primary">🕒</span>
                {formatDate(mock.modified)}
              </span>
              {mock.graphqlInfo && (
                <Badge variant="outline" className="border-purple-500/30 bg-purple-500/20 text-purple-300">
                  GraphQL
                </Badge>
              )}
              {hasOverrides && (
                <Badge variant="outline" className="border-sky-500/30 bg-sky-500/15 text-sky-200">
                  Overrides
                </Badge>
              )}
              {mock.responsePending === true && (
                <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-200">
                  Pending response
                </Badge>
              )}
              {mock.alwaysUseRealApi === true && mock.responsePending !== true && (
                <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 text-sky-200">
                  Live API
                </Badge>
              )}
              {mock.similarBodyGroup && mock.similarBodyGroup.size >= 2 && (
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/15 text-amber-100"
                  title={`Near-duplicate GraphQL query with ${mock.similarBodyGroup.size} mocks (min ${(mock.similarBodyGroup.minSimilarity * 100).toFixed(0)}% token overlap)`}
                >
                  Similar query ×{mock.similarBodyGroup.size}
                </Badge>
              )}
            </div>
          </div>
          {canShowActions && (
            <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" onClick={(e) => onDuplicate(mock.filename, e)} title="Duplicate">
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => onDelete(mock.filename, e)}
                disabled={deleting === mock.filename}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      {(mock.endpoint || mock.graphqlInfo?.query || (hasOverrides && overridePreview.length > 0)) && (
        <CardContent>
          {mock.endpoint && (
            <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="break-all">{mock.endpoint}</span>
            </div>
          )}
          {mock.graphqlInfo?.query ? (
            (() => {
              const preview = getGraphqlQueryPreview(mock.graphqlInfo?.query)
              if (!preview) return null
              return <div className="mt-1 text-xs font-mono text-muted-foreground/90 break-words">{preview}</div>
            })()
          ) : null}
          {hasOverrides && overridePreview.length > 0 ? (
            <div className="mt-2 space-y-1">
              {overridePreview.map((o) => (
                <div
                  key={`override:${mock.filename}:${o.path}`}
                  className="text-xs font-mono text-muted-foreground/90 break-words"
                >
                  {formatOverridePreviewLine(o.path, o.summary)}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      )}
    </Card>
  )
}

