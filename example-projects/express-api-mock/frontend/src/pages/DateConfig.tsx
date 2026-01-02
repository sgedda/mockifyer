import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { getDateConfig, updateDateConfig, type DateConfig } from '@/lib/api'

const IANA_TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Australia/Sydney', 'America/Toronto', 'America/Mexico_City', 'Asia/Dubai',
  'Europe/Moscow', 'America/Sao_Paulo', 'Asia/Kolkata', 'Pacific/Auckland'
]

export default function DateConfigPage() {
  const [config, setConfig] = useState<DateConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fixedDate, setFixedDate] = useState('')
  const [offsetDays, setOffsetDays] = useState('0')
  const [offsetHours, setOffsetHours] = useState('0')
  const [offsetMinutes, setOffsetMinutes] = useState('0')
  const [offsetSign, setOffsetSign] = useState<'+' | '-'>('+')
  const [timezone, setTimezone] = useState('')
  const [enabled, setEnabled] = useState(false)
  const isEditingRef = useRef(false)
  const { toast } = useToast()

  useEffect(() => {
    loadConfig()
    const interval = setInterval(() => {
      if (!isEditingRef.current) {
        updateCurrentDate()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  async function loadConfig() {
    try {
      const data = await getDateConfig()
      setConfig(data)
      setEnabled(data.enabled)
      setFixedDate(data.fixedDate || '')
      setOffsetDays(String(data.offsetDays || 0))
      setOffsetHours(String(data.offsetHours || 0))
      setOffsetMinutes(String(data.offsetMinutes || 0))
      setOffsetSign(data.offsetSign || '+')
      setTimezone(data.timezone || '')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load date configuration',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function updateCurrentDate() {
    try {
      const data = await getDateConfig()
      if (config) {
        setConfig({ ...config, currentDate: data.currentDate, currentDateFormatted: data.currentDateFormatted })
      }
    } catch (error) {
      // Silently fail for current date updates
    }
  }

  async function handleSave() {
    setSaving(true)
    isEditingRef.current = true
    try {
      const updateData: any = {
        enabled,
      }

      if (enabled) {
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
      setConfig(updated)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Date Configuration</CardTitle>
          <CardDescription>
            Configure fixed dates, offsets, and timezones to test time-dependent functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Date Display */}
          {config && (
            <div className="p-4 bg-muted rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Current Date (Manipulated)</p>
                  <p className="text-2xl font-bold">{config.currentDateFormatted}</p>
                  <p className="text-xs text-muted-foreground mt-1">{config.currentDate}</p>
                </div>
                <Badge variant={config.enabled ? 'default' : 'outline'}>
                  {config.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>
          )}

          {/* Enable/Disable Toggle */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="enabled" className="text-sm font-medium">
              Enable Date Manipulation
            </label>
          </div>

          {enabled && (
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

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
