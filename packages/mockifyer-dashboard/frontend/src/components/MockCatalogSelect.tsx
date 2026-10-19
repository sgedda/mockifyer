import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MockCatalogSelectOption {
  filename: string
  label: string
}

interface MockCatalogSelectProps {
  options: MockCatalogSelectOption[]
  value: string
  onChange: (filename: string) => void
  loading?: boolean
  disabled?: boolean
  placeholder?: string
}

/**
 * Searchable mock picker. Renders human labels only — Redis catalog hashes stay
 * on the option value and are never shown in the list.
 */
export default function MockCatalogSelect({
  options,
  value,
  onChange,
  loading = false,
  disabled = false,
  placeholder = 'Select mock…',
}: MockCatalogSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const selected = options.find((option) => option.filename === value)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => option.label.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    function onDocMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  useEffect(() => {
    if (open) {
      searchRef.current?.focus()
    } else {
      setQuery('')
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled || loading}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0 truncate">
          {loading ? 'Loading mocks…' : selected?.label || placeholder}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-70" aria-hidden />
      </button>
      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-input bg-background shadow-md">
          <input
            ref={searchRef}
            className="h-9 w-full border-b border-input bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search method, path, GraphQL…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Filter mocks"
          />
          <ul className="max-h-64 overflow-auto py-1" role="listbox">
            {visible.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No matching mocks</li>
            ) : (
              visible.map((option) => {
                const active = option.filename === value
                return (
                  <li key={option.filename} role="option" aria-selected={active}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full px-3 py-1.5 text-left text-sm hover:bg-muted/70',
                        active && 'bg-primary/10'
                      )}
                      onClick={() => {
                        onChange(option.filename)
                        setOpen(false)
                      }}
                    >
                      <span className="min-w-0 truncate">{option.label}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
