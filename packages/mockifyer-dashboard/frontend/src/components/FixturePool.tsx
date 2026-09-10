import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Layers, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  extractFixturePoolEntity,
  getFixturePoolEntities,
  getFixturePoolEntity,
  getFixturePoolResponse,
  getFixturePoolResponses,
  getMocks,
  promoteFixturePoolResponse,
  type FixturePoolEntityRow,
  type FixturePoolResponseRow,
} from '@/lib/api'

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

interface FixturePoolProps {
  scenario: string
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}

/**
 * Browse the global fixture pool (entities + full response fixtures) and extract/promote
 * from the active scenario's recordings.
 */
export default function FixturePool({ scenario }: FixturePoolProps) {
  const { toast } = useToast()
  const [entities, setEntities] = useState<FixturePoolEntityRow[]>([])
  const [responses, setResponses] = useState<FixturePoolResponseRow[]>([])
  const [warning, setWarning] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<unknown>(null)
  const [mockFilenames, setMockFilenames] = useState<string[]>([])

  const [extractFilename, setExtractFilename] = useState('')
  const [jsonPath, setJsonPath] = useState('trips.0')
  const [entityType, setEntityType] = useState('trip')
  const [entityId, setEntityId] = useState('')
  const [extractAll, setExtractAll] = useState(false)
  const [extracting, setExtracting] = useState(false)

  const [promoteFilename, setPromoteFilename] = useState('')
  const [promoteId, setPromoteId] = useState('')
  const [promoteLabel, setPromoteLabel] = useState('')
  const [promoting, setPromoting] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [entJson, respJson] = await Promise.all([
        getFixturePoolEntities(),
        getFixturePoolResponses(),
      ])
      setEntities(entJson.entities ?? [])
      setResponses(respJson.responses ?? [])
      setWarning(entJson.warning || respJson.warning || null)
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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { files } = await getMocks(scenario)
        if (cancelled) return
        const names = (files ?? []).map((f) => f.filename).filter(Boolean)
        setMockFilenames(names)
        setExtractFilename((current) =>
          current && names.includes(current) ? current : names[0] ?? ''
        )
        setPromoteFilename((current) =>
          current && names.includes(current) ? current : names[0] ?? ''
        )
      } catch {
        if (!cancelled) {
          setMockFilenames([])
          setExtractFilename('')
          setPromoteFilename('')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [scenario])

  async function openEntity(id: string) {
    try {
      setSelected(await getFixturePoolEntity(id))
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load entity',
        variant: 'destructive',
      })
    }
  }

  async function openResponse(id: string) {
    try {
      setSelected(await getFixturePoolResponse(id))
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load response fixture',
        variant: 'destructive',
      })
    }
  }

  async function handleExtract() {
    if (!extractFilename || !jsonPath.trim() || !entityType.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Choose a mock file and provide jsonPath and entityType.',
        variant: 'destructive',
      })
      return
    }
    try {
      setExtracting(true)
      const result = await extractFixturePoolEntity({
        scenario,
        filename: extractFilename,
        jsonPath: jsonPath.trim(),
        entityType: entityType.trim(),
        ...(entityId.trim() ? { id: entityId.trim() } : {}),
        extractAllArrayItems: extractAll,
      })
      const count = result.entities?.length ?? 0
      toast({
        title: 'Extracted',
        description: count === 1 ? `Saved ${result.entities[0]?.id}` : `Saved ${count} entities`,
      })
      await load()
    } catch (error) {
      toast({
        title: 'Extract failed',
        description: error instanceof Error ? error.message : 'Failed to extract entity',
        variant: 'destructive',
      })
    } finally {
      setExtracting(false)
    }
  }

  async function handlePromote() {
    if (!promoteFilename) {
      toast({
        title: 'Missing file',
        description: 'Choose a mock file to promote.',
        variant: 'destructive',
      })
      return
    }
    try {
      setPromoting(true)
      const result = await promoteFixturePoolResponse({
        scenario,
        filename: promoteFilename,
        ...(promoteId.trim() ? { id: promoteId.trim() } : {}),
        ...(promoteLabel.trim() ? { label: promoteLabel.trim() } : {}),
      })
      toast({
        title: 'Promoted',
        description: `Saved ${result.response?.id ?? (promoteId || promoteFilename)}`,
      })
      await load()
    } catch (error) {
      toast({
        title: 'Promote failed',
        description: error instanceof Error ? error.message : 'Failed to promote response',
        variant: 'destructive',
      })
    } finally {
      setPromoting(false)
    }
  }

  const fileSelect = (value: string, onChange: (next: string) => void) => (
    <select className={selectClassName} value={value} onChange={(e) => onChange(e.target.value)}>
      {mockFilenames.length === 0 ? (
        <option value="">No mock files in {scenario}</option>
      ) : (
        mockFilenames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))
      )}
    </select>
  )

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Layers className="h-6 w-6" />
            Fixture pool
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared catalog of entities and full response fixtures (scenario: {scenario}). Extract an
            object from a recording with a jsonPath such as <code>trips.0</code>, or promote a full
            response. Pool items do not change runtime matching by themselves — scenarios still
            serve normal mock files (plus optional <code>$pool</code> refs).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {warning ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {warning}
        </p>
      ) : null}

      <Tabs defaultValue="entities">
        <TabsList>
          <TabsTrigger value="entities">Entities ({entities.length})</TabsTrigger>
          <TabsTrigger value="responses">Responses ({responses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="entities" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Extract entity</CardTitle>
              <CardDescription>
                Pull a value from a mock&apos;s <code>response.data</code> into the pool. Use{' '}
                <code>trips.0</code> for one item, or enable extract-all with jsonPath{' '}
                <code>trips</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Field label="Mock file">{fileSelect(extractFilename, setExtractFilename)}</Field>
              <Field label="jsonPath">
                <Input
                  value={jsonPath}
                  onChange={(e) => setJsonPath(e.target.value)}
                  placeholder="trips.0"
                />
              </Field>
              <Field label="Entity type">
                <Input
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  placeholder="trip"
                />
              </Field>
              <Field label="Id (optional)">
                <Input
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  placeholder="trip-rome"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={extractAll}
                  onChange={(e) => setExtractAll(e.target.checked)}
                />
                Extract every array item at jsonPath
              </label>
              <div className="sm:col-span-2">
                <Button onClick={() => void handleExtract()} disabled={extracting || !extractFilename}>
                  {extracting ? 'Extracting…' : 'Extract'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {entities.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">No entities yet</CardTitle>
                <CardDescription>
                  Extract from a recording above, or use MCP <code>mockifyer_extract_entity</code>.
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

        <TabsContent value="responses" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Promote response</CardTitle>
              <CardDescription>
                Copy a full recording into <code>pool/responses</code> so scenarios can reference it
                with <code>$pool</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Field label="Mock file">{fileSelect(promoteFilename, setPromoteFilename)}</Field>
              <Field label="Id (optional)">
                <Input
                  value={promoteId}
                  onChange={(e) => setPromoteId(e.target.value)}
                  placeholder="trips-list-alice"
                />
              </Field>
              <Field label="Label (optional)">
                <Input
                  value={promoteLabel}
                  onChange={(e) => setPromoteLabel(e.target.value)}
                  placeholder="Alice trips list"
                />
              </Field>
              <div className="flex items-end">
                <Button onClick={() => void handlePromote()} disabled={promoting || !promoteFilename}>
                  {promoting ? 'Promoting…' : 'Promote'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {responses.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">No response fixtures</CardTitle>
                <CardDescription>
                  Promote a recording above, or use MCP <code>mockifyer_promote_response</code>.
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
