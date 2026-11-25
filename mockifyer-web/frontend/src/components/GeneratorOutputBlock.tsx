/**
 * Output block inside the tool card: surface tabs (JSON|Types | Cards) + Generate feedback.
 * Desktop keeps JSON|Types side-by-side under the Code surface; Cards is the third view.
 */

import type { ReactNode } from 'react'
import { Dices, Loader2 } from 'lucide-react'
import GeneratedOutputPanel from '@/components/GeneratedOutputPanel'
import CardsOutputPanel from '@/components/CardsOutputPanel'
import { Button } from '@/components/ui/button'
import type { TypesLanguage } from '@/lib/mock-data-generator/emit-types'
import type { CardTheme, OutputSurface } from '@/lib/mock-data-generator/cards'
import { cn } from '@/lib/utils'

interface GeneratorOutputBlockProps {
  output: unknown | null
  busy: boolean
  error: string | null
  outputStatus: string | null
  outputFlash: boolean
  surface: OutputSurface
  onSurfaceChange: (surface: OutputSurface) => void
  cardTheme: CardTheme
  onCardThemeChange: (theme: CardTheme) => void
  generationKey: string | number
  shareUrl: string
  typesLanguage: TypesLanguage
  onTypesLanguageChange: (language: TypesLanguage) => void
  onGenerate: () => void
  generateDisabled?: boolean
  statusHint?: string
  extraActions?: ReactNode
  onCopiedCode?: (tab: 'json' | 'types') => void
  onCopiedCards?: (kind: 'html' | 'react' | 'embed' | 'link') => void
  onToast?: (title: string, description?: string) => void
  testIdPrefix?: string
  /** When true, hide the Generate button (e.g. parent already shows one). */
  hideGenerate?: boolean
  preClassName?: string
}

export default function GeneratorOutputBlock({
  output,
  busy,
  error,
  outputStatus,
  outputFlash,
  surface,
  onSurfaceChange,
  cardTheme,
  onCardThemeChange,
  generationKey,
  shareUrl,
  typesLanguage,
  onTypesLanguageChange,
  onGenerate,
  generateDisabled,
  statusHint = 'Press Generate to refresh values (new seed unless locked).',
  extraActions,
  onCopiedCode,
  onCopiedCards,
  onToast,
  testIdPrefix = 'tool',
  hideGenerate = false,
  preClassName = 'max-h-[min(420px,50vh)] overflow-auto p-3 sm:p-4 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed',
}: GeneratorOutputBlockProps) {
  return (
    <div
      className={cn('space-y-3', outputFlash && 'mdg-output-flash')}
      data-testid={`${testIdPrefix}-output-block`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">Generated output</h2>
          {outputStatus ? (
            <p
              className="text-xs text-muted-foreground truncate"
              data-testid="output-status"
              aria-live="polite"
            >
              {outputStatus}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{statusHint}</p>
          )}
        </div>
        {!hideGenerate ? (
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto shrink-0"
            data-testid="generate-button"
            disabled={generateDisabled ?? (busy && !output)}
            onClick={onGenerate}
          >
            {busy && output ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Dices className="h-4 w-4 mr-2" />
            )}
            Generate
          </Button>
        ) : null}
      </div>

      <div
        className="grid grid-cols-2 sm:grid-cols-3 rounded-lg border border-border p-0.5 bg-muted/40"
        role="tablist"
        aria-label="Output view"
        data-testid={`${testIdPrefix}-surface-tabs`}
      >
        <button
          type="button"
          role="tab"
          aria-selected={surface === 'code'}
          data-testid={`${testIdPrefix}-surface-code`}
          className={cn(
            'px-3 py-2.5 text-sm font-semibold rounded-md min-h-11 sm:col-span-2',
            surface === 'code'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground'
          )}
          onClick={() => onSurfaceChange('code')}
        >
          <span className="sm:hidden">JSON | Types</span>
          <span className="hidden sm:inline">JSON | Types</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={surface === 'cards'}
          data-testid={`${testIdPrefix}-surface-cards`}
          className={cn(
            'px-3 py-2.5 text-sm font-semibold rounded-md min-h-11',
            surface === 'cards'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground'
          )}
          onClick={() => onSurfaceChange('cards')}
        >
          Cards
        </button>
      </div>

      {surface === 'code' ? (
        <GeneratedOutputPanel
          output={output}
          busy={busy}
          error={error}
          testIdPrefix={testIdPrefix}
          rootTypeName="Root"
          typesLanguage={typesLanguage}
          onTypesLanguageChange={onTypesLanguageChange}
          preClassName={preClassName}
          onCopied={(tab) => onCopiedCode?.(tab)}
          extraActions={extraActions}
        />
      ) : (
        <CardsOutputPanel
          output={output}
          busy={busy}
          error={error}
          theme={cardTheme}
          onThemeChange={onCardThemeChange}
          generationKey={generationKey}
          shareUrl={shareUrl}
          testIdPrefix={testIdPrefix}
          onCopied={onCopiedCards}
          onToast={onToast}
        />
      )}
    </div>
  )
}
