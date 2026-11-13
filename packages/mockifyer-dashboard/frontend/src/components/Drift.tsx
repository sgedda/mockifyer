import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import {
  getDriftLatest,
  getDriftHistory,
  runDriftCheck,
  acceptDrift as apiAcceptDrift,
  acceptAllWarnings as apiAcceptAllWarnings,
  snoozeDrift as apiSnoozeDrift,
  ignoreField as apiIgnoreField,
} from '@/lib/api'
import type { DriftHistoryReport, MockDriftReportWithHistory, DriftIssueWithHistory } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, Clock, Play, FileWarning, FileCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface DriftProps {
  scenario: string
}

interface DriftHistorySummary {
  timestamp: string
  breakingDriftCount: number
  warningOnlyCount: number
  totalMocks: number
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

function getDriftStatusBadge(endpoint: MockDriftReportWithHistory) {
  if (endpoint.snoozedUntil && new Date(endpoint.snoozedUntil) > new Date()) {
    return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Snoozed</Badge>
  }
  if (!endpoint.hasDrift) {
    return <Badge variant="outline" className="text-green-600 border-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> OK</Badge>
  }
  if (endpoint.hasBreakingDrift) {
    return <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Breaking</Badge>
  }
  return <Badge variant="default" className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600"><FileWarning className="h-3 w-3" /> Warning</Badge>
}

function DriftDiffView({ endpoint }: { endpoint: MockDriftReportWithHistory }) {
  const [selectedIssue, setSelectedIssue] = useState<DriftIssueWithHistory | null>(null)

  if (!endpoint.hasDrift || endpoint.issues.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 border rounded-md">
        No drift detected for this endpoint.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium mb-2">Issues Detected:</div>
      {endpoint.issues.map((issue, idx) => (
        <div
          key={idx}
          className="border rounded-md p-3 space-y-2 cursor-pointer hover:bg-accent"
          onClick={() => setSelectedIssue(issue)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="font-mono text-sm mb-1">{issue.path}</div>
              <div className="text-sm text-muted-foreground">{issue.message}</div>
            </div>
            <Badge variant={issue.severity === 'breaking' ? 'destructive' : 'default'}>
              {issue.severity}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>First seen: {formatTimestamp(issue.firstSeen)}</span>
            <span>Last seen: {formatTimestamp(issue.lastSeen)}</span>
            <span>Occurrences: {issue.occurrences}</span>
          </div>
          {(issue.expected || issue.actual) && (
            <div className="grid grid-cols-2 gap-2 text-xs mt-2">
              {issue.expected && (
                <div>
                  <div className="text-muted-foreground mb-1">Expected:</div>
                  <code className="bg-muted px-2 py-1 rounded">{issue.expected}</code>
                </div>
              )}
              {issue.actual && (
                <div>
                  <div className="text-muted-foreground mb-1">Actual:</div>
                  <code className="bg-muted px-2 py-1 rounded">{issue.actual}</code>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {selectedIssue && (
        <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-mono">{selectedIssue.path}</DialogTitle>
              <DialogDescription>{selectedIssue.message}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Type:</div>
                <Badge>{selectedIssue.type}</Badge>
              </div>
              {selectedIssue.expected && (
                <div>
                  <div className="text-sm font-medium mb-2">Expected:</div>
                  <code className="block bg-muted p-3 rounded text-sm">
                    {selectedIssue.expected}
                  </code>
                </div>
              )}
              {selectedIssue.actual && (
                <div>
                  <div className="text-sm font-medium mb-2">Actual:</div>
                  <code className="block bg-muted p-3 rounded text-sm">
                    {selectedIssue.actual}
                  </code>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default function Drift({ scenario }: DriftProps) {
  const [report, setReport] = useState<DriftHistoryReport | null>(null)
  const [history, setHistory] = useState<DriftHistorySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [selectedEndpoint, setSelectedEndpoint] = useState<MockDriftReportWithHistory | null>(null)
  const [showAcceptDialog, setShowAcceptDialog] = useState(false)
  const [showSnoozeDialog, setShowSnoozeDialog] = useState(false)
  const [showIgnoreDialog, setShowIgnoreDialog] = useState(false)
  const [selectedIssuePath, setSelectedIssuePath] = useState<string>('')
  const [snoozeDays, setSnoozeDays] = useState('7')
  const [actionPending, setActionPending] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    void loadDriftData()
  }, [scenario])

  async function loadDriftData() {
    try {
      setLoading(true)
      const [latestResult, historyResult] = await Promise.all([
        getDriftLatest(scenario),
        getDriftHistory(scenario),
      ])

      if (latestResult.found && latestResult.report) {
        setReport(latestResult.report)
      } else {
        setReport(null)
      }

      setHistory(historyResult.reports || [])
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load drift data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleRunCheck() {
    try {
      setChecking(true)
      toast({
        title: 'Running drift check',
        description: 'Checking for API drift against configured base URL (GET-only)...',
      })

      const result = await runDriftCheck(scenario)

      if (result.success && result.report) {
        setReport(result.report)
        toast({
          title: 'Drift check complete',
          description: result.report.summary,
          variant: result.report.breakingDriftCount > 0 ? 'destructive' : 'default',
        })
        await loadDriftData()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to run drift check',
        variant: 'destructive',
      })
    } finally {
      setChecking(false)
    }
  }

  async function handleAcceptDrift(endpoint: MockDriftReportWithHistory) {
    try {
      setActionPending(true)
      const url = new URL(endpoint.url)
      const result = await apiAcceptDrift({
        method: endpoint.method,
        path: url.pathname + url.search,
        scenario,
      })

      if (result.success) {
        toast({
          title: 'Drift accepted',
          description: result.filePath
            ? `Updated mock file: ${result.filePath}`
            : result.message,
        })
        await loadDriftData()
        setShowAcceptDialog(false)
        setSelectedEndpoint(null)
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to accept drift',
        variant: 'destructive',
      })
    } finally {
      setActionPending(false)
    }
  }

  async function handleAcceptAllWarnings() {
    try {
      setActionPending(true)
      const result = await apiAcceptAllWarnings(scenario)

      toast({
        title: 'Warnings accepted',
        description: `Accepted ${result.accepted} warnings. ${result.failed > 0 ? `${result.failed} failed.` : ''}`,
        variant: result.failed > 0 ? 'default' : 'default',
      })

      if (result.messages.length > 0) {
        console.log('Accept warnings details:', result.messages)
      }

      await loadDriftData()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to accept warnings',
        variant: 'destructive',
      })
    } finally {
      setActionPending(false)
    }
  }

  async function handleSnooze() {
    if (!selectedEndpoint) return

    try {
      setActionPending(true)
      const url = new URL(selectedEndpoint.url)
      const days = parseInt(snoozeDays, 10)

      if (isNaN(days) || days < 1) {
        toast({
          title: 'Invalid input',
          description: 'Days must be a positive number',
          variant: 'destructive',
        })
        return
      }

      const result = await apiSnoozeDrift({
        method: selectedEndpoint.method,
        path: url.pathname + url.search,
        days,
        scenario,
      })

      if (result.success) {
        toast({
          title: 'Endpoint snoozed',
          description: `Snoozed until ${new Date(result.expiresAt).toLocaleDateString()}`,
        })
        await loadDriftData()
        setShowSnoozeDialog(false)
        setSelectedEndpoint(null)
      } else {
        toast({
          title: 'Failed to snooze',
          description: result.message || 'An error occurred',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to snooze endpoint',
        variant: 'destructive',
      })
    } finally {
      setActionPending(false)
    }
  }

  async function handleIgnoreField() {
    if (!selectedEndpoint || !selectedIssuePath) return

    try {
      setActionPending(true)
      const endpoint = `${selectedEndpoint.method} ${new URL(selectedEndpoint.url).pathname}`

      const result = await apiIgnoreField({
        endpoint,
        jsonPath: selectedIssuePath,
      })

      if (result.success) {
        toast({
          title: 'Field ignored',
          description: 'Added ignore rule to mockifyer.drift.json. Review the git diff before committing.',
        })
        await loadDriftData()
        setShowIgnoreDialog(false)
        setSelectedEndpoint(null)
        setSelectedIssuePath('')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to ignore field',
        variant: 'destructive',
      })
    } finally {
      setActionPending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading drift data...</div>
      </div>
    )
  }

  const hasWarningsOnly = report && report.warningOnlyCount > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">API Drift Detection</h2>
          <p className="text-muted-foreground">
            Monitor API changes and manage drift for scenario: <span className="font-mono">{scenario}</span>
          </p>
        </div>
        <Button
          onClick={handleRunCheck}
          disabled={checking}
          className="flex items-center gap-2"
        >
          <Play className="h-4 w-4" />
          {checking ? 'Running...' : 'Run Check Now'}
        </Button>
      </div>

      {!report ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              No Drift Report Found
            </CardTitle>
            <CardDescription>
              Run drift check to monitor API changes. Set up a drift-watch scenario in your mock data
              and configure a base URL in <code className="text-xs">mockifyer.drift.json</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>Quick setup:</strong></p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Create a drift-watch scenario with important endpoints</li>
                <li>Add <code className="text-xs">mockifyer.drift.json</code> with your API base URL</li>
                <li>Click "Run Check Now" or run: <code className="text-xs">npx mockifyer-drift-check</code></li>
              </ol>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Mocks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.totalMocks}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Breaking Drift</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{report.breakingDriftCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Warnings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{report.warningOnlyCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Last Check</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">{formatTimestamp(report.timestamp)}</div>
                {report.gitCommit && (
                  <div className="text-xs text-muted-foreground font-mono mt-1">
                    {report.gitCommit.slice(0, 7)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {hasWarningsOnly && (
            <div className="flex items-center justify-between p-4 border border-amber-200 bg-amber-50 rounded-md dark:bg-amber-950/20 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <FileWarning className="h-5 w-5 text-amber-600" />
                <span className="text-sm">
                  {report.warningOnlyCount} endpoint{report.warningOnlyCount === 1 ? '' : 's'} with warnings only
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAcceptAllWarnings}
                disabled={actionPending}
              >
                Accept All Warnings
              </Button>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Endpoints</CardTitle>
              <CardDescription>
                {report.driftedMocks > 0
                  ? `${report.driftedMocks} of ${report.totalMocks} endpoints have drift`
                  : `All ${report.totalMocks} endpoints are in sync`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {report.mockReports.map((endpoint, idx) => (
                  <div
                    key={idx}
                    className="border rounded-md p-4 space-y-3"
                    data-testid={`drift-endpoint-${endpoint.method}-${endpoint.url.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="font-mono text-xs">
                            {endpoint.method}
                          </Badge>
                          {getDriftStatusBadge(endpoint)}
                        </div>
                        <div className="font-mono text-sm break-all">{endpoint.url}</div>
                        {endpoint.mockFilePath && (
                          <div className="text-xs text-muted-foreground mt-1">{endpoint.mockFilePath}</div>
                        )}
                      </div>
                    </div>

                    {endpoint.hasDrift && (
                      <>
                        <DriftDiffView endpoint={endpoint} />
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              setSelectedEndpoint(endpoint)
                              setShowAcceptDialog(true)
                            }}
                            disabled={actionPending}
                            data-testid={`accept-live-${endpoint.method}-${endpoint.url.replace(/[^a-zA-Z0-9]/g, '-')}`}
                          >
                            Accept Live
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEndpoint(endpoint)
                              setShowIgnoreDialog(true)
                            }}
                            disabled={actionPending}
                          >
                            Ignore Field
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEndpoint(endpoint)
                              setShowSnoozeDialog(true)
                            }}
                            disabled={actionPending}
                          >
                            Snooze
                          </Button>
                        </div>
                      </>
                    )}

                    {endpoint.skipped && endpoint.skipReason && (
                      <div className="text-sm text-muted-foreground">
                        Skipped: {endpoint.skipReason}
                      </div>
                    )}

                    {endpoint.notChecked && endpoint.notCheckedReason && (
                      <div className="text-sm text-muted-foreground">
                        Not checked: {endpoint.notCheckedReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
                <CardDescription>Recent drift check results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {history.slice(0, 10).map((h, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-md">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-mono">{formatTimestamp(h.timestamp)}</span>
                        <span className="text-sm text-muted-foreground">{h.totalMocks} mocks</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {h.breakingDriftCount > 0 && (
                          <Badge variant="destructive">{h.breakingDriftCount} breaking</Badge>
                        )}
                        {h.warningOnlyCount > 0 && (
                          <Badge variant="default" className="bg-amber-500">{h.warningOnlyCount} warnings</Badge>
                        )}
                        {h.breakingDriftCount === 0 && h.warningOnlyCount === 0 && (
                          <Badge variant="outline" className="text-green-600 border-green-600">Clean</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Accept Dialog */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Drift</DialogTitle>
            <DialogDescription>
              This will re-fetch the live endpoint and update the mock file with the new response.
            </DialogDescription>
          </DialogHeader>
          {selectedEndpoint && (
            <div className="space-y-2">
              <div className="text-sm">
                <strong>Endpoint:</strong> <code className="text-xs">{selectedEndpoint.method} {selectedEndpoint.url}</code>
              </div>
              <div className="text-sm text-muted-foreground">
                Review the git diff after accepting to ensure changes are intentional.
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowAcceptDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedEndpoint && handleAcceptDrift(selectedEndpoint)}
              disabled={actionPending}
            >
              {actionPending ? 'Accepting...' : 'Accept'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Snooze Dialog */}
      <Dialog open={showSnoozeDialog} onOpenChange={setShowSnoozeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Snooze Endpoint</DialogTitle>
            <DialogDescription>
              Suppress drift warnings for this endpoint for a specified number of days.
            </DialogDescription>
          </DialogHeader>
          {selectedEndpoint && (
            <div className="space-y-4">
              <div className="text-sm">
                <strong>Endpoint:</strong> <code className="text-xs">{selectedEndpoint.method} {selectedEndpoint.url}</code>
              </div>
              <div>
                <label className="text-sm font-medium">Days to snooze:</label>
                <Input
                  type="number"
                  min="1"
                  value={snoozeDays}
                  onChange={(e) => setSnoozeDays(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowSnoozeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSnooze} disabled={actionPending}>
              {actionPending ? 'Snoozing...' : 'Snooze'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ignore Field Dialog */}
      <Dialog open={showIgnoreDialog} onOpenChange={setShowIgnoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ignore Field</DialogTitle>
            <DialogDescription>
              Add an ignore rule for a specific JSON path to mockifyer.drift.json.
            </DialogDescription>
          </DialogHeader>
          {selectedEndpoint && (
            <div className="space-y-4">
              <div className="text-sm">
                <strong>Endpoint:</strong> <code className="text-xs">{selectedEndpoint.method} {new URL(selectedEndpoint.url).pathname}</code>
              </div>
              <div>
                <label className="text-sm font-medium">Field path (select from issues above):</label>
                <select
                  className="mt-2 w-full border rounded-md p-2 text-sm"
                  value={selectedIssuePath}
                  onChange={(e) => setSelectedIssuePath(e.target.value)}
                >
                  <option value="">Select a field...</option>
                  {selectedEndpoint.issues.map((issue, idx) => (
                    <option key={idx} value={issue.path}>
                      {issue.path}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-muted-foreground">
                This will be written to mockifyer.drift.json. Review the file before committing.
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowIgnoreDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleIgnoreField}
              disabled={actionPending || !selectedIssuePath}
            >
              {actionPending ? 'Adding...' : 'Add Ignore Rule'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
