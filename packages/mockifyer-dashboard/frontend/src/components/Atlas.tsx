import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Map, RefreshCw, Trash2 } from 'lucide-react'
import { getApiBase } from '@/lib/base-path'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const API_BASE = getApiBase()
const noStore: RequestInit = { cache: 'no-store' }

interface AtlasDocDatasourceEdge {
  datasourceId: string
  dataRoot?: string
  kind?: string
  operations: string[]
}

interface AtlasDocNode {
  nodeId: string
  type: string
  path: string
  label?: string
  source: 'cms' | 'hardcoded'
  parentId?: string | null
  datasources: AtlasDocDatasourceEdge[]
  propsSchema?: unknown
  propsSample?: unknown
  lastSeenAt: string
}

interface AtlasDocPage {
  pageId: string
  pageSlug?: string
  nodes: Record<string, AtlasDocNode>
  lastSeenAt: string
}

interface AtlasDocScreen {
  screen: string
  components: string[]
  datasourceIds: string[]
  lastSeenAt: string
}

interface AtlasDocPrefetch {
  datasourceId: string
  kind?: string
  operations: string[]
  phases: string[]
  lastSeenAt: string
}

interface AtlasDocMap {
  scenario: string
  updatedAt: string
  pages: Record<string, AtlasDocPage>
  screens: Record<string, AtlasDocScreen>
  prefetches: Record<string, AtlasDocPrefetch>
}

interface AtlasDatasourceRef {
  datasourceId: string
  requestId: string
  dataRoot?: string
  kind?: string
  operation?: string
  source?: string
}

interface AtlasTreeNode {
  nodeId: string
  type: string
  path: string
  pageId: string
  label?: string
  source: 'cms' | 'hardcoded'
  datasources: AtlasDatasourceRef[]
  shown?: unknown
  children: AtlasTreeNode[]
  eventId: string
  timestamp: string
}

interface AtlasPrefetch {
  id: string
  datasourceId: string
  requestId: string
  operation?: string
  phase: string
  timestamp: string
}

interface AtlasProps {
  scenario: string
}

type AtlasTab = 'doc' | 'session'

function TreeNodeView({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: AtlasTreeNode
  depth: number
  selectedId: string | null
  onSelect: (node: AtlasTreeNode) => void
}) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  const selected = selectedId === node.nodeId

  return (
    <div className="text-sm">
      <button
        type="button"
        className={`flex w-full items-center gap-1 rounded px-2 py-1.5 text-left hover:bg-muted/60 ${
          selected ? 'bg-muted' : ''
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <span
            role="button"
            tabIndex={0}
            className="inline-flex"
            onClick={(e) => {
              e.stopPropagation()
              setOpen((v) => !v)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                setOpen((v) => !v)
              }
            }}
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
        ) : (
          <span className="inline-block w-3.5" />
        )}
        <span className="font-medium">{node.label || node.type}</span>
        <Badge variant="outline" className="ml-1 text-[10px]">
          {node.source}
        </Badge>
        {node.datasources.length > 0 && (
          <Badge variant="secondary" className="ml-1 text-[10px]">
            {node.datasources.length} ds
          </Badge>
        )}
      </button>
      {open &&
        node.children.map((child) => (
          <TreeNodeView
            key={`${child.nodeId}-${child.eventId}`}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  )
}

function DocNodeRow({
  node,
  selected,
  onSelect,
}: {
  node: AtlasDocNode
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted/60 ${selected ? 'bg-muted' : ''}`}
      onClick={onSelect}
    >
      <div className="flex flex-wrap items-center gap-1">
        <span className="font-medium">{node.label || node.type}</span>
        <Badge variant="outline" className="text-[10px]">
          {node.source}
        </Badge>
        {node.datasources.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {node.datasources.length} ds
          </Badge>
        )}
      </div>
      <div className="font-mono text-[10px] text-muted-foreground truncate">{node.path}</div>
    </button>
  )
}

/**
 * Atlas — auto-doc map (upserted) + optional session event log.
 */
