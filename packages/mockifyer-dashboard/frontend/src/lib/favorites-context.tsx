import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { addFavorite, getFavorites, removeFavorite } from '@/lib/api'
import type { FavoriteRequest } from '@/types'

const FAVORITES_ONLY_STORAGE_KEY = 'mockifyer-dashboard-favorites-only'

interface FavoritesContextValue {
  favorites: FavoriteRequest[]
  favoriteIds: Set<string>
  loading: boolean
  favoritesOnly: boolean
  setFavoritesOnly: (next: boolean) => void
  isFavorite: (requestHash?: string | null) => boolean
  toggleFavorite: (filename: string, requestHash?: string | null) => Promise<void>
  unfavorite: (id: string) => Promise<void>
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

function readFavoritesOnlyPreference(): boolean {
  try {
    return globalThis.localStorage?.getItem(FAVORITES_ONLY_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function FavoritesProvider({
  children,
  scenario,
}: {
  children: ReactNode
  scenario: string
}) {
  const [favorites, setFavorites] = useState<FavoriteRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [favoritesOnly, setFavoritesOnlyState] = useState(readFavoritesOnlyPreference)

  const setFavoritesOnly = useCallback((next: boolean) => {
    setFavoritesOnlyState(next)
    try {
      globalThis.localStorage?.setItem(FAVORITES_ONLY_STORAGE_KEY, next ? '1' : '0')
    } catch {
      // ignore quota / private mode
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        setLoading(true)
        const data = await getFavorites()
        if (!cancelled) setFavorites(data.favorites ?? [])
      } catch {
        if (!cancelled) setFavorites([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const favoriteIds = useMemo(() => new Set(favorites.map((entry) => entry.id)), [favorites])

  const isFavorite = useCallback(
    (requestHash?: string | null) => {
      if (!requestHash) return false
      return favoriteIds.has(requestHash)
    },
    [favoriteIds]
  )

  const toggleFavorite = useCallback(
    async (filename: string, requestHash?: string | null) => {
      if (requestHash && favoriteIds.has(requestHash)) {
        const data = await removeFavorite(requestHash)
        setFavorites(data.favorites ?? [])
        return
      }
      const data = await addFavorite({ filename, scenario })
      setFavorites(data.favorites ?? [])
    },
    [favoriteIds, scenario]
  )

  const unfavorite = useCallback(async (id: string) => {
    const data = await removeFavorite(id)
    setFavorites(data.favorites ?? [])
  }, [])

  const value = useMemo(
    () => ({
      favorites,
      favoriteIds,
      loading,
      favoritesOnly,
      setFavoritesOnly,
      isFavorite,
      toggleFavorite,
      unfavorite,
    }),
    [
      favorites,
      favoriteIds,
      loading,
      favoritesOnly,
      setFavoritesOnly,
      isFavorite,
      toggleFavorite,
      unfavorite,
    ]
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useMockFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext)
  if (!ctx) {
    throw new Error('useMockFavorites must be used within FavoritesProvider')
  }
  return ctx
}

export function favoriteListLabel(favorite: FavoriteRequest): string {
  if (favorite.operationName) {
    return `${favorite.method} ${favorite.operationName}`
  }
  if (!favorite.endpoint) return favorite.method
  try {
    const url = new URL(favorite.endpoint)
    const last = url.pathname.split('/').filter(Boolean).pop()
    return `${favorite.method} ${last || url.pathname || favorite.endpoint}`
  } catch {
    return `${favorite.method} ${favorite.endpoint}`
  }
}
