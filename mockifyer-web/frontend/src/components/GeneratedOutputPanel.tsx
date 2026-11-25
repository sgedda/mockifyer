/**
 * JSON + types output: side-by-side on desktop (both visible), full-width tabs on mobile.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  /** Max height classes for each pre block. */
  preClassName?: string
  /** Optional root interface name for type emit. */
  rootTypeName?: string
  pendingLabel?: string
  /** Extra action under the JSON pane header (e.g. Download). */
  extraActions?: ReactNode
  typesLanguage?: TypesLanguage
  onTypesLanguageChange?: (language: TypesLanguage) => void
  onCopied?: (tab: OutputViewTab, language: TypesLanguage) => void
}

function CopyButton({
  testId,
  label,
  disabled,
  copied,
  onClick,
}: {
  testId: string
  label: string
  disabled: boolean
  copied: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-9"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 mr-1.5" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          {label}
        </>
      )}
    </Button>
  )
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
  const [mobileTab, setMobileTab] = useState<OutputViewTab>('json')
  const [localLanguage, setLocalLanguage] = useState<TypesLanguage>(DEFAULT_TYPES_LANGUAGE)
  const [copiedJson, setCopiedJson] = useState(false)
  const [copiedTypes, setCopiedTypes] = useState(false)
  const jsonTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => {
    return () => {
      if (jsonTimer.current) clearTimeout(jsonTimer.current)
      if (typesTimer.current) clearTimeout(typesTimer.current)
    }
  }, [])

  const copyJson = async () => {
    if (!jsonText) return
    await navigator.clipboard.writeText(jsonText)
    setCopiedJson(true)
    onCopied?.('json', language)
    if (jsonTimer.current) clearTimeout(jsonTimer.current)
    jsonTimer.current = setTimeout(() => setCopiedJson(false), 1500)
  }

  const copyTypes = async () => {
    if (!typesText) return
    await navigator.clipboard.writeText(typesText)
    setCopiedTypes(true)
    onCopied?.('types', language)
    if (typesTimer.current) clearTimeout(typesTimer.current)
    typesTimer.current = setTimeout(() => setCopiedTypes(false), 1500)
  }

  const jsonTestId =
    testIdPrefix === 'tool' ? 'generated-output' : `${testIdPrefix}-generated-preview`
  const typesTestId =
    testIdPrefix === 'tool' ? 'generated-types' : `${testIdPrefix}-generated-types`

  const pendingOrError = (
    <>
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
    </>
  )

  const languageSelect = (
    <div className="flex items-center gap-2" data-testid={`${testIdPrefix}-types-language`}>
      <Label
        htmlFor={`${testIdPrefix}-types-language-select`}
        className="text-xs text-muted-foreground whitespace-nowrap"
      >
        Language
      </Label>
      <Select value={language} onValueChange={(value) => setLanguage(parseTypesLanguage(value))}>
        <SelectTrigger
          id={`${testIdPrefix}-types-language-select`}
          className="h-9 min-h-9 w-[150px] bg-white"
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
  )

  const jsonPane = (
    <div className="space-y-2 min-w-0" data-testid={`${testIdPrefix}-json-pane`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">JSON</h3>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton
            testId={`${testIdPrefix}-copy-json`}
            label="Copy"
            disabled={output == null}
            copied={copiedJson}
            onClick={() => void copyJson()}
          />
          {extraActions}
        </div>
      </div>
      <div
        className="relative rounded-xl border border-border bg-muted/30 overflow-hidden"
        data-testid={`${testIdPrefix}-generated-output`}
      >
        {pendingOrError}
        {output != null ? (
          <pre className={preClassName} data-testid={jsonTestId} data-output-tab="json">
            {jsonText}
          </pre>
        ) : null}
      </div>
    </div>
  )

  const typesPane = (
    <div className="space-y-2 min-w-0" data-testid={`${testIdPrefix}-types-pane`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">Types</h3>
        <div className="flex flex-wrap items-center gap-2">
          {languageSelect}
          <CopyButton
            testId={`${testIdPrefix}-copy-types`}
            label="Copy"
            disabled={output == null}
            copied={copiedTypes}
            onClick={() => void copyTypes()}
          />
        </div>
      </div>
      <div
        className="relative rounded-xl border border-border bg-muted/30 overflow-hidden"
        data-testid={`${testIdPrefix}-types-output`}
      >
        {!output && !error ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground" aria-busy="true">
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
            data-testid={typesTestId}
            data-output-tab="types"
            data-types-language={language}
          >
            {typesText}
          </pre>
        ) : null}
      </div>
    </div>
  )

  return (
    <div className="space-y-3" data-testid={`${testIdPrefix}-output-panel`}>
      {/* Mobile: full-width tabs */}
      <div className="md:hidden space-y-3">
        <div
          className="grid grid-cols-2 rounded-lg border border-border p-0.5 bg-muted/40"
          role="tablist"
          aria-label="Output format"
          data-testid={`${testIdPrefix}-output-tabs`}
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'json'}
            data-testid={`${testIdPrefix}-tab-json`}
            className={`px-3 py-2.5 text-sm font-semibold rounded-md min-h-11 ${
              mobileTab === 'json'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
            onClick={() => setMobileTab('json')}
          >
            JSON
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'types'}
            data-testid={`${testIdPrefix}-tab-types`}
            className={`px-3 py-2.5 text-sm font-semibold rounded-md min-h-11 ${
              mobileTab === 'types'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
            onClick={() => setMobileTab('types')}
          >
            Types
          </button>
        </div>
        {mobileTab === 'json' ? jsonPane : typesPane}
      </div>

      {/* Desktop: side-by-side — both visible without clicks */}
      <div
        className="hidden md:grid md:grid-cols-2 gap-4"
        data-testid={`${testIdPrefix}-output-split`}
      >
        {jsonPane}
        {typesPane}
      </div>
    </div>
  )
}
