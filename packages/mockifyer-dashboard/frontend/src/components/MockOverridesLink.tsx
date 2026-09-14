import { Link } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { overridesPath } from '@/lib/dashboard-urls'
import { formatOverrideCountLabel } from '@/lib/mock-overrides'
import { cn } from '@/lib/utils'

interface MockOverridesLinkProps {
  filename: string
  count: number
  scenario?: string
  /** When true, still render a link so the mock editor can send users to Overrides. */
  showWhenEmpty?: boolean
  className?: string
}

/**
 * Count + navigation to the Overrides page for one mock (`/overrides?file=`).
 */
export default function MockOverridesLink({
  filename,
  count,
  scenario,
  showWhenEmpty = false,
  className,
}: MockOverridesLinkProps) {
  if (count <= 0 && !showWhenEmpty) return null

  const label = count > 0 ? formatOverrideCountLabel(count) : 'Add overrides'

  return (
    <Link
      to={overridesPath(filename, { scenario })}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-100 hover:bg-sky-500/20',
        className
      )}
      title="Open this mock on the Overrides page"
    >
      <SlidersHorizontal className="h-3 w-3 shrink-0" aria-hidden />
      {label}
    </Link>
  )
}
