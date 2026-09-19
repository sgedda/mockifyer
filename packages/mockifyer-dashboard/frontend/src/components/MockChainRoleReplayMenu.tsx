import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { bulkSetReplayMode } from '@/lib/api'
import {
  collectMockChainRoleFilenames,
  planChainRoleReplay,
  type ChainRoleReplayTarget,
  type MockServiceChain,
} from '@/lib/mock-correlation-chains'

function describeBulkResult(result: {
  updatedStored: number
  updatedLive: number
  queuedRefreshNext: number
}): string {
  const parts: string[] = []
  if (result.updatedStored > 0) {
    parts.push(`${result.updatedStored} mock${result.updatedStored === 1 ? '' : 's'} on saved response`)
  }
  if (result.queuedRefreshNext > 0) {
    parts.push(
      `${result.queuedRefreshNext} will capture on next request, then replay`
    )
  }
  if (result.updatedLive > 0) {
    parts.push(`${result.updatedLive} parent hop${result.updatedLive === 1 ? '' : 's'} set to Live`)
  }
  if (parts.length === 0) {
    return 'No hops updated'
  }
  return parts.join('. ')
}

function bulkResultTitle(
  target: ChainRoleReplayTarget,
  result: { updatedStored: number; queuedRefreshNext: number }
): string {
  const capturingOnly = result.queuedRefreshNext > 0 && result.updatedStored === 0
  if (target === 'bff') {
    return capturingOnly ? 'BFF hops will capture on next request' : 'BFF hops using saved mocks'
  }
  return capturingOnly ? 'Source hops will capture on next request' : 'Source hops using saved mocks'
}

export function MockChainRoleReplayMenu({
  scenario,
  chains,
  onDone,
  disabled = false,
  compact = false,
}: {
  scenario: string
  chains: MockServiceChain[]
  onDone: () => void
  disabled?: boolean
  compact?: boolean
}) {
  const { toast } = useToast()
  const [busy, setBusy] = useState<ChainRoleReplayTarget | null>(null)
  const roles = useMemo(() => collectMockChainRoleFilenames(chains), [chains])
  const canMockSources = roles.sources.length > 0
  const canMockBff = roles.bff.length > 0

  if (!canMockSources && !canMockBff) return null

  async function applyTarget(target: ChainRoleReplayTarget) {
    const plan = planChainRoleReplay(chains, target)
    if (plan.stored.length === 0 && plan.passthrough.length === 0) return
    try {
      setBusy(target)
      const result = await bulkSetReplayMode({
        scenario,
        stored: plan.stored,
        passthrough: plan.passthrough,
      })
      toast({
        title: bulkResultTitle(target, result),
        description: describeBulkResult(result),
      })
      onDone()
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update hop replay mode',
        variant: 'destructive',
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={compact ? 'h-7 shrink-0 gap-1 text-xs' : 'h-9 shrink-0 gap-1.5'}
          disabled={disabled || busy !== null}
          title="Replay saved responses for source hops or GraphQL BFF hops"
        >
          {busy ? '…' : 'Use mock'}
          <ChevronDown className={compact ? 'h-3 w-3 opacity-70' : 'h-3.5 w-3.5 opacity-70'} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          Replay saved responses for a hop role. Pending hops capture on the next matching request, then replay.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!canMockSources || busy !== null}
          title="Replay leaf/source hops. Parent GraphQL/BFF hops switch to Live so traffic reaches them."
          onClick={() => void applyTarget('sources')}
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span>All source hops</span>
            <span className="text-[11px] text-muted-foreground">
              {roles.sources.length} leaf call{roles.sources.length === 1 ? '' : 's'}
              {roles.ancestorsOfSources.length > 0
                ? ` · ${roles.ancestorsOfSources.length} parent${roles.ancestorsOfSources.length === 1 ? '' : 's'} go Live`
                : ''}
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canMockBff || busy !== null}
          title="Replay GraphQL/BFF hops. Downstream source APIs are not called."
          onClick={() => void applyTarget('bff')}
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span>All BFF hops</span>
            <span className="text-[11px] text-muted-foreground">
              {roles.bff.length} GraphQL gateway call{roles.bff.length === 1 ? '' : 's'}
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
