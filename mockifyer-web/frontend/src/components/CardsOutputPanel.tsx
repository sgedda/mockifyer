/**
 * Cards output view: themed flip cards with copy/share exports that preserve look + motion.
 * Creative picks: themes (clean/glass/trading/receipt), flip→JSON, staggered entrance +
 * Generate swap animation, HTML/React/PNG/embed exports. No GIF/WebM (PNG only).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Code2,
  Copy,
  Download,
  FileCode2,
  Link2,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ANIMATED_EXPORT_NOTE,
  CARD_THEMES,
  CARDS_SHARED_CSS,
  downloadElementPng,
  exportCardsEmbedSnippet,
  exportCardsHtml,
  exportCardsReact,
  normalizeToCards,
  suggestedThemeForCards,
  themeClass,
  type CardTheme,
  type MockCard,
} from '@/lib/mock-data-generator/cards'
import { cn } from '@/lib/utils'

const THEME_LABELS: Record<CardTheme, string> = {
  clean: 'Clean',
  glass: 'Glass',
  trading: 'Trading card',
  receipt: 'Receipt',
}

interface CardsOutputPanelProps {
  output: unknown | null
  busy?: boolean
  error?: string | null
  theme: CardTheme
  onThemeChange: (theme: CardTheme) => void
  /** Bumps when Generate runs — triggers swap animation. */
  generationKey?: string | number
  shareUrl?: string
  testIdPrefix?: string
  onCopied?: (kind: 'html' | 'react' | 'embed' | 'link') => void
  onToast?: (title: string, description?: string) => void
}

