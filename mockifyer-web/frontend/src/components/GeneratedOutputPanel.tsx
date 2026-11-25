/**
 * Shared JSON / types output panel with tabs, language select, and copy.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
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
  DEFAULT_TYPES_LANGUAGE,
  TYPE_LANGUAGES,
  emitTypes,
  parseTypesLanguage,
  type TypesLanguage,
} from '@/lib/mock-data-generator/emit-types'

export type OutputViewTab = 'json' | 'types'

interface GeneratedOutputPanelProps {
  output: unknown | null
  busy?: boolean
  error?: string | null
  /** Prefix for data-testid attributes (e.g. "start" or "tool"). */
  testIdPrefix: string
  /** Max height classes for the pre block. */
  preClassName?: string
  /** Optional root interface name for type emit. */
  rootTypeName?: string
  /** Show pending skeleton when output is null and not errored. */
  pendingLabel?: string
  /** Extra action (e.g. Download) rendered next to Copy. */
  extraActions?: React.ReactNode
  /** Controlled types language (share-state). */
  typesLanguage?: TypesLanguage
  onTypesLanguageChange?: (language: TypesLanguage) => void
  onCopied?: (tab: OutputViewTab, language: TypesLanguage) => void
}

export default function GeneratedOutputPanel({
  output,
  busy: _busy = false,
  error = null,
  testIdPrefix,
  preClassName = 'max-h-[280px] overflow-auto p-4 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed',
  rootTypeName = 'Root',
  pendingLabel = 'Generating…',
  extraActions,
  typesLanguage: controlledLanguage,
  onTypesLanguageChange,
  onCopied,
}: GeneratedOutputPanelProps) {
  const [tab, setTab] = useState<OutputViewTab>('json')
  const [localLanguage, setLocalLanguage] = useState<TypesLanguage>(DEFAULT_TYPES_LANGUAGE)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const language = parseTypesLanguage(controlledLanguage ?? localLanguage)

  const setLanguage = (next: TypesLanguage) => {
    if (onTypesLanguageChange) {
      onTypesLanguageChange(next)
    } else {
      setLocalLanguage(next)
    }
  }

  const jsonText = useMemo(
    () => (output == null ? '' : `${JSON.stringify(output, null, 2)}\n`),
    [output]
  )

  const typesText = useMemo(() => {
    if (output == null) return ''
    try {
      return emitTypes(output, { rootName: rootTypeName, language })
    } catch (err) {
      return `// Failed to infer types: ${err instanceof Error ? err.message : String(err)}\n`
    }
  }, [output, rootTypeName, language])

  const shownText = tab === 'json' ? jsonText : typesText
  const copyLabel = tab === 'json' ? 'Copy JSON' : 'Copy types'

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  const onCopy = async () => {
    if (!shownText) return
    await navigator.clipboard.writeText(shownText)
    setCopied(true)
    onCopied?.(tab, language)
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-3" data-testid={`${testIdPrefix}-output-panel`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 w-fit"
            role="tablist"
            aria-label="Output format"
            data-testid={`${testIdPrefix}-output-tabs`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'json'}
              data-testid={`${testIdPrefix}-tab-json`}
              className={`px-3 py-1.5 text-sm font-medium rounded-md min-h-9 ${
                tab === 'json'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTab('json')}
            >
              JSON
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'types'}
              data-testid={`${testIdPrefix}-tab-types`}
              className={`px-3 py-1.5 text-sm font-medium rounded-md min-h-9 ${
                tab === 'types'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTab('types')}
            >
              Types
            </button>
          </div>

          {tab === 'types' ? (
            <div
              className="flex items-center gap-2"
              data-testid={`${testIdPrefix}-types-language`}
            >
              <Label
                htmlFor={`${testIdPrefix}-types-language-select`}
                className="text-xs text-muted-foreground sr-only sm:not-sr-only sm:whitespace-nowrap"
              >
                Language
              </Label>
              <Select
                value={language}
                onValueChange={(value) => setLanguage(parseTypesLanguage(value))}
              >
                <SelectTrigger
                  id={`${testIdPrefix}-types-language-select`}
                  className="h-9 min-h-9 w-[160px] bg-white"
                  data-testid={`${testIdPrefix}-types-language-select`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_LANGUAGES.map((item) => (
                    <SelectItem
                      key={item.id}
                      value={item.id}
                      data-testid={`${testIdPrefix}-types-lang-${item.id}`}
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto min-h-10"
            data-testid={`${testIdPrefix}-copy-output`}
            disabled={output == null}
            onClick={() => void onCopy()}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1.5" />
                {copyLabel}
              </>
            )}
          </Button>
          {extraActions}
        </div>
      </div>

      <div
        className="relative rounded-xl border border-border bg-muted/30 overflow-hidden"
        data-testid={`${testIdPrefix}-generated-output`}
      >
        {!output && !error ? (
          <div
            className="flex items-center gap-2 p-4 text-sm text-muted-foreground"
            data-testid={`${testIdPrefix}-generator-skeleton`}
            aria-busy="true"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            {pendingLabel}
          </div>
        ) : null}
        {error ? (
          <p className="p-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {output != null ? (
          <pre
            className={preClassName}
            data-testid={
              testIdPrefix === 'tool'
                ? 'generated-output'
                : `${testIdPrefix}-generated-preview`
            }
            data-output-tab={tab}
            data-types-language={tab === 'types' ? language : undefined}
          >
            {shownText}
          </pre>
        ) : null}
      </div>
    </div>
  )
}
