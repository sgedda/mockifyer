import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { getDateConfig, updateDateConfig, type DateConfig } from '@/lib/api'
import { Settings as SettingsIcon, Calendar, BookOpen, ToggleLeft, ToggleRight } from 'lucide-react'

const IANA_TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Australia/Sydney', 'America/Toronto', 'America/Mexico_City', 'Asia/Dubai',
  'Europe/Moscow', 'America/Sao_Paulo', 'Asia/Kolkata', 'Pacific/Auckland'
]

export default function Settings() {
  const [activeTab, setActiveTab] = useState('date')
  const [dateConfig, setDateConfig] = useState<DateConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fixedDate, setFixedDate] = useState('')
  const [offsetDays, setOffsetDays] = useState('0')
  const [offsetHours, setOffsetHours] = useState('0')
  const [offsetMinutes, setOffsetMinutes] = useState('0')
  const [offsetSign, setOffsetSign] = useState<'+' | '-'>('+')
  const [timezone, setTimezone] = useState('')
  const [dateEnabled, setDateEnabled] = useState(false)
  const [runtimeConfig, setRuntimeConfig] = useState<{
    mockifyerEnabled: boolean
    recordMode: boolean
    mockDataPath: string
  } | null>(null)
  const isEditingRef = useRef(false)
  const { toast } = useToast()

  useEffect(() => {
    loadDateConfig()
    loadRuntimeConfig()
    const interval = setInterval(() => {
      if (!isEditingRef.current) {
        updateCurrentDate()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  async function loadDateConfig() {
    try {
      const data = await getDateConfig()
      setDateConfig(data)
      setDateEnabled(data.enabled)
      setFixedDate(data.fixedDate || '')
      setOffsetDays(String(data.offsetDays || 0))
      setOffsetHours(String(data.offsetHours || 0))
      setOffsetMinutes(String(data.offsetMinutes || 0))
      setOffsetSign(data.offsetSign || '+')
      setTimezone(data.timezone || '')
    } catch (error: any) {
      console.error('Failed to load date config:', error)
      toast({
        title: 'Error',
        description: 'Failed to load date configuration',
        variant: 'destructive',
      })
      // Set default values so the form still renders
      setDateConfig({
        enabled: false,
        fixedDate: null,
        offset: null,
        offsetDays: null,
        offsetHours: null,
        offsetMinutes: null,
        offsetSign: null,
        timezone: null,
        currentDate: new Date().toISOString(),
        currentDateFormatted: new Date().toLocaleString(),
      })
    } finally {
      setLoading(false)
    }
  }

  async function updateCurrentDate() {
    try {
      const data = await getDateConfig()
      if (dateConfig) {
        setDateConfig({ ...dateConfig, currentDate: data.currentDate, currentDateFormatted: data.currentDateFormatted })
      }
    } catch (error) {
      // Silently fail for current date updates
    }
  }

  async function loadRuntimeConfig() {
    try {
      const response = await fetch('/api/status')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      if (data.runtimeConfig) {
        setRuntimeConfig(data.runtimeConfig)
      } else {
        // Fallback if runtimeConfig is not in response
        setRuntimeConfig({
          mockifyerEnabled: false,
          recordMode: false,
          mockDataPath: 'Not set (using default)',
        })
      }
    } catch (error) {
      console.error('Failed to load runtime config:', error)
      // Set default values on error so the UI still renders
      setRuntimeConfig({
        mockifyerEnabled: false,
        recordMode: false,
        mockDataPath: 'Not set (using default)',
      })
    }
  }

  async function handleSaveDateConfig() {
    setSaving(true)
    isEditingRef.current = true
    try {
      const updateData: any = {
        enabled: dateEnabled,
      }

      if (dateEnabled) {
        if (fixedDate) {
          updateData.fixedDate = fixedDate
        } else {
          updateData.offsetDays = parseInt(offsetDays) || 0
          updateData.offsetHours = parseInt(offsetHours) || 0
          updateData.offsetMinutes = parseInt(offsetMinutes) || 0
          updateData.offsetSign = offsetSign
        }
        if (timezone) {
          updateData.timezone = timezone
        }
      }

      const updated = await updateDateConfig(updateData)
      setDateConfig(updated)
      toast({
        title: 'Success',
        description: 'Date configuration updated successfully',
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
      setTimeout(() => {
        isEditingRef.current = false
      }, 500)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure Mockifyer behavior, date manipulation, and view configuration reference
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="date" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="date" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Date Configuration
          </TabsTrigger>
          <TabsTrigger value="reference" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Config Reference
          </TabsTrigger>
          <TabsTrigger value="runtime" className="flex items-center gap-2">
            <ToggleRight className="h-4 w-4" />
            Runtime Settings
          </TabsTrigger>
        </TabsList>

        {/* Date Configuration Tab */}
        <TabsContent value="date" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Date Configuration</CardTitle>
              <CardDescription>
                Configure fixed dates, offsets, and timezones to test time-dependent functionality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  {/* Current Date Display */}
                  <div className="p-4 bg-muted rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">Current Date (Manipulated)</p>
                        <p className="text-2xl font-bold">
                          {dateConfig?.currentDateFormatted || new Date().toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {dateConfig?.currentDate || new Date().toISOString()}
                        </p>
                      </div>
                      <Badge variant={dateEnabled ? 'default' : 'outline'}>
                        {dateEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>

                  {/* Enable/Disable Toggle */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="dateEnabled"
                      checked={dateEnabled}
                      onChange={(e) => setDateEnabled(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <label htmlFor="dateEnabled" className="text-sm font-medium">
                      Enable Date Manipulation
                    </label>
                  </div>

                  {dateEnabled && (
                    <>
                      {/* Fixed Date */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Fixed Date (ISO format)</label>
                        <Input
                          type="datetime-local"
                          value={fixedDate ? new Date(fixedDate).toISOString().slice(0, 16) : ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              const date = new Date(e.target.value)
                              setFixedDate(date.toISOString())
                            } else {
                              setFixedDate('')
                            }
                          }}
                          placeholder="YYYY-MM-DDTHH:mm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Set a fixed date that will always be returned by getCurrentDate()
                        </p>
                      </div>

                      <div className="text-center text-sm text-muted-foreground">OR</div>

                      {/* Time Offset */}
                      <div className="space-y-4">
                        <label className="text-sm font-medium">Time Offset</label>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Sign</label>
                            <select
                              value={offsetSign}
                              onChange={(e) => setOffsetSign(e.target.value as '+' | '-')}
                              className="w-full h-10 rounded-md border border-input bg-background px-3"
                            >
                              <option value="+">+</option>
                              <option value="-">-</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Days</label>
                            <Input
                              type="number"
                              value={offsetDays}
                              onChange={(e) => setOffsetDays(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Hours</label>
                            <Input
                              type="number"
                              value={offsetHours}
                              onChange={(e) => setOffsetHours(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Minutes</label>
                            <Input
                              type="number"
                              value={offsetMinutes}
                              onChange={(e) => setOffsetMinutes(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setOffsetDays('1')
                              setOffsetHours('0')
                              setOffsetMinutes('0')
                            }}
                          >
                            +1 Day
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setOffsetDays('0')
                              setOffsetHours('1')
                              setOffsetMinutes('0')
                            }}
                          >
                            +1 Hour
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setOffsetDays('7')
                              setOffsetHours('0')
                              setOffsetMinutes('0')
                            }}
                          >
                            +1 Week
                          </Button>
                        </div>
                      </div>

                      {/* Timezone */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Timezone</label>
                        <Input
                          list="timezones"
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          placeholder="UTC"
                        />
                        <datalist id="timezones">
                          {IANA_TIMEZONES.map((tz) => (
                            <option key={tz} value={tz} />
                          ))}
                        </datalist>
                        <p className="text-xs text-muted-foreground">
                          IANA timezone identifier (e.g., UTC, America/New_York)
                        </p>
                      </div>
                    </>
                  )}

                  <Button onClick={handleSaveDateConfig} disabled={saving} className="w-full">
                    {saving ? 'Saving...' : 'Save Date Configuration'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Config Reference Tab */}
        <TabsContent value="reference" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration Reference</CardTitle>
              <CardDescription>
                Complete reference for Mockifyer configuration options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="setup">
                <TabsList>
                  <TabsTrigger value="setup">Setup Options</TabsTrigger>
                  <TabsTrigger value="env">Environment Variables</TabsTrigger>
                  <TabsTrigger value="date">Date Configuration</TabsTrigger>
                </TabsList>

                <TabsContent value="setup" className="space-y-4 mt-4">
                  <div>
                    <h4 className="font-semibold mb-2">setupMockifyer Options</h4>
                    <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
{`{
  mockDataPath: string;        // Path to store/load mock files
  recordMode?: boolean;         // Enable recording mode
  failOnMissingMock?: boolean;  // Fail if no mock found
  useGlobalAxios?: boolean;     // Patch global axios instance
  useGlobalFetch?: boolean;     // Patch global fetch
  generateTests?: {             // Auto-generate tests
    enabled: boolean;
    framework: 'jest' | 'vitest' | 'mocha';
    outputPath: string;
  }
}`}
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="env" className="space-y-4 mt-4">
                  <div>
                    <h4 className="font-semibold mb-2">Environment Variables</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <code className="bg-muted px-2 py-1 rounded">MOCKIFYER_ENABLED</code>
                        <p className="text-muted-foreground mt-1">Enable/disable Mockifyer</p>
                      </div>
                      <div>
                        <code className="bg-muted px-2 py-1 rounded">MOCKIFYER_PATH</code>
                        <p className="text-muted-foreground mt-1">Path to mock data directory</p>
                      </div>
                      <div>
                        <code className="bg-muted px-2 py-1 rounded">MOCKIFYER_RECORD</code>
                        <p className="text-muted-foreground mt-1">Enable recording mode</p>
                      </div>
                      <div>
                        <code className="bg-muted px-2 py-1 rounded">MOCKIFYER_DATE</code>
                        <p className="text-muted-foreground mt-1">Fixed date (ISO format)</p>
                      </div>
                      <div>
                        <code className="bg-muted px-2 py-1 rounded">MOCKIFYER_DATE_OFFSET</code>
                        <p className="text-muted-foreground mt-1">Date offset in milliseconds</p>
                      </div>
                      <div>
                        <code className="bg-muted px-2 py-1 rounded">MOCKIFYER_TIMEZONE</code>
                        <p className="text-muted-foreground mt-1">IANA timezone identifier</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="date" className="space-y-4 mt-4">
                  <div>
                    <h4 className="font-semibold mb-2">Date Manipulation</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Use <code className="bg-muted px-1 rounded">getCurrentDate()</code> from{' '}
                      <code className="bg-muted px-1 rounded">@sgedda/mockifyer-core</code> instead of{' '}
                      <code className="bg-muted px-1 rounded">new Date()</code> for date manipulation to work.
                    </p>
                    <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
{`import { getCurrentDate } from '@sgedda/mockifyer-core';

// Use this instead of new Date()
const currentDate = getCurrentDate();`}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Runtime Settings Tab */}
        <TabsContent value="runtime" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Runtime Settings</CardTitle>
              <CardDescription>
                View current Mockifyer runtime configuration (read-only)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {runtimeConfig ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-md border">
                    <div>
                      <p className="text-sm font-semibold">Mockifyer Enabled</p>
                      <p className="text-xs text-muted-foreground">
                        Controlled by MOCKIFYER_ENABLED environment variable
                      </p>
                    </div>
                    <Badge variant={runtimeConfig.mockifyerEnabled ? 'default' : 'outline'}>
                      {runtimeConfig.mockifyerEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-md border">
                    <div>
                      <p className="text-sm font-semibold">Record Mode</p>
                      <p className="text-xs text-muted-foreground">
                        Controlled by MOCKIFYER_RECORD environment variable
                      </p>
                    </div>
                    <Badge variant={runtimeConfig.recordMode ? 'default' : 'outline'}>
                      {runtimeConfig.recordMode ? 'Recording' : 'Replay Only'}
                    </Badge>
                  </div>

                  <div className="p-3 rounded-md border">
                    <p className="text-sm font-semibold mb-1">Mock Data Path</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                      {runtimeConfig.mockDataPath}
                    </code>
                    <p className="text-xs text-muted-foreground mt-1">
                      Controlled by MOCKIFYER_PATH environment variable
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}

              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm font-semibold mb-2">Note</p>
                <p className="text-xs text-muted-foreground">
                  Runtime settings are controlled by environment variables and cannot be changed from this interface.
                  To modify these settings, update your <code className="bg-background px-1 rounded">.env</code> file
                  and restart the server.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

