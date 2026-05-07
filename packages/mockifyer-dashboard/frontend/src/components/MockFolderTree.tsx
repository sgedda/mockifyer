import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { MockCard } from '@/components/MockCard'
import type { MockFile, MockData } from '@/types'
import type { MockFolderNode } from '@/lib/mockFolderTree'
import { sortFolderEntries } from '@/lib/mockFolderTree'
import { ChevronRight, ChevronDown, Folder } from 'lucide-react'

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
      {sortedFiles.map((mock) => (
        <MockCard
          key={mock.filename}
          mock={mock}
          selectedMock={selectedMock}
          onSelectMock={onSelectMock}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          deleting={deleting}
        />
      ))}
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
