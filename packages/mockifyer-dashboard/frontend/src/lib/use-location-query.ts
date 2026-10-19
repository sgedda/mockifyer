import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { patchSearchParams, type QueryUpdates } from '@/lib/dashboard-urls'

/**
 * Read/write the current location query without dropping unrelated keys
 * (scenario, file, filters, …).
 */
export function useLocationQuery() {
  const [searchParams, setSearchParams] = useSearchParams()

  const patch = useCallback(
    (updates: QueryUpdates, options?: { replace?: boolean }) => {
      setSearchParams((prev) => patchSearchParams(prev, updates), {
        replace: options?.replace ?? true,
      })
    },
    [setSearchParams]
  )

  return { searchParams, patch, setSearchParams }
}
