import { useCallback, useEffect, useMemo, useState } from 'react'
import { getMocks } from '@/lib/api'
import {
  buildMockServiceChainsForDisplay,
  filterMockServiceChainsByFilenames,
  type MockServiceChain,
} from '@/lib/mock-correlation-chains'
import type { MockFile } from '@/types'

export function countServiceChainHops(chains: MockServiceChain[]): number {
  return chains.reduce((sum, chain) => sum + chain.hops.length, 0)
}

export function filterChainsBySearch(
  chains: MockServiceChain[],
  mocks: MockFile[],
  searchQuery: string
): MockServiceChain[] {
  const q = searchQuery.trim().toLowerCase()
  if (!q) return chains
  const filenames = new Set(
    mocks
      .filter((mock) => {
        return (
          mock.filename.toLowerCase().includes(q) ||
          (mock.endpoint ?? '').toLowerCase().includes(q) ||
          (mock.method ?? '').toLowerCase().includes(q) ||
          (mock.graphqlInfo?.operationName ?? '').toLowerCase().includes(q) ||
          (mock.requestId ?? '').toLowerCase().includes(q) ||
          (mock.parentRequestId ?? '').toLowerCase().includes(q)
        )
      })
      .map((mock) => mock.filename)
  )
  return filterMockServiceChainsByFilenames(chains, filenames)
}

export function useMockServiceChains(scenario: string) {
  const [mocks, setMocks] = useState<MockFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getMocks(scenario, { compact: true })
      setMocks(data.files)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hops')
    } finally {
      setLoading(false)
    }
  }, [scenario])

  useEffect(() => {
    void reload()
  }, [reload])

  const chains = useMemo(() => buildMockServiceChainsForDisplay(mocks), [mocks])
  const hasOrphanParentIds = useMemo(
    () => chains.length === 0 && mocks.some((mock) => Boolean(mock.parentRequestId)),
    [chains.length, mocks]
  )

  return { mocks, chains, loading, error, reload, hasOrphanParentIds }
}