export default function Atlas({ scenario }: AtlasProps) {
  const { toast } = useToast()
  const [tab, setTab] = useState<AtlasTab>('doc')
  const [doc, setDoc] = useState<AtlasDocMap | null>(null)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedScreen, setSelectedScreen] = useState<string | null>(null)

  const [sessions, setSessions] = useState<string[]>([])
  const [sessionId, setSessionId] = useState<string>('')
  const [tree, setTree] = useState<AtlasTreeNode[]>([])
  const [prefetches, setPrefetches] = useState<AtlasPrefetch[]>([])
  const [selected, setSelected] = useState<AtlasTreeNode | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDoc = useCallback(async () => {
    const res = await fetch(
      `${API_BASE}/atlas/doc?scenario=${encodeURIComponent(scenario)}`,
      noStore
    )
    if (!res.ok) throw new Error('Failed to load atlas doc')
    const json = (await res.json()) as { doc: AtlasDocMap }
    setDoc(json.doc)
    return json.doc
  }, [scenario])

  const loadSessions = useCallback(async () => {
    const res = await fetch(
      `${API_BASE}/atlas/sessions?scenario=${encodeURIComponent(scenario)}`,
      noStore
    )
    if (!res.ok) throw new Error('Failed to load atlas sessions')
    const json = (await res.json()) as { sessions: string[] }
    setSessions(json.sessions ?? [])
    return json.sessions ?? []
  }, [scenario])

  const loadTree = useCallback(
    async (sid: string) => {
      if (!sid) {
        setTree([])
        setPrefetches([])
        setSelected(null)
        return
      }
      const res = await fetch(
        `${API_BASE}/atlas/tree?scenario=${encodeURIComponent(scenario)}&sessionId=${encodeURIComponent(sid)}`,
        noStore
      )
      if (!res.ok) throw new Error('Failed to load atlas tree')
      const json = (await res.json()) as {
        tree: AtlasTreeNode[]
        prefetches: AtlasPrefetch[]
      }
      setTree(json.tree ?? [])
      setPrefetches(json.prefetches ?? [])
      setSelected(null)
    },
    [scenario]
  )

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const nextDoc = await loadDoc()
      const pages = Object.keys(nextDoc.pages)
      if (pages.length && (!selectedPageId || !nextDoc.pages[selectedPageId])) {
        setSelectedPageId(pages.sort()[0])
      }
      if (tab === 'session') {
        const nextSessions = await loadSessions()
        const sid = sessionId && nextSessions.includes(sessionId) ? sessionId : nextSessions[0] ?? ''
        setSessionId(sid)
        await loadTree(sid)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load atlas',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [loadDoc, loadSessions, loadTree, selectedPageId, sessionId, tab, toast])

  useEffect(() => {
    void refresh()
  }, [scenario])

  useEffect(() => {
    if (tab !== 'session' || !sessionId) return
    void loadTree(sessionId).catch(() => undefined)
  }, [sessionId, loadTree, tab])

  async function clearDoc() {
    try {
      const res = await fetch(
        `${API_BASE}/atlas/doc?scenario=${encodeURIComponent(scenario)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('Failed to clear doc')
      toast({ title: 'Cleared', description: 'Atlas auto-doc map reset' })
      setSelectedPageId(null)
      setSelectedNodeId(null)
      setSelectedScreen(null)
      await refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to clear doc',
        variant: 'destructive',
      })
    }
  }

  async function clearSession() {
    if (!sessionId) return
    try {
      const res = await fetch(
        `${API_BASE}/atlas/events?scenario=${encodeURIComponent(scenario)}&sessionId=${encodeURIComponent(sessionId)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('Failed to clear session')
      toast({ title: 'Cleared', description: `Session log ${sessionId}` })
      await refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to clear',
        variant: 'destructive',
      })
    }
  }

  const pages = doc ? Object.values(doc.pages).sort((a, b) => a.pageId.localeCompare(b.pageId)) : []
  const screens = doc
    ? Object.values(doc.screens).sort((a, b) => a.screen.localeCompare(b.screen))
    : []
  const docPrefetches = doc
    ? Object.values(doc.prefetches).sort((a, b) => a.datasourceId.localeCompare(b.datasourceId))
    : []
  const activePage = selectedPageId && doc ? doc.pages[selectedPageId] : null
  const pageNodes = activePage
    ? Object.values(activePage.nodes).sort((a, b) => a.path.localeCompare(b.path))
    : []
  const activeNode =
    activePage && selectedNodeId ? activePage.nodes[selectedNodeId] ?? null : null
  const activeScreen =
    selectedScreen && doc ? doc.screens[selectedScreen] ?? null : null

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Map className="h-5 w-5" />
            Atlas
          </h1>
          <p className="text-sm text-muted-foreground">
            Auto-doc map upserts by page/node (structure union; last sample for values). Session log
            stays separate. Network holds the hop spine.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={tab === 'doc' ? 'default' : 'outline'}
            onClick={() => {
              setTab('doc')
              void loadDoc().catch(() => undefined)
            }}
          >
            Doc map
          </Button>
          <Button
            size="sm"
            variant={tab === 'session' ? 'default' : 'outline'}
            onClick={() => {
              setTab('session')
              void refresh()
            }}
          >
            Session log
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {tab === 'doc' ? (
            <Button variant="outline" size="sm" onClick={() => void clearDoc()}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Clear doc
            </Button>
          ) : (
            <>
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                disabled={sessions.length === 0}
              >
                {sessions.length === 0 && <option value="">No sessions</option>}
                {sessions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void clearSession()}
                disabled={!sessionId}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Clear session
              </Button>
            </>
          )}
        </div>
      </div>

      {tab === 'doc' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pages & screens</CardTitle>
              <CardDescription>
                {doc?.updatedAt
                  ? `Updated ${new Date(doc.updatedAt).toLocaleString()}`
                  : 'No doc yet — capture with MOCKIFYER_ATLAS'}
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[32rem] space-y-3 overflow-auto">
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                  CMS / surfaces
                </div>
                {pages.length === 0 && (
                  <p className="text-sm text-muted-foreground">No pages documented yet.</p>
                )}
                {pages.map((p) => (
                  <button
                    key={p.pageId}
                    type="button"
                    className={`mb-1 w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted/60 ${
                      selectedPageId === p.pageId ? 'bg-muted' : ''
                    }`}
                    onClick={() => {
                      setSelectedPageId(p.pageId)
                      setSelectedNodeId(null)
                      setSelectedScreen(null)
                    }}
                  >
                    <div className="font-medium">{p.pageSlug || p.pageId}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {Object.keys(p.nodes).length} node(s)
                    </div>
                  </button>
                ))}
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                  Screens (usage)
                </div>
                {screens.length === 0 && (
                  <p className="text-sm text-muted-foreground">No screen usage yet.</p>
                )}
                {screens.map((s) => (
                  <button
                    key={s.screen}
                    type="button"
                    className={`mb-1 w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted/60 ${
                      selectedScreen === s.screen ? 'bg-muted' : ''
                    }`}
                    onClick={() => {
                      setSelectedScreen(s.screen)
                      setSelectedPageId(null)
                      setSelectedNodeId(null)
                    }}
                  >
                    <div className="font-medium">{s.screen}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {s.components.length} component(s)
                    </div>
                  </button>
                ))}
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                  Prefetches
                </div>
                {docPrefetches.length === 0 && (
                  <p className="text-sm text-muted-foreground">None yet.</p>
                )}
                {docPrefetches.map((p) => (
                  <div key={p.datasourceId} className="mb-1 rounded border px-2 py-1 text-sm">
                    <div className="font-medium">{p.datasourceId}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {[...p.phases, ...p.operations].filter(Boolean).join(' · ') || p.kind || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {activeScreen
                  ? `Screen · ${activeScreen.screen}`
                  : activePage
                    ? `Nodes · ${activePage.pageSlug || activePage.pageId}`
                    : 'Nodes'}
              </CardTitle>
              <CardDescription>
                Upserted — revisiting the same node updates it; new nodes are added.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[32rem] overflow-auto">
              {activeScreen && (
                <div className="space-y-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Components</div>
                    <div>{activeScreen.components.join(', ') || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Datasources</div>
                    <div className="font-mono text-xs">
                      {activeScreen.datasourceIds.join(', ') || '—'}
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Last seen {new Date(activeScreen.lastSeenAt).toLocaleString()}
                  </div>
                </div>
              )}
              {!activeScreen && pageNodes.length === 0 && (
                <p className="text-sm text-muted-foreground">Select a page.</p>
              )}
              {!activeScreen &&
                pageNodes.map((n) => (
                  <DocNodeRow
                    key={n.nodeId}
                    node={n}
                    selected={selectedNodeId === n.nodeId}
                    onSelect={() => setSelectedNodeId(n.nodeId)}
                  />
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Details</CardTitle>
              <CardDescription>
                {activeNode
                  ? `${activeNode.type} · ${activeNode.path}`
                  : 'Select a node for schema / sample'}
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[32rem] space-y-3 overflow-auto text-sm">
              {!activeNode && <p className="text-muted-foreground">Nothing selected.</p>}
              {activeNode && (
                <>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Datasources
                    </div>
                    {activeNode.datasources.length === 0 && (
                      <p className="text-muted-foreground">None.</p>
                    )}
                    {activeNode.datasources.map((ds) => (
                      <div
                        key={`${ds.datasourceId}-${ds.dataRoot ?? ''}`}
                        className="mb-1 rounded border px-2 py-1"
                      >
                        <div className="font-medium">{ds.datasourceId}</div>
                        <div className="text-xs text-muted-foreground">
                          {ds.dataRoot ? `slice ${ds.dataRoot} · ` : ''}
                          {ds.operations.join(', ') || ds.kind || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Props schema (union)
                    </div>
                    <pre className="overflow-auto rounded bg-muted p-2 text-xs">
                      {activeNode.propsSchema !== undefined
                        ? JSON.stringify(activeNode.propsSchema, null, 2)
                        : '(none)'}
                    </pre>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Last sample (one user&apos;s values)
                    </div>
                    <pre className="overflow-auto rounded bg-muted p-2 text-xs">
                      {activeNode.propsSample !== undefined
                        ? JSON.stringify(activeNode.propsSample, null, 2)
                        : '(none)'}
                    </pre>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Last seen {new Date(activeNode.lastSeenAt).toLocaleString()}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'session' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">CMS tree (this session)</CardTitle>
              <CardDescription>
                {tree.length === 0
                  ? 'No presentation events in this session'
                  : `${tree.length} root node(s) — append-only log`}
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[480px] overflow-auto">
              {tree.map((node) => (
                <TreeNodeView
                  key={`${node.nodeId}-${node.eventId}`}
                  node={node}
                  depth={0}
                  selectedId={selected?.nodeId ?? null}
                  onSelect={setSelected}
                />
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Prefetches (session)</CardTitle>
                <CardDescription>{prefetches.length} datasource fetch(es)</CardDescription>
              </CardHeader>
              <CardContent className="max-h-40 space-y-2 overflow-auto text-sm">
                {prefetches.length === 0 && (
                  <p className="text-muted-foreground">No prefetch events in this session.</p>
                )}
                {prefetches.map((p) => (
                  <div key={p.id} className="rounded border px-2 py-1.5">
                    <div className="font-medium">{p.datasourceId}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.phase}
                      {p.operation ? ` · ${p.operation}` : ''} · req {p.requestId.slice(0, 8)}…
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Selected node</CardTitle>
                <CardDescription>
                  {selected ? `${selected.type} · ${selected.path}` : 'Click a node in the tree'}
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[280px] space-y-3 overflow-auto text-sm">
                {!selected && <p className="text-muted-foreground">Nothing selected.</p>}
                {selected && (
                  <>
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                        Datasources used
                      </div>
                      {selected.datasources.length === 0 && (
                        <p className="text-muted-foreground">None (CMS-only or no cache reads).</p>
                      )}
                      {selected.datasources.map((ds, i) => (
                        <div key={`${ds.datasourceId}-${i}`} className="mb-1 rounded border px-2 py-1">
                          <div className="font-medium">{ds.datasourceId}</div>
                          <div className="text-xs text-muted-foreground">
                            {ds.dataRoot ? `slice ${ds.dataRoot} · ` : ''}
                            req {ds.requestId}
                            {ds.operation ? ` · ${ds.operation}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                        Props shown
                      </div>
                      <pre className="overflow-auto rounded bg-muted p-2 text-xs">
                        {selected.shown !== undefined
                          ? JSON.stringify(selected.shown, null, 2)
                          : '(not captured)'}
                      </pre>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
