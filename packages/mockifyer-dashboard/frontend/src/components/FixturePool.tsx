import { useCallback, useEffect, useState } from 'react'
import { Layers, RefreshCw } from 'lucide-react'
import { getApiBase } from '@/lib/base-path'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const API_BASE = getApiBase()
const noStore: RequestInit = { cache: 'no-store' }

interface EntityRow {
  id: string
  label: string
  entityType: string
  tags?: string[]
}

interface ResponseRow {
  id: string
  label: string
  tags?: string[]
}

interface FixturePoolProps {
  scenario: string
}

/**
 * Browse the global fixture pool (entities + full response fixtures).
 * Pool items are inert until a future activation path (e.g. refs in mock bodies); endpoint slots are deferred.
 */
export default function FixturePool({ scenario }: FixturePoolProps) {
  const { toast } = useToast()
  const [entities, setEntities] = useState<EntityRow[]>([])
  const [responses, setResponses] = useState<ResponseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<unknown>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [entRes, respRes] = await Promise.all([
        fetch(`${API_BASE}/fixture-pool/entities`, noStore),
        fetch(`${API_BASE}/fixture-pool/responses`, noStore),
      ])
      if (!entRes.ok) throw new Error('Failed to load entities')
      if (!respRes.ok) throw new Error('Failed to load responses')
      const entJson = (await entRes.json()) as { entities: EntityRow[] }
      const respJson = (await respRes.json()) as { responses: ResponseRow[] }
      setEntities(entJson.entities ?? [])
      setResponses(respJson.responses ?? [])
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load fixture pool',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  async function openEntity(id: string) {
    const res = await fetch(`${API_BASE}/fixture-pool/entities/${encodeURIComponent(id)}`, noStore)
    if (!res.ok) {
      toast({ title: 'Error', description: 'Failed to load entity', variant: 'destructive' })
      return
    }
    setSelected(await res.json())
  }

  async function openResponse(id: string) {
    const res = await fetch(`${API_BASE}/fixture-pool/responses/${encodeURIComponent(id)}`, noStore)
    if (!res.ok) {
      toast({ title: 'Error', description: 'Failed to load response fixture', variant: 'destructive' })
      return
    }
    setSelected(await res.json())
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Layers className="h-6 w-6" />
            Fixture pool
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared catalog of entities and full response fixtures (scenario: {scenario}). Extract or
            promote via API/MCP. Pool items do not change runtime matching by themselves — scenarios
            still serve normal mock files. Endpoint slots are deferred.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="entities">
        <TabsList>
          <TabsTrigger value="entities">Entities ({entities.length})</TabsTrigger>
          <TabsTrigger value="responses">Responses ({responses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="entities" className="space-y-3">
          {entities.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">No entities yet</CardTitle>
                <CardDescription>
                  Use MCP <code>mockifyer_extract_entity</code> or{' '}
                  <code>POST /api/fixture-pool/entities/extract</code> with a{' '}
                  <code>jsonPath</code> like <code>trips.0</code>.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Id</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Label</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map((e) => (
                    <tr
                      key={e.id}
                      className="cursor-pointer border-t hover:bg-muted/40"
                      onClick={() => void openEntity(e.id)}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{e.id}</td>
                      <td className="px-3 py-2">{e.entityType}</td>
                      <td className="px-3 py-2">{e.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="responses">
          {responses.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">No response fixtures</CardTitle>
                <CardDescription>
                  Promote a full recording with <code>mockifyer_promote_response</code> or{' '}
                  <code>POST /api/fixture-pool/responses/promote</code>.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Id</th>
                    <th className="px-3 py-2 font-medium">Label</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r) => (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-t hover:bg-muted/40"
                      onClick={() => void openResponse(r.id)}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                      <td className="px-3 py-2">{r.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selected ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Detail</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Close
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[420px] overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(selected, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