function CardFace({
  card,
  index,
  flipped,
  onToggle,
}: {
  card: MockCard
  index: number
  flipped: boolean
  onToggle: () => void
}) {
  return (
    <article
      className={cn('mdg-card-scene mdg-enter', flipped && 'is-flipped')}
      style={{ animationDelay: `${Math.min(index, 12) * 55}ms` }}
      data-testid={`card-item-${card.id}`}
      data-card-kind={card.kind}
    >
      <button
        type="button"
        className="mdg-card-flip w-full text-left border-0 bg-transparent p-0 cursor-pointer"
        onClick={onToggle}
        aria-pressed={flipped}
        aria-label={flipped ? `Show ${card.title} card` : `Flip ${card.title} to JSON`}
      >
        <div className="mdg-card-face mdg-card-front">
          <div className="mdg-card-kicker">{card.kind}</div>
          <h3 className="mdg-card-title">{card.title}</h3>
          {card.subtitle ? <p className="mdg-card-sub">{card.subtitle}</p> : null}
          {card.badge ? <span className="mdg-card-badge">{card.badge}</span> : null}
          {card.fields.length > 0 ? (
            <ul className="mdg-card-fields">
              {card.fields.map((field) => (
                <li key={field.label}>
                  <span className="lbl">{field.label}</span>
                  <span className="val">{field.value}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {card.highlight ? (
            <div className="mdg-card-highlight mdg-count">{card.highlight}</div>
          ) : null}
        </div>
        <div className="mdg-card-face mdg-card-back">
          <div className="mdg-card-kicker">JSON</div>
          <pre>{card.rawJson}</pre>
        </div>
      </button>
    </article>
  )
}

export default function CardsOutputPanel({
  output,
  busy = false,
  error = null,
  theme,
  onThemeChange,
  generationKey,
  shareUrl,
  testIdPrefix = 'tool',
  onCopied,
  onToast,
}: CardsOutputPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [flipped, setFlipped] = useState<Record<string, boolean>>({})
  const [swapping, setSwapping] = useState(false)
  const [copiedKind, setCopiedKind] = useState<string | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const themeTouched = useRef(false)
  const lastGenerationKey = useRef(generationKey)

  const cards = useMemo(() => (output == null ? [] : normalizeToCards(output)), [output])

  useEffect(() => {
    if (themeTouched.current || cards.length === 0) return
    const suggested = suggestedThemeForCards(cards)
    if (suggested !== theme) onThemeChange(suggested)
    // Only auto-suggest once per mount / until user picks a theme
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot suggest
  }, [cards])

  useEffect(() => {
    if (generationKey === undefined || generationKey === lastGenerationKey.current) return
    lastGenerationKey.current = generationKey
    setSwapping(true)
    setFlipped({})
    if (swapTimer.current) clearTimeout(swapTimer.current)
    swapTimer.current = setTimeout(() => setSwapping(false), 700)
  }, [generationKey])

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current)
      if (swapTimer.current) clearTimeout(swapTimer.current)
    }
  }, [])

  const markCopied = (kind: 'html' | 'react' | 'embed' | 'link') => {
    setCopiedKind(kind)
    onCopied?.(kind)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopiedKind(null), 1500)
  }

  const copyText = async (text: string, kind: 'html' | 'react' | 'embed' | 'link') => {
    await navigator.clipboard.writeText(text)
    markCopied(kind)
  }

  const handleCopyHtml = async () => {
    if (cards.length === 0) return
    await copyText(exportCardsHtml({ cards, theme }), 'html')
  }

  const handleCopyReact = async () => {
    if (cards.length === 0) return
    await copyText(exportCardsReact({ cards, theme }), 'react')
  }

  const handleCopyEmbed = async () => {
    if (!shareUrl) return
    await copyText(exportCardsEmbedSnippet(shareUrl), 'embed')
  }

  const handleCopyShare = async () => {
    if (!shareUrl) return
    await copyText(shareUrl, 'link')
  }

  const handleDownloadPng = async () => {
    if (!rootRef.current || cards.length === 0) return
    try {
      await downloadElementPng(rootRef.current, 'mockifyer-cards.png')
      onToast?.('Downloaded PNG', ANIMATED_EXPORT_NOTE)
    } catch (err) {
      onToast?.(
        'PNG export failed',
        err instanceof Error ? err.message : 'Try Copy as HTML instead.'
      )
    }
  }

  const disabled = output == null || cards.length === 0

  return (
    <div className="space-y-3" data-testid={`${testIdPrefix}-cards-panel`}>
      <style>{CARDS_SHARED_CSS}</style>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="space-y-1.5 min-w-[160px]">
          <Label htmlFor={`${testIdPrefix}-card-theme`} className="text-xs text-muted-foreground">
            Card theme
          </Label>
          <Select
            value={theme}
            onValueChange={(value) => {
              themeTouched.current = true
              onThemeChange(value as CardTheme)
            }}
          >
            <SelectTrigger
              id={`${testIdPrefix}-card-theme`}
              className="min-h-10 bg-white w-full sm:w-[180px]"
              data-testid={`${testIdPrefix}-card-theme`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CARD_THEMES.map((id) => (
                <SelectItem key={id} value={id} data-testid={`${testIdPrefix}-theme-${id}`}>
                  {THEME_LABELS[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9"
            data-testid={`${testIdPrefix}-copy-cards-html`}
            disabled={disabled}
            onClick={() => void handleCopyHtml()}
          >
            {copiedKind === 'html' ? (
              <Check className="h-3.5 w-3.5 mr-1.5" />
            ) : (
              <Code2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            {copiedKind === 'html' ? 'Copied' : 'Copy as HTML'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9"
            data-testid={`${testIdPrefix}-copy-cards-react`}
            disabled={disabled}
            onClick={() => void handleCopyReact()}
          >
            {copiedKind === 'react' ? (
              <Check className="h-3.5 w-3.5 mr-1.5" />
            ) : (
              <FileCode2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            {copiedKind === 'react' ? 'Copied' : 'Copy as React'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9"
            data-testid={`${testIdPrefix}-download-cards-png`}
            disabled={disabled}
            onClick={() => void handleDownloadPng()}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download PNG
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9"
            data-testid={`${testIdPrefix}-copy-cards-share`}
            disabled={!shareUrl}
            onClick={() => void handleCopyShare()}
          >
            {copiedKind === 'link' ? (
              <Check className="h-3.5 w-3.5 mr-1.5" />
            ) : (
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            {copiedKind === 'link' ? 'Copied' : 'Share link'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9"
            data-testid={`${testIdPrefix}-copy-cards-embed`}
            disabled={!shareUrl}
            onClick={() => void handleCopyEmbed()}
          >
            {copiedKind === 'embed' ? (
              <Check className="h-3.5 w-3.5 mr-1.5" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1.5" />
            )}
            {copiedKind === 'embed' ? 'Copied' : 'Embed'}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground" data-testid={`${testIdPrefix}-cards-hint`}>
        Click a card to flip to raw JSON. Copy as HTML/React keeps themes and keyframe motion.
        Animated GIF/WebM is not available in-browser — use PNG or HTML for motion.
      </p>

      {!output && !error ? (
        <div
          className="flex items-center gap-2 p-4 text-sm text-muted-foreground"
          data-testid={`${testIdPrefix}-cards-skeleton`}
          aria-busy="true"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating cards…
        </div>
      ) : null}
      {error ? (
        <p
          className="p-4 text-sm text-destructive"
          role="alert"
          data-testid={`${testIdPrefix}-error-banner`}
        >
          {error}
        </p>
      ) : null}

      {output != null ? (
        <div
          ref={rootRef}
          className={cn(
            'mdg-cards-root rounded-xl p-3 sm:p-4 bg-[#f5f5f4]',
            themeClass(theme),
            swapping && 'is-swapping',
            busy && 'opacity-90'
          )}
          data-testid={`${testIdPrefix}-cards-grid`}
          data-theme={theme}
        >
          <div className="mdg-cards-grid">
            {cards.map((card, index) => (
              <CardFace
                key={`${card.id}-${generationKey ?? '0'}`}
                card={card}
                index={index}
                flipped={Boolean(flipped[card.id])}
                onToggle={() =>
                  setFlipped((prev) => ({ ...prev, [card.id]: !prev[card.id] }))
                }
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
