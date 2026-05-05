import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { getClientLanes, setClientLaneNote, setClientLaneScenario, type ClientLane } from '@/lib/api'

export default function ClientLanes({ availableScenarios }: { availableScenarios: string[] }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [disabledReason, setDisabledReason] = useState<string | null>(null)
  const [lanes, setLanes] = useState<ClientLane[]>([])
  const [discoveredLanes, setDiscoveredLanes] = useState<string[]>([])
  const [globalScenario, setGlobalScenario] = useState<string>('default')
  const [newLaneId, setNewLaneId] = useState('')

  const addLaneSuggestions = useMemo(() => {
    const existing = new Set(lanes.map((l) => l.clientId))
    return (discoveredLanes || [])
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((id) => !existing.has(id))
      .sort((a, b) => a.localeCompare(b))
  }, [discoveredLanes, lanes])

  const scenarioOptions = useMemo(() => {
    const unique = Array.from(new Set(availableScenarios)).filter(Boolean)
    return unique
  }, [availableScenarios])

  async function load() {
    try {
      setLoading(true)
      const data = await getClientLanes()
      setEnabled(data.enabled !== false)
      setDisabledReason((data as any).reason ?? null)
      setLanes(data.lanes || [])
      setDiscoveredLanes((data as any).discoveredLanes || [])
      setGlobalScenario(data.globalScenario || 'default')
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message ?? 'Failed to load client lanes',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAddLane() {
    const id = newLaneId.trim()
    if (!id) return
    if (lanes.some((l) => l.clientId === id)) {
      toast({ title: 'Already exists', description: `Lane "${id}" is already listed.` })
      return
    }
    try {
      // Persist immediately: lanes are keyed by scenario override.
      // Newly created lanes default to the current global scenario.
      await setClientLaneScenario(id, globalScenario)
      setNewLaneId('')
      await load()
      toast({ title: 'Saved', description: `Lane "${id}" created.` })
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message ?? 'Failed to create lane',
        variant: 'destructive',
      })
    }
  }

  async function handleScenarioChange(clientId: string, value: string) {
    try {
      await setClientLaneScenario(clientId, value)
      await load()
      toast({ title: 'Saved', description: `Lane "${clientId}" updated.` })
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message ?? 'Failed to update lane scenario',
        variant: 'destructive',
      })
    }
  }

  async function handleNoteChange(clientId: string, value: string) {
    try {
      await setClientLaneNote(clientId, value.trim() ? value : null)
      await load()
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e?.message ?? 'Failed to update lane note',
        variant: 'destructive',
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client lanes</CardTitle>
        <CardDescription>
          Use this to <strong>separate mocks by build</strong>. Each app build sends a{' '}
          <span className="font-mono">clientId</span> (lane id) to the dashboard (for example: market + version). If you
          set an override here, that lane will read/write mocks under the selected scenario <em>without affecting other
          builds</em>. The lane id must match what the app uses when initializing Mockifyer (typically via{' '}
          <span className="font-mono">MOCKIFYER_CLIENT_ID</span> or <span className="font-mono">MockifyerConfig.clientId</span>).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-6 text-muted-foreground">Loading client lanes…</div>
        ) : !enabled ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">Unavailable</div>
            <div>
              {disabledReason ??
                "Client lanes require running the dashboard with provider 'redis' (shared store)."}
            </div>
          </div>
        ) : lanes.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No lanes configured yet. Add one below (the lane id must match what your app uses as{' '}
            <span className="font-mono">clientId</span>, typically via <span className="font-mono">MOCKIFYER_CLIENT_ID</span>).
          </div>
        ) : (
          <div className="space-y-3">
            {lanes.map((lane) => (
              <div key={lane.clientId} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-sm break-all">{lane.clientId}</div>
                  <select
                    className="flex h-9 min-w-[12rem] rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={availableScenarios.includes(lane.scenario) ? lane.scenario : globalScenario}
                    onChange={(e) => handleScenarioChange(lane.clientId, e.target.value)}
                  >
                    {scenarioOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Note (optional)</div>
                  <Input
                    placeholder="e.g. EU retail 1.4.2"
                    defaultValue={lane.note ?? ''}
                    onBlur={(e) => handleNoteChange(lane.clientId, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Add lane id (clientId) — must match app’s Mockifyer clientId…"
            value={newLaneId}
            onChange={(e) => setNewLaneId(e.target.value)}
            className="min-w-[16rem] flex-1 font-mono"
            disabled={!enabled}
            list="mockifyer-client-lanes-datalist"
          />
          {enabled && addLaneSuggestions.length > 0 ? (
            <datalist id="mockifyer-client-lanes-datalist">
              {addLaneSuggestions.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
          ) : null}
          <Button type="button" variant="outline" onClick={handleAddLane} disabled={!enabled || !newLaneId.trim()}>
            Add lane
          </Button>
          <Button type="button" variant="ghost" onClick={load}>
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

