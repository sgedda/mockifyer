import { useState, type MouseEvent, type ReactNode } from 'react'
import { Check, Copy, Link } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

interface CopyableTextProps {
  value: string
  className?: string
  /** Extra classes for the value text. */
  textClassName?: string
  title?: string
  copyLabel?: string
}

/**
 * Selectable value with a copy button. Stops click bubbling so cards/rows
 * can still navigate while the URL itself stays easy to copy.
 */
export function CopyableText({
  value,
  className,
  textClassName,
  title,
  copyLabel = 'Copy',
}: CopyableTextProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    const ok = await writeClipboard(value)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div
      className={cn('flex items-start gap-1 min-w-0', className)}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span
        className={cn('break-all select-text min-w-0', textClassName)}
        title={title ?? value}
      >
        {value}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-6 shrink-0 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
        onClick={(event) => void handleCopy(event)}
        title={copied ? 'Copied' : copyLabel}
        aria-label={copied ? 'Copied' : copyLabel}
      >
        {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

interface CopyPageLinkButtonProps {
  className?: string
  children?: ReactNode
}

/** Copies the current browser URL (shareable dashboard deep link). */
export function CopyPageLinkButton({ className, children }: CopyPageLinkButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const ok = await writeClipboard(window.location.href)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('h-8 gap-1.5', className)}
      onClick={() => void handleCopy()}
      title="Copy this page URL"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Link className="h-3.5 w-3.5" />}
      {children ?? (copied ? 'Copied link' : 'Copy link')}
    </Button>
  )
}
