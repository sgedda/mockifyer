/* eslint-disable react-refresh/only-export-components -- context provider + hook */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface OverrideArrayCollapseContextValue {
  isArrayCollapsed: (collapseKey: string) => boolean
  toggleArray: (collapseKey: string) => void
  isItemCollapsed: (arrayItemPath: string) => boolean
  toggleItem: (arrayItemPath: string) => void
  isRelatedOpen: (collapseKey: string) => boolean
  setRelatedOpen: (collapseKey: string, open: boolean) => void
}

const OverrideArrayCollapseContext = createContext<OverrideArrayCollapseContextValue | null>(null)

function toggleInSet(current: Set<string>, key: string): Set<string> {
  const next = new Set(current)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

/**
 * Shared collapse / related-data expand for override rows on the same array,
 * including field + date editors on the Overrides page.
 */
export function OverrideArrayCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(() => new Set())
  const [relatedOpen, setRelatedOpenState] = useState<Set<string>>(() => new Set())

  const isArrayCollapsed = useCallback((collapseKey: string) => collapsed.has(collapseKey), [collapsed])
  const toggleArray = useCallback((collapseKey: string) => {
    setCollapsed((current) => toggleInSet(current, collapseKey))
  }, [])
  const isItemCollapsed = useCallback(
    (arrayItemPath: string) => collapsedItems.has(arrayItemPath),
    [collapsedItems]
  )
  const toggleItem = useCallback((arrayItemPath: string) => {
    setCollapsedItems((current) => toggleInSet(current, arrayItemPath))
  }, [])
  const isRelatedOpen = useCallback(
    (collapseKey: string) => relatedOpen.has(collapseKey),
    [relatedOpen]
  )
  const setRelatedOpen = useCallback((collapseKey: string, open: boolean) => {
    setRelatedOpenState((current) => {
      const has = current.has(collapseKey)
      if (open === has) return current
      const next = new Set(current)
      if (open) next.add(collapseKey)
      else next.delete(collapseKey)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      isArrayCollapsed,
      toggleArray,
      isItemCollapsed,
      toggleItem,
      isRelatedOpen,
      setRelatedOpen,
    }),
    [isArrayCollapsed, toggleArray, isItemCollapsed, toggleItem, isRelatedOpen, setRelatedOpen]
  )

  return (
    <OverrideArrayCollapseContext.Provider value={value}>{children}</OverrideArrayCollapseContext.Provider>
  )
}

/**
 * Reuses an ancestor provider when present so field + date editors share collapse.
 */
export function OverrideArrayCollapseScope({ children }: { children: ReactNode }) {
  const existing = useContext(OverrideArrayCollapseContext)
  if (existing) return <>{children}</>
  return <OverrideArrayCollapseProvider>{children}</OverrideArrayCollapseProvider>
}

export function useOverrideArrayCollapse(): OverrideArrayCollapseContextValue {
  const ctx = useContext(OverrideArrayCollapseContext)
  if (!ctx) {
    throw new Error('useOverrideArrayCollapse must be used within OverrideArrayCollapseProvider')
  }
  return ctx
}
