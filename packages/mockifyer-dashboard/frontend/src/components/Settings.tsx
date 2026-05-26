import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { getScenarioConfig, setScenario, createScenario, setScenarioLock, exportScenarioBundle, importScenarioBundle } from '@/lib/api'
import type { ScenarioExportBundle } from '@/types'
import { Save, Download, Upload } from 'lucide-react'
import ClientLanes from './ClientLanes'

interface SettingsProps {
  scenario: string
  onScenarioChange: (scenario: string) => void
  scenarioLocks: Record<string, boolean>
  onScenarioConfigRefresh?: () => void | Promise<void>
}

export default function Settings({
  scenario,
  onScenarioChange,
  scenarioLocks,
  onScenarioConfigRefresh,
}: SettingsProps) {
  const [availableScenarios, setAvailableScenarios] = useState<string[]>(['default'])
  const [newScenario, setNewScenario] = useState('')
  const [deriveFromScenario, setDeriveFromScenario] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lockSaving, setLockSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exportScenarioName, setExportScenarioName] = useState(scenario)
  const [importTarget, setImportTarget] = useState('')
  const [importReplace, setImportReplace] = useState(false)
  const [importApplyDate, setImportApplyDate] = useState(true)
  const [importApplyProxy, setImportApplyProxy] = useState(true)
  const [parsedBundle, setParsedBundle] = useState<ScenarioExportBundle | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  async function handleToggleScenarioLock(nextLocked: boolean) {
    try {
      setLockSaving(true)
      await setScenarioLock(scenario, nextLocked)
      await onScenarioConfigRefresh?.()
      toast({
        title: 'Success',
        description: nextLocked
          ? `Scenario "${scenario}" is locked (mocks and date settings are read-only).`
          : `Scenario "${scenario}" is unlocked.`,
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update lock',
        variant: 'destructive',
      })
    } finally {
      setLockSaving(false)
    }
  }

  useEffect(() => {
    setExportScenarioName(scenario)
  }, [scenario])

  useEffect(() => {
    loadScenarios()
  }, [])

  async function loadScenarios() {
    try {
      setLoading(true)
      setError(null)
      const config = await getScenarioConfig()
      // The API returns 'scenarios' array, map it to availableScenarios
      const scenarios = (config as any).scenarios || config.availableScenarios || ['default']
      setAvailableScenarios(scenarios)
    } catch (error: any) {
      console.error('Failed to load scenarios:', error)
      setError(error.message || 'Failed to load scenarios')
      // Keep default scenario available even if API fails
      setAvailableScenarios(['default'])
      toast({
        title: 'Warning',
        description: 'Could not load scenarios from server. Using default.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSetScenario(newScenario: string) {
    try {
      setSaving(true)
      // Check if scenario exists, if not create it first
      const scenarioExists = availableScenarios.includes(newScenario)
      if (!scenarioExists) {
        // Create the scenario first - this returns the updated scenario list
        const createResult = await createScenario(newScenario, deriveFromScenario || null)
        // Update the available scenarios from the API response
        setAvailableScenarios(createResult.availableScenarios || [])
        toast({
          title: 'Success',
          description: `Scenario "${newScenario}" created`,
        })
      }
      // Then switch to it
      await setScenario(newScenario)
      onScenarioChange(newScenario)
      // Reload scenarios to ensure we have the latest list
      await loadScenarios()
      setDeriveFromScenario('')
      toast({
        title: 'Success',
        description: `Scenario changed to ${newScenario}`,
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set scenario',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  function downloadJson(data: unknown, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function handleExportScenario() {
    const name = exportScenarioName.trim() || scenario
    try {
      setExporting(true)
      const bundle = await exportScenarioBundle(name)
      const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_')
      const day = new Date().toISOString().slice(0, 10)
      downloadJson(bundle, `mockifyer-scenario-${safe}-${day}.json`)
      toast({
        title: 'Exported',
        description: `Scenario "${name}" downloaded as JSON (${bundle.mocks.length} mock(s)).`,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Export failed'
      toast({ title: 'Export failed', description: message, variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  async function onImportFileChosen(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text) as unknown
      if (!data || typeof data !== 'object') {
        throw new Error('File must contain a JSON object')
      }
      const o = data as Record<string, unknown>
      if (o.formatVersion !== 1) {
        throw new Error('Unsupported file: expected formatVersion 1')
      }
      if (!Array.isArray(o.mocks)) {
        throw new Error('Invalid bundle: missing mocks array')
      }
      setParsedBundle(data as ScenarioExportBundle)
      const src = typeof o.sourceScenario === 'string' && o.sourceScenario.trim() ? o.sourceScenario.trim() : ''
      setImportTarget(src || scenario)
      toast({
        title: 'Bundle loaded',
        description: `Ready to import ${o.mocks.length} mock(s). Confirm target scenario and options, then click Import.`,
      })
    } catch (err: unknown) {
      setParsedBundle(null)
      const message = err instanceof Error ? err.message : 'Invalid JSON file'
      toast({ title: 'Could not read file', description: message, variant: 'destructive' })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleImportScenario() {
    if (!parsedBundle) {
      toast({
        title: 'No bundle',
        description: 'Choose a valid export JSON file first.',
        variant: 'destructive',
      })
      return
    }
    const target = importTarget.trim()
    if (!target) {
      toast({
        title: 'Target scenario required',
        description: 'Enter the scenario name to import into.',
        variant: 'destructive',
      })
      return
    }
    try {
      setImporting(true)
      const result = await importScenarioBundle({
        bundle: parsedBundle,
        targetScenario: target,
        replaceExistingMocks: importReplace,
        applyDateConfig: importApplyDate,
        applyProxyConfig: importApplyProxy,
      })
      setAvailableScenarios(result.scenarios)
      setParsedBundle(null)
      setImportTarget('')
      toast({
        title: 'Import complete',
        description: result.message,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed'
      toast({ title: 'Import failed', description: message, variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scenarios</CardTitle>
          <CardDescription>
            Organize mock data into separate folders. Switch between scenarios to test different API response sets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading scenarios...</div>
          ) : (
            <>
              {error && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Scenario lock</label>
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={scenarioLocks[scenario] === true}
                      disabled={lockSaving || loading}
                      onChange={(e) => handleToggleScenarioLock(e.target.checked)}
                    />
                    Lock current scenario (read-only mocks &amp; date config)
                  </label>
                  <p className="text-xs text-muted-foreground basis-full">
                    While locked, the dashboard cannot save mock bodies, delete mocks, duplicate files, or change date
                    manipulation; Redis proxy recording is also skipped for this scenario.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Current Scenario</label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={scenario} 
                    readOnly 
                    className="font-mono" 
                  />
                  <Button
                    variant="outline"
                    onClick={() => handleSetScenario('default')}
                    disabled={scenario === 'default' || saving}
                  >
                    Reset to Default
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Available Scenarios</label>
                {availableScenarios.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">
                    No scenarios found. Create one below.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableScenarios.map((s) => (
                      <Button
                        key={s}
                        variant={s === scenario ? 'default' : 'outline'}
                        onClick={() => handleSetScenario(s)}
                        disabled={saving}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Create New Scenario</label>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Derive from existing scenario (optional)</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={deriveFromScenario}
                    onChange={(e) => setDeriveFromScenario(e.target.value)}
                    disabled={saving || loading}
                  >
                    <option value="">None (empty scenario)</option>
                    {availableScenarios
                      .filter((s) => s !== newScenario.trim())
                      .map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter scenario name (e.g., api-error, no-data)"
                    value={newScenario}
                    onChange={(e) => setNewScenario(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newScenario.trim()) {
                        handleSetScenario(newScenario.trim())
                        setNewScenario('')
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      if (newScenario.trim()) {
                        handleSetScenario(newScenario.trim())
                        setNewScenario('')
                      }
                    }}
                    disabled={!newScenario.trim() || saving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Creating...' : 'Create & Switch'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Scenarios allow you to organize different sets of mock responses for testing various scenarios.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import / export scenario</CardTitle>
          <CardDescription>
            Download a JSON backup of mocks (and optional date and proxy settings), or restore from a file. Format
            and API details are documented in the dashboard package as SCENARIO_IMPORT_EXPORT.md.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Export scenario</label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="flex h-10 min-w-[10rem] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={exportScenarioName}
                onChange={(e) => setExportScenarioName(e.target.value)}
                disabled={loading || exporting}
              >
                {availableScenarios.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" onClick={handleExportScenario} disabled={loading || exporting}>
                <Download className="h-4 w-4 mr-2" />
                {exporting ? 'Exporting…' : 'Download JSON'}
              </Button>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <label className="text-sm font-medium">Import from JSON</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => void onImportFileChosen(e.target.files)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || importing}
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose file…
              </Button>
              {parsedBundle ? (
                <span className="text-sm text-muted-foreground self-center">
                  Loaded: {parsedBundle.mocks.length} mock(s), exported {parsedBundle.exportedAt || '—'}
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Target scenario name</label>
              <Input
                placeholder="e.g. staging-errors"
                value={importTarget}
                onChange={(e) => setImportTarget(e.target.value)}
                disabled={importing}
              />
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importReplace}
                  onChange={(e) => setImportReplace(e.target.checked)}
                  disabled={importing}
                />
                Replace existing mocks in target (clear mocks first; date/proxy handled separately below)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importApplyDate}
                  onChange={(e) => setImportApplyDate(e.target.checked)}
                  disabled={importing}
                />
                Apply date settings from file (if the file includes them)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importApplyProxy}
                  onChange={(e) => setImportApplyProxy(e.target.checked)}
                  disabled={importing}
                />
                Apply proxy settings from file (Redis-backed dashboards only)
              </label>
            </div>
            <Button type="button" onClick={() => void handleImportScenario()} disabled={!parsedBundle || importing}>
              {importing ? 'Importing…' : 'Import into scenario'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ClientLanes availableScenarios={availableScenarios} />
    </div>
  )
}

