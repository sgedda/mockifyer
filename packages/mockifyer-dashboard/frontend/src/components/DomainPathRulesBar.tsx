import { useMemo, useState } from 'react'
import type { MockFile } from '@/types'
import {
  findEffectiveAllowUpstreamOverride,
  findEffectiveDomainPathRule,
  listDomainHosts,
} from '@/lib/domainTreeMatch'
import {
  setDomainPathRule,
  type DomainPathRulesMap,
} from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface DomainPathRulesBarProps {
  scenario: string
  mocks: MockFile[]
  pathRules: DomainPathRulesMap
  onPathRulesChange: (rules: DomainPathRulesMap) => void
}

/**
 * Host-level domain-path controls (Allow upstream / Record response) above the Domains tree.
 */
export function DomainPathRulesBar({
  scenario,
  mocks,
  pathRules,
  onPathRulesChange,
}: DomainPathRulesBarProps) {
  const { toast } = useToast()
  const [busyHost, setBusyHost] = useState<string | null>(null)

  const hosts = useMemo(() => listDomainHosts(mocks, pathRules), [mocks, pathRules])

  if (hosts.length === 0) {
    return null
  }

  async function toggleAllowUpstream(host: string) {
    const exact = pathRules[host]
    const override = findEffectiveAllowUpstreamOverride(host, pathRules)
    const allowed = override?.allowUpstream !== false

    // Only preserve recordResponses/autoMock if they were explicitly set on this exact rule
    const base: { recordResponses?: boolean; autoMock?: boolean } = {}
    if (typeof exact?.recordResponses === 'boolean') {
      base.recordResponses = exact.recordResponses
    }
    if (typeof exact?.autoMock === 'boolean') {
      base.autoMock = exact.autoMock
    }

    let rule: { recordResponses?: boolean; autoMock?: boolean; allowUpstream?: boolean }
    if (!allowed) {
      if (exact?.allowUpstream === false) {
        rule = { ...base }
      } else {
        rule = { ...base, allowUpstream: true }
      }
    } else if (exact?.allowUpstream === true) {
      rule = { ...base }
    } else {
      rule = { ...base, allowUpstream: false }
    }

    try {
      setBusyHost(host)
      const rules = await setDomainPathRule({ scenario, domainPath: host, rule })
      onPathRulesChange(rules)
      const next = findEffectiveAllowUpstreamOverride(host, rules)
      const nowAllowed = next?.allowUpstream !== false
      toast({
        title: nowAllowed ? 'Upstream allowed' : 'Upstream blocked',
        description: nowAllowed
          ? `Cache misses under ${host} may call the real API (if the scenario allows upstream).`
          : `Cache misses under ${host} return 412 instead of calling the real API. Mock hits still replay.`,
      })
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update allow-upstream policy',
        variant: 'destructive',
      })
    } finally {
      setBusyHost(null)
    }
  }

  async function toggleRecordResponse(host: string) {
    const exact = pathRules[host]
    const effectiveOn = findEffectiveDomainPathRule(host, pathRules)?.rule.recordResponses === true
    const exactOn = exact?.recordResponses === true

    let rule: { recordResponses: boolean; autoMock?: boolean; allowUpstream?: boolean } | null
    if (exactOn) {
      if (typeof exact?.allowUpstream === 'boolean') {
        rule = {
          recordResponses: false,
          autoMock: false,
          allowUpstream: exact.allowUpstream,
        }
      } else {
        rule = null
      }
    } else if (effectiveOn) {
      rule = {
        recordResponses: false,
        autoMock: false,
        ...(typeof exact?.allowUpstream === 'boolean'
          ? { allowUpstream: exact.allowUpstream }
          : {}),
      }
    } else {
      rule = {
        recordResponses: true,
        autoMock: true,
        ...(typeof exact?.allowUpstream === 'boolean'
          ? { allowUpstream: exact.allowUpstream }
          : {}),
      }
    }

    try {
      setBusyHost(host)
      const rules = await setDomainPathRule({ scenario, domainPath: host, rule })
      onPathRulesChange(rules)
      const enabling = rule?.recordResponses === true
      toast({
        title: enabling ? 'Record response enabled' : 'Record response disabled',
        description: enabling
          ? `New requests under ${host} will save full responses and replay automatically.`
          : `Record-response policy updated for ${host}.`,
      })
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update record response policy',
        variant: 'destructive',
      })
    } finally {
      setBusyHost(null)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <div className="text-sm font-medium text-foreground">Domain policies</div>
          <p className="text-xs text-muted-foreground">
            Set Allow upstream / Record response for an entire host. Path folders in the tree can
            override a host rule.
          </p>
        </div>
        <ul className="space-y-2">
          {hosts.map((host) => {
            const override = findEffectiveAllowUpstreamOverride(host, pathRules)
            const upstreamAllowed = override?.allowUpstream !== false
            const recordOn =
              findEffectiveDomainPathRule(host, pathRules)?.rule.recordResponses === true
            const busy = busyHost === host
            return (
              <li
                key={host}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-sm" title={host}>
                  {host}
                </span>
                <Button
                  type="button"
                  variant={recordOn ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  disabled={busyHost !== null}
                  title={
                    recordOn
                      ? 'New requests under this host save responses and replay. Click to disable.'
                      : 'Save full responses and replay for new requests under this host'
                  }
                  onClick={() => void toggleRecordResponse(host)}
                >
                  {busy ? '…' : 'Record response'}
                </Button>
                <Button
                  type="button"
                  variant={upstreamAllowed ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  disabled={busyHost !== null}
                  title={
                    upstreamAllowed
                      ? 'Cache misses may call the real API. Click to block this host.'
                      : 'Upstream blocked for this host. Click to allow again.'
                  }
                  onClick={() => void toggleAllowUpstream(host)}
                >
                  {busy ? '…' : 'Allow upstream'}
                </Button>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
