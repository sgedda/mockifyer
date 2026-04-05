import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { MockFile, MockData } from '@/types'
import type { MockFolderNode } from '@/lib/mockFolderTree'
import { sortFolderEntries } from '@/lib/mockFolderTree'
import { Copy, ExternalLink, Trash2, ChevronRight, ChevronDown, Folder } from 'lucide-react'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString()
}

interface FolderTreeBulkContextValue {
  /** Incremented on each Expand all / Collapse all so nested folders sync. */
  bulkGeneration: number
  bulkMode: 'expand' | 'collapse'
  expandAllFolders: () => void
  collapseAllFolders: () => void
}

const FolderTreeBulkContext = createContext<FolderTreeBulkContextValue | null>(null)

export function MockFolderTreeProvider({ children }: { children: ReactNode }) {
  const [bulkGeneration, setBulkGeneration] = useState(0)
  const [bulkMode, setBulkMode] = useState<'expand' | 'collapse'>('expand')

  const expandAllFolders = useCallback(() => {
    setBulkMode('expand')
    setBulkGeneration((g) => g + 1)
  }, [])

  const collapseAllFolders = useCallback(() => {
    setBulkMode('collapse')
    setBulkGeneration((g) => g + 1)
  }, [])

  const value = useMemo(
    () => ({
      bulkGeneration,
      bulkMode,
      expandAllFolders,
      collapseAllFolders,
    }),
    [bulkGeneration, bulkMode, expandAllFolders, collapseAllFolders]
  )

  return <FolderTreeBulkContext.Provider value={value}>{children}</FolderTreeBulkContext.Provider>
}

export function useFolderTreeBulkActions(): FolderTreeBulkContextValue {
  const ctx = useContext(FolderTreeBulkContext)
  if (!ctx) {
    throw new Error('useFolderTreeBulkActions must be used within MockFolderTreeProvider')
  }
  return ctx
}

interface MockFolderTreeProps {
  node: MockFolderNode
  level: number
  selectedMock: MockData | null
  onSelectMock: (file: MockFile) => void
  onDelete: (filename: string, e: React.MouseEvent) => void
  onDuplicate: (filename: string, e: React.MouseEvent) => void
  deleting: string | null
}

export function MockFolderTree({
  node,
  level,
  selectedMock,
  onSelectMock,
  onDelete,
  onDuplicate,
  deleting,
}: MockFolderTreeProps) {
  const folders = sortFolderEntries(node)
  const sortedFiles = [...node.files].sort((a, b) => a.filename.localeCompare(b.filename))

  return (
    <div className={level > 0 ? 'space-y-3' : 'space-y-4'}>
      {sortedFiles.map((mock) => {
        const isSelected = selectedMock?.filename === mock.filename
        const displayName = mock.filename.includes('/') ? mock.filename.split('/').pop()! : mock.filename
        return (
          <Card
            key={mock.filename}
            className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-md ${
              isSelected ? 'border-primary bg-primary/5' : ''
            } ${level > 0 ? 'ml-0' : ''}`}
            onClick={() => onSelectMock(mock)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg mb-2 text-foreground break-all font-mono text-sm">
                    {displayName}
                  </CardTitle>
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
                  </div>
                </div>
                <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => onDuplicate(mock.filename, e)}
                    title="Duplicate"
                  >
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
              </div>
            </CardHeader>
            {mock.endpoint && (
              <CardContent>
                <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="break-all">{mock.endpoint}</span>
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}
      {folders.map(({ name, child }) => (
        <FolderSection
          key={child.fullPath}
          title={name}
          defaultOpen={level < 2}
        >
          <MockFolderTree
            node={child}
            level={level + 1}
            selectedMock={selectedMock}
            onSelectMock={onSelectMock}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            deleting={deleting}
          />
        </FolderSection>
      ))}
    </div>
  )
}

function FolderSection({
  title,
  defaultOpen,
  children,
}: {
  title: string
  defaultOpen: boolean
  children: ReactNode
}) {
  const bulkCtx = useContext(FolderTreeBulkContext)
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (!bulkCtx || bulkCtx.bulkGeneration === 0) return
    setOpen(bulkCtx.bulkMode === 'expand')
  }, [bulkCtx, bulkCtx?.bulkGeneration, bulkCtx?.bulkMode])

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted/50 rounded-t-lg"
      >
        <Folder className="h-4 w-4 shrink-0 text-primary" />
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <span className="font-mono">{title}</span>
      </button>
      {open && <div className="border-t border-border/60 p-3 pt-2 space-y-3">{children}</div>}
    </div>
  )
}
