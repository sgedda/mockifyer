import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getApiBase } from '@/lib/base-path'
import {
  DASHBOARD_API_CATALOG,
  buildPostExampleCurl,
  type DashboardApiEndpoint,
  type DashboardHttpMethod,
} from '@/lib/dashboard-api-catalog'
import { httpMethodTextClass } from '@/lib/http-method-style'

const METHOD_FILTERS: Array<DashboardHttpMethod | 'ALL'> = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE']

function dashboardOrigin(): string {
  if (typeof window === 'undefined') return 'http://localhost:3002'
  return window.location.origin
}

interface ExampleUsageProps {
  curl: string
}

function ExampleUsage({ curl }: ExampleUsageProps) {
  const [copied, setCopied] = useState(false)

  async function copyExample() {
    try {
      await navigator.clipboard.writeText(curl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-foreground">Example usage</div>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => void copyExample()}>
          {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-[11px] leading-relaxed">
        {curl}
      </pre>
    </div>
  )
}

interface EndpointRowProps {
  endpoint: DashboardApiEndpoint
  origin: string
  apiBase: string
}

function EndpointRow({ endpoint, origin, apiBase }: EndpointRowProps) {
  const curl = buildPostExampleCurl(origin, apiBase, endpoint)
  return (
    <li className="rounded-md border border-border/60 bg-muted/20 px-3 py-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={`font-mono text-xs font-semibold ${httpMethodTextClass(endpoint.method)}`}>
          {endpoint.method}
        </span>
        <code className="min-w-0 break-all font-mono text-sm text-foreground">
          {apiBase}
          {endpoint.path}
        </code>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{endpoint.summary}</p>
      {curl ? <ExampleUsage curl={curl} /> : null}
    </li>
  )
}

export default function ApiReference() {
  const apiBase = getApiBase()
  const origin = dashboardOrigin()
  const [query, setQuery] = useState('')
  const [method, setMethod] = useState<DashboardHttpMethod | 'ALL'>('ALL')

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return DASHBOARD_API_CATALOG.map((group) => ({
      ...group,
      endpoints: group.endpoints.filter((endpoint) => {
        if (method !== 'ALL' && endpoint.method !== method) return false
        if (!needle) return true
        const haystack = `${endpoint.method} ${endpoint.path} ${endpoint.summary}`.toLowerCase()
        return haystack.includes(needle)
      }),
    })).filter((group) => group.endpoints.length > 0)
  }, [method, query])

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">API</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          HTTP routes on this dashboard. POST calls include a curl example against{' '}
          <span className="font-mono text-foreground">
            {origin}
            {apiBase}
          </span>
          .
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by path or description"
          className="h-8 max-w-sm text-sm"
          aria-label="Filter API routes"
        />
        {METHOD_FILTERS.map((filter) => (
          <Button
            key={filter}
            type="button"
            size="sm"
            variant={method === filter ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => setMethod(filter)}
          >
            {filter === 'ALL' ? 'All' : filter}
          </Button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No routes match that filter.</p>
      ) : (
        groups.map((group) => (
          <Card key={group.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-foreground">{group.title}</div>
                <Badge variant="secondary" className="text-[10px]">
                  {group.endpoints.length}
                </Badge>
              </div>
              <ul className="space-y-2">
                {group.endpoints.map((endpoint) => (
                  <EndpointRow
                    key={`${endpoint.method} ${endpoint.path}`}
                    endpoint={endpoint}
                    origin={origin}
                    apiBase={apiBase}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
