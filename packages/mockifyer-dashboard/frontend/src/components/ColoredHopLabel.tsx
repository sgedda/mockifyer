import { cn } from '@/lib/utils'
import { httpMethodTextClass } from '@/lib/http-method-style'
import {
  chainFirstLastHops,
  hopPathLabelParts,
  hopPathLabelSourceFromMock,
  type HopPathLabelKind,
  type HopPathLabelSource,
  type MockServiceChain,
} from '@/lib/mock-correlation-chains'

function hopDetailClass(kind: HopPathLabelKind): string {
  switch (kind) {
    case 'operation':
      return 'text-sky-200'
    case 'path':
      return 'text-zinc-300'
    case 'host':
      return 'text-zinc-400'
    case 'filename':
      return 'text-zinc-400'
    default:
      return 'text-foreground'
  }
}

export function ColoredHopLabel({
  source,
  className,
}: {
  source: HopPathLabelSource
  className?: string
}) {
  const parts = hopPathLabelParts(source)
  if (parts.kind === 'filename') {
    return <span className={cn('text-zinc-400', className)}>{parts.text}</span>
  }
  return (
    <span className={className}>
      <span className={cn('font-semibold', httpMethodTextClass(parts.method))}>{parts.method}</span>
      {parts.text ? (
        <>
          {' '}
          <span className={hopDetailClass(parts.kind)}>{parts.text}</span>
        </>
      ) : null}
      {parts.query ? <span className="text-zinc-500">{parts.query}</span> : null}
    </span>
  )
}

export function ColoredChainPathLabel({
  chain,
  className,
}: {
  chain: MockServiceChain
  className?: string
}) {
  const pair = chainFirstLastHops(chain)
  if (!pair) {
    return <span className={className}>{chain.id}</span>
  }
  if (!pair.end) {
    return <ColoredHopLabel source={hopPathLabelSourceFromMock(pair.start)} className={className} />
  }
  return (
    <span className={className}>
      <ColoredHopLabel source={hopPathLabelSourceFromMock(pair.start)} />
      <span className="text-zinc-500 mx-1">→</span>
      <ColoredHopLabel source={hopPathLabelSourceFromMock(pair.end)} />
    </span>
  )
}
