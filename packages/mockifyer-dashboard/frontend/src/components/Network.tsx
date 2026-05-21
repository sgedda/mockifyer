import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import {
  clearNetworkEvents,
  getNetworkEvents,
  updateNetworkLogConfig,
} from '@/lib/api'
import type { NetworkEvent, NetworkEventSource } from '@/types'
import { RefreshCw, Trash2, Radio } from 'lucide-react'

const SOURCE_LABELS: Record<NetworkEventSource, string> = {
  'mock-hit': 'Mock',
  'mock-miss': 'Miss',
  upstream: 'Upstream',
  blocked: 'Blocked',
  error: 'Error',
}

const SOURCE_VARIANT: Record<
  NetworkEventSource,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  'mock-hit': 'secondary',
  'mock-miss': 'outline',
  upstream: 'default',
  blocked: 'destructive',
  error: 'destructive',
}

const POLL_MS = 3000

interface NetworkProps {
  scenario: string
}

export default function Network({ scenario }: NetworkProps) {
  const { toast } = useToast()
  const [events, setEvents] = useState<NetworkEvent[]>([])
  const [ephemeral, setEphemeral] = useState(false)
  const [loading, setLoading] = useState(true)
  const [logEnabled, setLogEnabled] = useState(true)
  const [captureBodies, setCaptureBodies] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState<NetworkEventSource | ''>('')
  const [laneFilter, setLaneFilter] = useState('')
  const sinceRef = useRef<string | undefined>(undefined)
  const [live, setLive] = useState(true)

  const load = useCallback(
    async (opts?: { reset?: boolean }) => {
      try {
        if (opts?.reset) sinceRef.current = undefined
        const since = sinceRef.current
        const data = await getNetworkEvents({
          scenario,
          clientId: laneFilter.trim() || undefined,
          limit: 500,
          since,
        })
        setEphemeral(data.ephemeral)
        setLogEnabled(data.networkLogConfig.enabled)
        setCaptureBodies(data.networkLogConfig.captureBodies)
        if (since && data.events.length > 0) {
          setEvents((prev) => {
            const ids = new Set(prev.map((e) => e.id))
            const merged = [...data.events.filter((e) => !ids.has(e.id)), ...prev]
            return merged.slice(0, 500)
          })
        } else {
          setEvents(data.events)
        }
        const newest = data.events[0]?.timestamp
        if (newest) sinceRef.current = newest
      } catch (error: unknown) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load network events',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    },
    [scenario, laneFilter, toast]
  )

  useEffect(() => {
    setLoading(true)
    void load({ reset: true })
  }, [scenario, laneFilter, load])

  useEffect(() => {
    if (!live) return
    const t = window.setInterval(() => {
      void load()
    }, POLL_MS)
    return () => window.clearInterval(t)
  }, [live, load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events.filter((e) => {
      if (methodFilter && e.method !== methodFilter) return false
      if (sourceFilter && e.source !== sourceFilter) return false
      if (!q) return true
      const hay = `${e.method} ${e.url} ${e.path ?? ''} ${e.host ?? ''} ${e.clientId ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [events, search, methodFilter, sourceFilter])

  const selected = filtered.find((e) => e.id === selectedId) ?? filtered[0] ?? null

  useEffect(() => {
    if (selected && selected.id !== selectedId) {
      setSelectedId(selected.id)
    }
  }, [selected, selectedId])

  async function handleToggleEnabled() {
    try {
      setSavingConfig(true)
      const next = !logEnabled
      await updateNetworkLogConfig(scenario, { enabled: next })
      setLogEnabled(next)
      toast({ title: 'Saved', description: next ? 'Network logging enabled' : 'Network logging disabled' })
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save',
        variant: 'destructive',
      })
    } finally {
      setSavingConfig(false)
    }
  }

  async function handleToggleBodies() {
    try {
      setSavingConfig(true)
      const next = !captureBodies
      await updateNetworkLogConfig(scenario, { captureBodies: next })
      setCaptureBodies(next)
      toast({
        title: 'Saved',
        description: next ? 'Body capture enabled (privacy caution)' : 'Body capture disabled',
      })
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save',
        variant: 'destructive',
      })
    } finally {
      setSavingConfig(false)
    }
  }

  async function handleClear() {
    try {
      await clearNetworkEvents(scenario, laneFilter.trim() || undefined)
      setEvents([])
      sinceRef.current = undefined
      toast({ title: 'Cleared', description: 'Network log cleared for this scope' })
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to clear',
        variant: 'destructive',
      })
    }
  }

  const methods = useMemo(() => {
    const set = new Set(events.map((e) => e.method))
    return [...set].sort()
  }, [events])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                Network
              </CardTitle>
              <CardDescription className="mt-1">
                Live traffic through the dashboard proxy and SDKs. Response bodies are off by default.
                {ephemeral ? ' Ephemeral in-memory buffer (filesystem provider).' : ' Stored in Redis with TTL.'}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={live ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLive((v) => !v)}
              >
                {live ? 'Live' : 'Paused'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void load({ reset: true })}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void handleClear()}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={logEnabled ? 'default' : 'outline'}
            disabled={savingConfig}
            onClick={() => void handleToggleEnabled()}
          >
            Logging {logEnabled ? 'on' : 'off'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={captureBodies ? 'destructive' : 'outline'}
            disabled={savingConfig || !logEnabled}
            onClick={() => void handleToggleBodies()}
          >
            Bodies {captureBodies ? 'on' : 'off'}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Filter URL, path, lane…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md h-9"
        />
        <Input
          placeholder="Client lane (clientId)"
          value={laneFilter}
          onChange={(e) => setLaneFilter(e.target.value)}
          className="max-w-xs h-9 font-mono text-sm"
        />
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
        >
          <option value="">All methods</option>
          {methods.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as NetworkEventSource | '')}
        >
          <option value="">All sources</option>
          {(Object.keys(SOURCE_LABELS) as NetworkEventSource[]).map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[24rem]">
        <Card className="overflow-hidden">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              Requests ({filtered.length}
              {filtered.length !== events.length ? ` / ${events.length}` : ''})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading && events.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No events yet. Send traffic through the dashboard proxy or an SDK with network logging.
              </p>
            ) : (
              <div className="max-h-[32rem] overflow-auto divide-y divide-border">
                {filtered.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors ${
                      selected?.id === ev.id ? 'bg-accent' : ''
                    }`}
                    onClick={() => setSelectedId(ev.id)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold w-12">{ev.method}</span>
                      <Badge variant={SOURCE_VARIANT[ev.source]} className="text-[10px]">
                        {SOURCE_LABELS[ev.source]}
                      </Badge>
                      {ev.status != null && (
                        <span className="text-xs text-muted-foreground">{ev.status}</span>
                      )}
                      {ev.durationMs != null && (
                        <span className="text-xs text-muted-foreground">{ev.durationMs}ms</span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">{ev.transport}</span>
                    </div>
                    <div className="font-mono text-xs truncate text-muted-foreground mt-0.5">
                      {ev.path || ev.url}
                    </div>
                    {ev.clientId && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">lane: {ev.clientId}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3 max-h-[32rem] overflow-auto">
            {!selected ? (
              <p className="text-muted-foreground">Select a request</p>
            ) : (
              <>
                <DetailRow label="Time" value={new Date(selected.timestamp).toLocaleString()} />
                <DetailRow label="URL" value={selected.url} mono />
                <DetailRow label="Method" value={selected.method} />
                <DetailRow label="Source" value={SOURCE_LABELS[selected.source]} />
                <DetailRow label="Transport" value={selected.transport} />
                {selected.status != null && <DetailRow label="Status" value={String(selected.status)} />}
                {selected.durationMs != null && (
                  <DetailRow label="Duration" value={`${selected.durationMs} ms`} />
                )}
                {selected.clientId && <DetailRow label="Lane" value={selected.clientId} mono />}
                {selected.deviceId && <DetailRow label="Device" value={selected.deviceId} mono />}
                {selected.requestHash && (
                  <DetailRow label="Request hash" value={selected.requestHash} mono />
                )}
                {selected.errorMessage && (
                  <DetailRow label="Error" value={selected.errorMessage} />
                )}
                {selected.requestHeaders && Object.keys(selected.requestHeaders).length > 0 && (
                  <HeaderBlock title="Request headers" headers={selected.requestHeaders} />
                )}
                {selected.responseHeaders && Object.keys(selected.responseHeaders).length > 0 && (
                  <HeaderBlock title="Response headers" headers={selected.responseHeaders} />
                )}
                {selected.requestBodyPreview && (
                  <PreviewBlock title="Request body" text={selected.requestBodyPreview} />
                )}
                {selected.responseBodyPreview && (
                  <PreviewBlock title="Response body" text={selected.responseBodyPreview} />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm break-all ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

function HeaderBlock({ title, headers }: { title: string; headers: Record<string, string> }) {
  return (
    <div>
      <div className="text-xs font-medium mb-1">{title}</div>
      <pre className="text-[11px] bg-muted p-2 rounded overflow-auto max-h-40 font-mono">
        {Object.entries(headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')}
      </pre>
    </div>
  )
}

function PreviewBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="text-xs font-medium mb-1">{title}</div>
      <pre className="text-[11px] bg-muted p-2 rounded overflow-auto max-h-48 font-mono whitespace-pre-wrap">
        {text}
      </pre>
    </div>
  )
}
