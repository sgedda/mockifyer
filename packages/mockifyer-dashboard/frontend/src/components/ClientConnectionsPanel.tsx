import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getClientLanes, type ClientConnectionRow, type ClientConnectionStatus } from '@/lib/api'
import { ChevronDown, ChevronRight, Radio, Settings2 } from 'lucide-react'

const POLL_MS = 5000

function statusLabel(status: ClientConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected'
    case 'mapped_idle':
      return 'Idle'
    case 'unmapped':
      return 'No scenario'
  }
}

function statusVariant(status: ClientConnectionStatus): 'default' | 'secondary' | 'destructive' {
  switch (status) {
    case 'connected':
      return 'default'
    case 'mapped_idle':
      return 'secondary'
    case 'unmapped':
      return 'destructive'
  }
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return '—'
  }
}

function ConnectionRow({ row }: { row: ClientConnectionRow }) {
  const scenarioMismatch =
    row.configuredScenario &&
    row.lastResolvedScenario &&
    row.configuredScenario !== row.lastResolvedScenario

  return (
    <div className="grid grid-cols-[minmax(8rem,1.2fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_minmax(7rem,1fr)_minmax(5rem,0.7fr)] gap-2 py-2 border-b border-border/60 items-start text-xs last:border-0">
      <span className="font-mono break-all text-foreground" title={row.clientId}>
        {row.clientId}
      </span>
      <span className="font-mono break-all">
        {row.configuredScenario ?? (
          <span className="text-destructive font-medium">Not assigned</span>
        )}
      </span>
      <span className="font-mono break-all text-muted-foreground">
        {row.lastResolvedScenario ?? '—'}
        {scenarioMismatch ? (
          <span className="block text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            Differs from configured
          </span>
        ) : null}
      </span>
      <span className="text-muted-foreground whitespace-nowrap">{formatWhen(row.lastSeenAt)}</span>
      <Badge variant={statusVariant(row.status)} className="w-fit shrink-0">
        {statusLabel(row.status)}
      </Badge>
    </div>
  )
}

export default function ClientConnectionsPanel() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [disabledReason, setDisabledReason] = useState<string | null>(null)
  const [globalScenario, setGlobalScenario] = useState<string | null>(null)
  const [connections, setConnections] = useState<ClientConnectionRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await getClientLanes()
      setLoadError(null)
      setEnabled(data.enabled !== false)
      setDisabledReason(data.reason ?? null)
      setGlobalScenario(data.globalScenario)
      setConnections(data.connections ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load client connections')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const unmappedCount = useMemo(
    () => connections.filter((c) => c.status === 'unmapped').length,
    [connections]
  )

  if (!enabled && !loading) {
    return null
  }

  return (
    <div className="border-b border-border bg-muted/20 px-4 py-3 sm:px-6">
      <Card className="border-border/60 shadow-none">
        <CardHeader className="py-3 px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              onClick={() => setCollapsed((c) => !c)}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Radio className="h-4 w-4 text-primary shrink-0" />
                Client connections
                {!loading && connections.length > 0 ? (
                  <Badge variant="outline" className="font-normal">
                    {connections.length}
                  </Badge>
                ) : null}
                {unmappedCount > 0 ? (
                  <Badge variant="destructive" className="font-normal">
                    {unmappedCount} unmapped
                  </Badge>
                ) : null}
              </CardTitle>
            </button>
            <div className="flex items-center gap-2 shrink-0">
              {globalScenario ? (
                <span className="hidden sm:inline text-xs text-muted-foreground">
                  Global scenario: <span className="font-mono">{globalScenario}</span>
                </span>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => navigate('/settings')}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Manage lanes
              </Button>
            </div>
          </div>
          {!collapsed ? (
            <p className="text-xs text-muted-foreground mt-1 pl-6">
              Each app sends a <span className="font-mono">clientId</span> (lane). Assign a scenario per lane in
              Settings — unmapped clients are not connected to mock data.
            </p>
          ) : null}
        </CardHeader>
        {!collapsed ? (
          <CardContent className="px-4 pb-4 pt-0">
            {loadError ? (
              <p className="text-sm text-amber-600 dark:text-amber-400 py-2">
                {loadError}. Showing last known data — will retry automatically.
              </p>
            ) : null}
            {loading ? (
              <p className="text-sm text-muted-foreground py-2">Loading client connections…</p>
            ) : disabledReason ? (
              <p className="text-sm text-muted-foreground py-2">{disabledReason}</p>
            ) : connections.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No client ids seen yet. Traffic must include{' '}
                <span className="font-mono">MOCKIFYER_CLIENT_ID</span> or{' '}
                <span className="font-mono">X-Mockifyer-Client-Id</span> on proxy requests.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <div className="min-w-[40rem]">
                  <div className="grid grid-cols-[minmax(8rem,1.2fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_minmax(7rem,1fr)_minmax(5rem,0.7fr)] gap-2 pb-2 text-xs font-medium text-muted-foreground border-b border-border">
                    <span>Client ID</span>
                    <span>Scenario (lane)</span>
                    <span>Last resolved</span>
                    <span>Last seen</span>
                    <span>Status</span>
                  </div>
                  {connections.map((row) => (
                    <ConnectionRow key={row.clientId} row={row} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        ) : null}
      </Card>
    </div>
  )
}
