import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { CopyPageLinkButton } from '@/components/CopyableText'
import MockEditor from '@/components/MockEditor'
import { getMock, getMocks } from '@/lib/api'
import { DASHBOARD_Q, mockEditorPath, mocksListPath, pickPreservedQuery } from '@/lib/dashboard-urls'
import type { MockData, MockFile } from '@/types'

interface MockEditorPageProps {
  scenario: string
  scenarioLocked: boolean
  /** False while Dashboard is still applying `?scenario=` from a pasted URL. */
  scenarioReady: boolean
}

/**
 * Full-page mock editor. Identity is `?file=` so the URL is copyable and
 * reloads without nested path segments (portable Vite `./` assets).
 */
export default function MockEditorPage({
  scenario,
  scenarioLocked,
  scenarioReady,
}: MockEditorPageProps) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const filename = searchParams.get(DASHBOARD_Q.file)
  const scenarioQ = searchParams.get(DASHBOARD_Q.scenario) ?? undefined
  const listQuery = searchParams.get(DASHBOARD_Q.q) ?? undefined
  const [mock, setMock] = useState<MockData | null>(null)
  const [allMocks, setAllMocks] = useState<MockFile[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const listExtras = { scenario: scenarioQ, q: listQuery }

  useEffect(() => {
    if (!filename) {
      navigate(mocksListPath(listExtras), { replace: true })
    }
    // listExtras is derived from primitive query values above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename, navigate, scenarioQ, listQuery])

  useEffect(() => {
    if (!filename) return
    if (!scenarioReady) {
      setLoading(true)
      setNotFound(false)
      setMock(null)
      return
    }
    let cancelled = false

    const file = filename
    async function load() {
      try {
        setLoading(true)
        setNotFound(false)
        const [mockData, list] = await Promise.all([
          getMock(file, scenario),
          getMocks(scenario).catch(() => ({ files: [] as MockFile[] })),
        ])
        if (cancelled) return
        setMock(mockData)
        setAllMocks(list.files ?? [])
      } catch {
        if (cancelled) return
        setMock(null)
        setNotFound(true)
        toast({
          title: 'Error',
          description: `Failed to load mock "${filename}"`,
          variant: 'destructive',
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [filename, scenario, scenarioReady, toast])

  function goToList() {
    navigate(mocksListPath(listExtras))
  }

  async function handleSaved() {
    if (!filename) return
    try {
      const mockData = await getMock(filename, scenario)
      setMock(mockData)
      const list = await getMocks(scenario)
      setAllMocks(list.files ?? [])
    } catch {
      // Keep the editor open with the last loaded mock if refresh fails.
    }
  }

  function handleSelectRelated(file: MockFile) {
    navigate(
      mockEditorPath(file.filename, pickPreservedQuery(searchParams, [DASHBOARD_Q.scenario, DASHBOARD_Q.q]))
    )
  }

  if (!filename) {
    return null
  }

  if (!scenarioReady || loading || !mock) {
    if (notFound && scenarioReady && !loading) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Mock <span className="font-mono">{filename}</span> was not found in scenario{' '}
            <span className="font-mono">{scenario}</span>.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={goToList}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to mocks
          </Button>
        </div>
      )
    }
    return <div className="text-muted-foreground">Loading mock…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={goToList}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to mocks
        </Button>
        <CopyPageLinkButton />
      </div>
      <MockEditor
        variant="page"
        mock={mock}
        allMocks={allMocks}
        onSelectRelatedMock={handleSelectRelated}
        scenario={scenario}
        scenarioLocked={scenarioLocked}
        onClose={goToList}
        onSave={() => void handleSaved()}
        onListRefresh={async () => {
          const list = await getMocks(scenario)
          setAllMocks(list.files ?? [])
        }}
      />
    </div>
  )
}
