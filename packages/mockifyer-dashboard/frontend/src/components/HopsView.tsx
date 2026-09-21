import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitFork, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CopyPageLinkButton } from '@/components/CopyableText'
import { ServiceChainList } from '@/components/ServiceChainList'
import { useToast } from '@/components/ui/use-toast'
import { DASHBOARD_Q, mockEditorPath } from '@/lib/dashboard-urls'
import { useLocationQuery } from '@/lib/use-location-query'
import {
  countServiceChainHops,
  filterChainsBySearch,
  useMockServiceChains,
} from '@/lib/use-mock-service-chains'

interface HopsViewProps {
  scenario: string
}

export default function HopsView({ scenario }: HopsViewProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { searchParams, patch } = useLocationQuery()
  const searchQuery = searchParams.get(DASHBOARD_Q.q) ?? ''
  const focusedHop = searchParams.get(DASHBOARD_Q.hop)
  const [searchDraft, setSearchDraft] = useState(searchQuery)
  const { mocks, chains, loading, error, reload, hasOrphanParentIds } = useMockServiceChains(scenario)

  useEffect(() => {
    setSearchDraft(searchQuery)
  }, [searchQuery])

  const visibleChains = useMemo(
    () => filterChainsBySearch(chains, mocks, searchQuery),
    [chains, mocks, searchQuery]
  )
  const hopCount = countServiceChainHops(visibleChains)

  function commitSearch(nextQuery: string) {
    setSearchDraft(nextQuery)
    patch({ [DASHBOARD_Q.q]: nextQuery.trim() || null })
  }

  useEffect(() => {
    if (!error) return
    toast({
      title: 'Error',
      description: error,
      variant: 'destructive',
    })
  }, [error, toast])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <GitFork className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Hops</h2>
            <p className="text-sm text-muted-foreground">
              Multi-service request chains recorded in this scenario
              {chains.length > 0
                ? ` — ${visibleChains.length} chain${visibleChains.length === 1 ? '' : 's'}, ${hopCount} hop${hopCount === 1 ? '' : 's'}.`
                : '.'}
            </p>
          </div>
        </div>
        <CopyPageLinkButton />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form
          className="min-w-[12rem] flex-1"
          onSubmit={(event) => {
            event.preventDefault()
            commitSearch(searchDraft)
          }}
        >
          <Input
            type="search"
            enterKeyHint="search"
            placeholder="Search hops — endpoint, method, filename, or request id"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              commitSearch(searchDraft)
            }}
            className="w-full"
            aria-label="Search hops"
          />
          <button type="submit" className="sr-only">
            Search
          </button>
        </form>
        <Button
          onClick={() => void reload()}
          variant="outline"
          size="icon"
          className="shrink-0"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {error && !loading ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <ServiceChainList
        chains={visibleChains}
        loading={loading}
        searchQuery={searchQuery}
        selectedFilename={focusedHop}
        hasOrphanParentIds={hasOrphanParentIds}
        onSelectHop={(mock) => {
          navigate(
            mockEditorPath(mock.filename, {
              scenario,
              q: searchQuery.trim() || undefined,
            })
          )
        }}
      />
    </div>
  )
}
