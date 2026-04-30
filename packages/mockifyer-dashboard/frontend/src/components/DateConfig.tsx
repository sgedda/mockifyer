import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import {
  getDateConfig,
  updateDateConfig,
  getScenarioConfig,
  type DateConfig,
} from '@/lib/api'
import { Calendar, Clock, Globe, RotateCcw } from 'lucide-react'

// Comprehensive list of IANA timezones
const IANA_TIMEZONES = [
  'Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa', 'Africa/Algiers', 'Africa/Asmara',
  'Africa/Bamako', 'Africa/Bangui', 'Africa/Banjul', 'Africa/Bissau', 'Africa/Blantyre',
  'Africa/Brazzaville', 'Africa/Bujumbura', 'Africa/Cairo', 'Africa/Casablanca', 'Africa/Ceuta',
  'Africa/Conakry', 'Africa/Dakar', 'Africa/Dar_es_Salaam', 'Africa/Djibouti', 'Africa/Douala',
  'Africa/El_Aaiun', 'Africa/Freetown', 'Africa/Gaborone', 'Africa/Harare', 'Africa/Johannesburg',
  'Africa/Juba', 'Africa/Kampala', 'Africa/Khartoum', 'Africa/Kigali', 'Africa/Kinshasa',
  'Africa/Lagos', 'Africa/Libreville', 'Africa/Lome', 'Africa/Luanda', 'Africa/Lubumbashi',
  'Africa/Lusaka', 'Africa/Malabo', 'Africa/Maputo', 'Africa/Maseru', 'Africa/Mbabane',
  'Africa/Mogadishu', 'Africa/Monrovia', 'Africa/Nairobi', 'Africa/Ndjamena', 'Africa/Niamey',
  'Africa/Nouakchott', 'Africa/Ouagadougou', 'Africa/Porto-Novo', 'Africa/Sao_Tome', 'Africa/Tripoli',
  'Africa/Tunis', 'Africa/Windhoek',
  'America/Adak', 'America/Anchorage', 'America/Anguilla', 'America/Antigua', 'America/Araguaina',
  'America/Argentina/Buenos_Aires', 'America/Argentina/Catamarca', 'America/Argentina/Cordoba',
  'America/Argentina/Jujuy', 'America/Argentina/La_Rioja', 'America/Argentina/Mendoza',
  'America/Argentina/Rio_Gallegos', 'America/Argentina/Salta', 'America/Argentina/San_Juan',
  'America/Argentina/San_Luis', 'America/Argentina/Tucuman', 'America/Argentina/Ushuaia',
  'America/Aruba', 'America/Asuncion', 'America/Atikokan', 'America/Bahia', 'America/Bahia_Banderas',
  'America/Barbados', 'America/Belem', 'America/Belize', 'America/Blanc-Sablon', 'America/Boa_Vista',
  'America/Bogota', 'America/Boise', 'America/Cambridge_Bay', 'America/Campo_Grande', 'America/Cancun',
  'America/Caracas', 'America/Cayenne', 'America/Cayman', 'America/Chicago', 'America/Chihuahua',
  'America/Costa_Rica', 'America/Creston', 'America/Cuiaba', 'America/Curacao', 'America/Danmarkshavn',
  'America/Dawson', 'America/Dawson_Creek', 'America/Denver', 'America/Detroit', 'America/Dominica',
  'America/Edmonton', 'America/Eirunepe', 'America/El_Salvador', 'America/Fort_Nelson', 'America/Fortaleza',
  'America/Glace_Bay', 'America/Godthab', 'America/Goose_Bay', 'America/Grand_Turk', 'America/Grenada',
  'America/Guadeloupe', 'America/Guatemala', 'America/Guayaquil', 'America/Guyana', 'America/Halifax',
  'America/Havana', 'America/Hermosillo', 'America/Indiana/Indianapolis', 'America/Indiana/Knox',
  'America/Indiana/Marengo', 'America/Indiana/Petersburg', 'America/Indiana/Tell_City', 'America/Indiana/Vevay',
  'America/Indiana/Vincennes', 'America/Indiana/Winamac', 'America/Inuvik', 'America/Iqaluit',
  'America/Jamaica', 'America/Juneau', 'America/Kentucky/Louisville', 'America/Kentucky/Monticello',
  'America/Kralendijk', 'America/La_Paz', 'America/Lima', 'America/Los_Angeles', 'America/Lower_Princes',
  'America/Maceio', 'America/Managua', 'America/Manaus', 'America/Marigot', 'America/Martinique',
  'America/Matamoros', 'America/Mazatlan', 'America/Menominee', 'America/Merida', 'America/Metlakatla',
  'America/Mexico_City', 'America/Miquelon', 'America/Moncton', 'America/Monterrey', 'America/Montevideo',
  'America/Montserrat', 'America/Nassau', 'America/New_York', 'America/Nipigon', 'America/Nome',
  'America/Noronha', 'America/North_Dakota/Beulah', 'America/North_Dakota/Center', 'America/North_Dakota/New_Salem',
  'America/Ojinaga', 'America/Panama', 'America/Pangnirtung', 'America/Paramaribo', 'America/Phoenix',
  'America/Port-au-Prince', 'America/Port_of_Spain', 'America/Porto_Velho', 'America/Puerto_Rico',
  'America/Punta_Arenas', 'America/Rainy_River', 'America/Rankin_Inlet', 'America/Recife', 'America/Regina',
  'America/Resolute', 'America/Rio_Branco', 'America/Santarem', 'America/Santiago', 'America/Santo_Domingo',
  'America/Sao_Paulo', 'America/Scoresbysund', 'America/Sitka', 'America/St_Barthelemy', 'America/St_Johns',
  'America/St_Kitts', 'America/St_Lucia', 'America/St_Thomas', 'America/St_Vincent', 'America/Swift_Current',
  'America/Tegucigalpa', 'America/Thule', 'America/Thunder_Bay', 'America/Tijuana', 'America/Toronto',
  'America/Tortola', 'America/Vancouver', 'America/Whitehorse', 'America/Winnipeg', 'America/Yakutat',
  'America/Yellowknife',
  'Antarctica/Casey', 'Antarctica/Davis', 'Antarctica/DumontDUrville', 'Antarctica/Macquarie',
  'Antarctica/Mawson', 'Antarctica/McMurdo', 'Antarctica/Palmer', 'Antarctica/Rothera', 'Antarctica/Syowa',
  'Antarctica/Troll', 'Antarctica/Vostok',
  'Arctic/Longyearbyen',
  'Asia/Aden', 'Asia/Almaty', 'Asia/Amman', 'Asia/Anadyr', 'Asia/Aqtau', 'Asia/Aqtobe', 'Asia/Ashgabat',
  'Asia/Atyrau', 'Asia/Baghdad', 'Asia/Bahrain', 'Asia/Baku', 'Asia/Bangkok', 'Asia/Barnaul', 'Asia/Beirut',
  'Asia/Bishkek', 'Asia/Brunei', 'Asia/Chita', 'Asia/Choibalsan', 'Asia/Colombo', 'Asia/Damascus', 'Asia/Dhaka',
  'Asia/Dili', 'Asia/Dubai', 'Asia/Dushanbe', 'Asia/Famagusta', 'Asia/Gaza', 'Asia/Hebron', 'Asia/Ho_Chi_Minh',
  'Asia/Hong_Kong', 'Asia/Hovd', 'Asia/Irkutsk', 'Asia/Jakarta', 'Asia/Jayapura', 'Asia/Jerusalem', 'Asia/Kabul',
  'Asia/Kamchatka', 'Asia/Karachi', 'Asia/Kathmandu', 'Asia/Khandyga', 'Asia/Kolkata', 'Asia/Krasnoyarsk',
  'Asia/Kuala_Lumpur', 'Asia/Kuching', 'Asia/Kuwait', 'Asia/Macau', 'Asia/Magadan', 'Asia/Makassar', 'Asia/Manila',
  'Asia/Muscat', 'Asia/Nicosia', 'Asia/Novokuznetsk', 'Asia/Novosibirsk', 'Asia/Omsk', 'Asia/Oral', 'Asia/Phnom_Penh',
  'Asia/Pontianak', 'Asia/Pyongyang', 'Asia/Qatar', 'Asia/Qostanay', 'Asia/Qyzylorda', 'Asia/Riyadh', 'Asia/Sakhalin',
  'Asia/Samarkand', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Srednekolymsk', 'Asia/Taipei', 'Asia/Tashkent',
  'Asia/Tbilisi', 'Asia/Tehran', 'Asia/Thimphu', 'Asia/Tokyo', 'Asia/Tomsk', 'Asia/Ulaanbaatar', 'Asia/Urumqi',
  'Asia/Ust-Nera', 'Asia/Vientiane', 'Asia/Vladivostok', 'Asia/Yakutsk', 'Asia/Yangon', 'Asia/Yekaterinburg',
  'Asia/Yerevan',
  'Atlantic/Azores', 'Atlantic/Bermuda', 'Atlantic/Canary', 'Atlantic/Cape_Verde', 'Atlantic/Faroe',
  'Atlantic/Madeira', 'Atlantic/Reykjavik', 'Atlantic/South_Georgia', 'Atlantic/St_Helena', 'Atlantic/Stanley',
  'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Broken_Hill', 'Australia/Currie', 'Australia/Darwin',
  'Australia/Eucla', 'Australia/Hobart', 'Australia/Lindeman', 'Australia/Lord_Howe', 'Australia/Melbourne',
  'Australia/Perth', 'Australia/Sydney',
  'Europe/Amsterdam', 'Europe/Andorra', 'Europe/Astrakhan', 'Europe/Athens', 'Europe/Belgrade', 'Europe/Berlin',
  'Europe/Bratislava', 'Europe/Brussels', 'Europe/Bucharest', 'Europe/Budapest', 'Europe/Busingen', 'Europe/Chisinau',
  'Europe/Copenhagen', 'Europe/Dublin', 'Europe/Gibraltar', 'Europe/Guernsey', 'Europe/Helsinki', 'Europe/Isle_of_Man',
  'Europe/Istanbul', 'Europe/Jersey', 'Europe/Kaliningrad', 'Europe/Kiev', 'Europe/Kirov', 'Europe/Lisbon',
  'Europe/Ljubljana', 'Europe/London', 'Europe/Luxembourg', 'Europe/Madrid', 'Europe/Malta', 'Europe/Mariehamn',
  'Europe/Minsk', 'Europe/Monaco', 'Europe/Moscow', 'Europe/Oslo', 'Europe/Paris', 'Europe/Podgorica', 'Europe/Prague',
  'Europe/Riga', 'Europe/Rome', 'Europe/Samara', 'Europe/San_Marino', 'Europe/Sarajevo', 'Europe/Saratov',
  'Europe/Simferopol', 'Europe/Skopje', 'Europe/Sofia', 'Europe/Stockholm', 'Europe/Tallinn', 'Europe/Tirane',
  'Europe/Ulyanovsk', 'Europe/Uzhgorod', 'Europe/Vaduz', 'Europe/Vatican', 'Europe/Vienna', 'Europe/Vilnius',
  'Europe/Volgograd', 'Europe/Warsaw', 'Europe/Zagreb', 'Europe/Zaporozhye', 'Europe/Zurich',
  'Indian/Antananarivo', 'Indian/Chagos', 'Indian/Christmas', 'Indian/Cocos', 'Indian/Comoro', 'Indian/Kerguelen',
  'Indian/Mahe', 'Indian/Maldives', 'Indian/Mauritius', 'Indian/Mayotte', 'Indian/Reunion',
  'Pacific/Apia', 'Pacific/Auckland', 'Pacific/Bougainville', 'Pacific/Chatham', 'Pacific/Chuuk', 'Pacific/Easter',
  'Pacific/Efate', 'Pacific/Enderbury', 'Pacific/Fakaofo', 'Pacific/Fiji', 'Pacific/Funafuti', 'Pacific/Galapagos',
  'Pacific/Gambier', 'Pacific/Guadalcanal', 'Pacific/Guam', 'Pacific/Honolulu', 'Pacific/Kiritimati', 'Pacific/Kosrae',
  'Pacific/Kwajalein', 'Pacific/Majuro', 'Pacific/Marquesas', 'Pacific/Midway', 'Pacific/Nauru', 'Pacific/Niue',
  'Pacific/Norfolk', 'Pacific/Noumea', 'Pacific/Pago_Pago', 'Pacific/Palau', 'Pacific/Pitcairn', 'Pacific/Pohnpei',
  'Pacific/Port_Moresby', 'Pacific/Rarotonga', 'Pacific/Saipan', 'Pacific/Tahiti', 'Pacific/Tarawa', 'Pacific/Tongatapu',
  'Pacific/Wake', 'Pacific/Wallis',
  'UTC'
].sort()

export default function DateConfig() {
  const [fixedDate, setFixedDate] = useState('')
  const [offset, setOffset] = useState('')
  const [offsetDays, setOffsetDays] = useState('')
  const [offsetHours, setOffsetHours] = useState('')
  const [offsetMinutes, setOffsetMinutes] = useState('')
  const [offsetSeconds, setOffsetSeconds] = useState('')
  const [timezone, setTimezone] = useState('')
  const [timezoneSearch, setTimezoneSearch] = useState('')
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false)
  const [currentDate, setCurrentDate] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState<string>('')
  const [availableScenarios, setAvailableScenarios] = useState<string[]>([])
  const [configSource, setConfigSource] = useState<DateConfig['configSource']>()
  const [mode, setMode] = useState<'fixed' | 'offset' | 'timezone' | 'none'>('none')
  const { toast } = useToast()
  const isEditingRef = useRef(false)
  const timezoneInputRef = useRef<HTMLInputElement>(null)
  const timezoneDropdownRef = useRef<HTMLDivElement>(null)

  // Convert offset components to milliseconds
  function calculateOffsetFromComponents(): number {
    const days = parseInt(offsetDays) || 0
    const hours = parseInt(offsetHours) || 0
    const minutes = parseInt(offsetMinutes) || 0
    const seconds = parseInt(offsetSeconds) || 0
    // Calculate total milliseconds - negative days will naturally make the total negative
    return (days * 24 * 60 * 60 * 1000) + 
           (hours * 60 * 60 * 1000) + 
           (minutes * 60 * 1000) + 
           (seconds * 1000)
  }

  // Convert milliseconds to offset components
  function setOffsetFromMilliseconds(ms: number) {
    const isNegative = ms < 0
    const totalSeconds = Math.floor(Math.abs(ms) / 1000)
    const days = Math.floor(totalSeconds / (24 * 60 * 60))
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60))
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60)
    const seconds = totalSeconds % 60
    
    setOffsetDays(isNegative ? `-${days}` : (days > 0 ? String(days) : ''))
    setOffsetHours(hours > 0 ? String(hours) : '')
    setOffsetMinutes(minutes > 0 ? String(minutes) : '')
    setOffsetSeconds(seconds > 0 ? String(seconds) : '')
  }

  useEffect(() => {
    void (async () => {
      try {
        const sc = await getScenarioConfig()
        setAvailableScenarios(sc.availableScenarios)
        setSelectedScenario(sc.currentScenario)
      } catch (e) {
        console.error('Failed to load scenarios:', e)
      }
    })()
  }, [])

  const loadDateConfig = useCallback(async () => {
    try {
      setLoading(true)
      const config = await getDateConfig(selectedScenario)
      setCurrentDate(config.currentDate)
      setConfigSource(config.configSource)

      // Only update form fields if user is not currently editing
      if (!isEditingRef.current) {
        if (config.dateManipulation) {
          if (config.dateManipulation.fixedDate) {
            setFixedDate(config.dateManipulation.fixedDate)
            setMode('fixed')
          } else if (
            config.dateManipulation.offset !== undefined &&
            config.dateManipulation.offset !== null
          ) {
            const offsetMs = config.dateManipulation.offset
            setOffset(String(offsetMs))
            setOffsetFromMilliseconds(offsetMs)
            setMode('offset')
          }
          if (config.dateManipulation.timezone) {
            setTimezone(config.dateManipulation.timezone)
          }
          const dm = config.dateManipulation
          if (
            dm.timezone &&
            !dm.fixedDate &&
            (dm.offset === undefined || dm.offset === null)
          ) {
            setMode('timezone')
          }
        } else {
          setMode('none')
          setFixedDate('')
          setOffset('')
          setOffsetDays('')
          setOffsetHours('')
          setOffsetMinutes('')
          setOffsetSeconds('')
          setTimezone('')
          setTimezoneSearch('')
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load date config'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedScenario, toast])

  useEffect(() => {
    if (!selectedScenario) {
      return
    }
    void loadDateConfig()
  }, [selectedScenario, loadDateConfig])

  useEffect(() => {
    if (!selectedScenario) {
      return
    }
    const interval = setInterval(() => {
      if (!isEditingRef.current) {
        void updateCurrentDate()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [selectedScenario])

  async function updateCurrentDate() {
    try {
      const config = await getDateConfig(selectedScenario)
      setCurrentDate(config.currentDate)
    } catch (error) {
      // Silently fail - don't show error toast for background updates
      console.error('Failed to update current date:', error)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      
      let updateData: any = {}
      
      if (mode === 'fixed' && fixedDate.trim()) {
        updateData.fixedDate = fixedDate.trim()
        updateData.offset = null
      } else if (mode === 'offset') {
        // Use milliseconds input if provided, otherwise calculate from components
        let offsetNum: number
        if (offset.trim()) {
          offsetNum = parseInt(offset.trim(), 10)
          if (isNaN(offsetNum)) {
            throw new Error('Offset must be a number (milliseconds)')
          }
        } else {
          offsetNum = calculateOffsetFromComponents()
        }
        updateData.offset = offsetNum
        updateData.fixedDate = null
      } else if (mode === 'timezone' && timezone.trim()) {
        // Validate timezone is in the IANA timezone list
        if (!IANA_TIMEZONES.includes(timezone.trim())) {
          throw new Error(`Invalid timezone: "${timezone}". Please select a valid IANA timezone from the list.`)
        }
        updateData.timezone = timezone.trim()
      } else if (mode === 'none') {
        updateData.fixedDate = null
        updateData.offset = null
        updateData.timezone = null
      }

      const result = await updateDateConfig({ ...updateData, scenario: selectedScenario })
      setCurrentDate(result.currentDate)
      setConfigSource(result.configSource)
      isEditingRef.current = false // Allow config reload after save
      toast({
        title: 'Success',
        description: 'Date manipulation updated successfully',
      })
      await loadDateConfig()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update date config',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    try {
      setSaving(true)
      const cleared = await updateDateConfig({
        fixedDate: null,
        offset: null,
        timezone: null,
        scenario: selectedScenario,
      })
      setConfigSource(cleared.configSource)
      setFixedDate('')
      setOffset('')
      setOffsetDays('')
      setOffsetHours('')
      setOffsetMinutes('')
      setOffsetSeconds('')
      setTimezone('')
      setTimezoneSearch('')
      setMode('none')
      toast({
        title: 'Success',
        description: 'Date manipulation cleared',
      })
      await loadDateConfig()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to clear date config',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  function formatDate(dateString: string): string {
    try {
      const date = new Date(dateString)
      return date.toLocaleString()
    } catch {
      return dateString
    }
  }

  if (!selectedScenario || loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading date configuration...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Date Manipulation</CardTitle>
          <CardDescription>
            Manipulate dates returned by <code className="text-xs bg-muted px-1 py-0.5 rounded">getCurrentDate()</code> for testing time-dependent functionality. Settings apply to the selected scenario only (runtime uses the active scenario from{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">scenario-config.json</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="date-scenario" className="text-sm font-medium">
              Edit dates for scenario
            </label>
            <select
              id="date-scenario"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              disabled={saving}
            >
              {availableScenarios.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Saved to{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">{`${selectedScenario}/date-config.json`}</code>{' '}
              under your mock-data folder.
              {configSource === 'legacy' && (
                <span className="mt-1 block">
                  Showing legacy root <code className="rounded bg-muted px-1 py-0.5 text-xs">date-config.json</code>{' '}
                  until you save for this scenario.
                </span>
              )}
            </p>
          </div>

          {/* Current Date Display */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Current Date</span>
            </div>
            <div className="text-lg font-mono text-primary">
              {formatDate(currentDate)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              This is the date that <code className="bg-background px-1 py-0.5 rounded">getCurrentDate()</code> will return
            </div>
          </div>

          {/* Fixed Date */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <label className="text-sm font-medium">Fixed Date</label>
            </div>
            <Input
              type="datetime-local"
              value={fixedDate ? (() => {
                try {
                  const date = new Date(fixedDate)
                  // Convert to local datetime string for datetime-local input
                  const year = date.getFullYear()
                  const month = String(date.getMonth() + 1).padStart(2, '0')
                  const day = String(date.getDate()).padStart(2, '0')
                  const hours = String(date.getHours()).padStart(2, '0')
                  const minutes = String(date.getMinutes()).padStart(2, '0')
                  return `${year}-${month}-${day}T${hours}:${minutes}`
                } catch {
                  return ''
                }
              })() : ''}
              onChange={(e) => {
                isEditingRef.current = true
                const value = e.target.value
                if (value) {
                  // Convert local datetime to ISO string
                  const localDate = new Date(value)
                  setFixedDate(localDate.toISOString())
                  setMode('fixed')
                } else {
                  setFixedDate('')
                }
                // Reset editing flag after a delay
                setTimeout(() => {
                  isEditingRef.current = false
                }, 1000)
              }}
              onFocus={() => {
                isEditingRef.current = true
              }}
              onBlur={() => {
                setTimeout(() => {
                  isEditingRef.current = false
                }, 500)
              }}
              placeholder="Select a fixed date"
              disabled={saving}
            />
            <Input
              type="text"
              value={fixedDate}
              onChange={(e) => {
                isEditingRef.current = true
                setFixedDate(e.target.value)
                if (e.target.value) setMode('fixed')
                // Reset editing flag after a delay
                setTimeout(() => {
                  isEditingRef.current = false
                }, 1000)
              }}
              onFocus={() => {
                isEditingRef.current = true
              }}
              onBlur={() => {
                setTimeout(() => {
                  isEditingRef.current = false
                }, 500)
              }}
              placeholder="Or enter ISO 8601 format (e.g., 2024-12-25T00:00:00.000Z)"
              className="font-mono text-xs"
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Set a fixed date that will always be returned. All dates will be relative to this fixed date.
            </p>
          </div>

          {/* Offset */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              <label className="text-sm font-medium">Time Offset</label>
            </div>
            
            {/* Human-friendly offset inputs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Days</label>
                <Input
                  type="number"
                  value={offsetDays}
                  onChange={(e) => {
                    isEditingRef.current = true
                    setOffsetDays(e.target.value)
                    const ms = calculateOffsetFromComponents()
                    setOffset(String(ms))
                    if (e.target.value || offsetHours || offsetMinutes || offsetSeconds) {
                      setMode('offset')
                    }
                    setTimeout(() => {
                      isEditingRef.current = false
                    }, 1000)
                  }}
                  onFocus={() => {
                    isEditingRef.current = true
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      isEditingRef.current = false
                    }, 500)
                  }}
                  placeholder="0"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Hours</label>
                <Input
                  type="number"
                  value={offsetHours}
                  onChange={(e) => {
                    isEditingRef.current = true
                    setOffsetHours(e.target.value)
                    const ms = calculateOffsetFromComponents()
                    setOffset(String(ms))
                    if (offsetDays || e.target.value || offsetMinutes || offsetSeconds) {
                      setMode('offset')
                    }
                    setTimeout(() => {
                      isEditingRef.current = false
                    }, 1000)
                  }}
                  onFocus={() => {
                    isEditingRef.current = true
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      isEditingRef.current = false
                    }, 500)
                  }}
                  placeholder="0"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Minutes</label>
                <Input
                  type="number"
                  value={offsetMinutes}
                  onChange={(e) => {
                    isEditingRef.current = true
                    setOffsetMinutes(e.target.value)
                    const ms = calculateOffsetFromComponents()
                    setOffset(String(ms))
                    if (offsetDays || offsetHours || e.target.value || offsetSeconds) {
                      setMode('offset')
                    }
                    setTimeout(() => {
                      isEditingRef.current = false
                    }, 1000)
                  }}
                  onFocus={() => {
                    isEditingRef.current = true
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      isEditingRef.current = false
                    }, 500)
                  }}
                  placeholder="0"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Seconds</label>
                <Input
                  type="number"
                  value={offsetSeconds}
                  onChange={(e) => {
                    isEditingRef.current = true
                    setOffsetSeconds(e.target.value)
                    const ms = calculateOffsetFromComponents()
                    setOffset(String(ms))
                    if (offsetDays || offsetHours || offsetMinutes || e.target.value) {
                      setMode('offset')
                    }
                    setTimeout(() => {
                      isEditingRef.current = false
                    }, 1000)
                  }}
                  onFocus={() => {
                    isEditingRef.current = true
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      isEditingRef.current = false
                    }, 500)
                  }}
                  placeholder="0"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  isEditingRef.current = true
                  setOffsetDays('1')
                  setOffsetHours('0')
                  setOffsetMinutes('0')
                  setOffsetSeconds('0')
                  setOffset(String(24 * 60 * 60 * 1000))
                  setMode('offset')
                  setTimeout(() => {
                    isEditingRef.current = false
                  }, 1000)
                }}
                disabled={saving}
              >
                +1 Day
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  isEditingRef.current = true
                  setOffsetDays('-1')
                  setOffsetHours('0')
                  setOffsetMinutes('0')
                  setOffsetSeconds('0')
                  setOffset(String(-24 * 60 * 60 * 1000))
                  setMode('offset')
                  setTimeout(() => {
                    isEditingRef.current = false
                  }, 1000)
                }}
                disabled={saving}
              >
                -1 Day
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  isEditingRef.current = true
                  setOffsetDays('7')
                  setOffsetHours('0')
                  setOffsetMinutes('0')
                  setOffsetSeconds('0')
                  setOffset(String(7 * 24 * 60 * 60 * 1000))
                  setMode('offset')
                  setTimeout(() => {
                    isEditingRef.current = false
                  }, 1000)
                }}
                disabled={saving}
              >
                +1 Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  isEditingRef.current = true
                  setOffsetHours('1')
                  setOffsetDays('0')
                  setOffsetMinutes('0')
                  setOffsetSeconds('0')
                  setOffset(String(60 * 60 * 1000))
                  setMode('offset')
                  setTimeout(() => {
                    isEditingRef.current = false
                  }, 1000)
                }}
                disabled={saving}
              >
                +1 Hour
              </Button>
            </div>

            {/* Milliseconds input (advanced) */}
            <div className="space-y-1 pt-2 border-t">
              <label className="text-xs text-muted-foreground">Milliseconds (advanced)</label>
              <Input
                type="number"
                value={offset}
                onChange={(e) => {
                  isEditingRef.current = true
                  const value = e.target.value
                  setOffset(value)
                  if (value) {
                    const ms = parseInt(value, 10)
                    if (!isNaN(ms)) {
                      setOffsetFromMilliseconds(ms)
                    }
                    setMode('offset')
                  } else {
                    setOffsetDays('')
                    setOffsetHours('')
                    setOffsetMinutes('')
                    setOffsetSeconds('')
                  }
                  setTimeout(() => {
                    isEditingRef.current = false
                  }, 1000)
                }}
                onFocus={() => {
                  isEditingRef.current = true
                }}
                onBlur={() => {
                  setTimeout(() => {
                    isEditingRef.current = false
                  }, 500)
                }}
                placeholder="Total offset in milliseconds"
                className="font-mono text-xs"
                disabled={saving}
              />
              {offset && (
                <p className="text-xs text-muted-foreground">
                  Total: {parseInt(offset) || 0} ms
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Add or subtract time from the current date. Use negative values for days to subtract time.
            </p>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <label className="text-sm font-medium">Timezone</label>
            </div>
            <div className="relative">
              <Input
                ref={timezoneInputRef}
                type="text"
                value={timezoneSearch || timezone}
                onChange={(e) => {
                  isEditingRef.current = true
                  const value = e.target.value
                  setTimezoneSearch(value)
                  setShowTimezoneDropdown(true)
                  
                  // Validate if the entered value matches a timezone
                  const isValid = IANA_TIMEZONES.includes(value)
                  if (isValid) {
                    setTimezone(value)
                    setMode('timezone')
                  } else if (value === '') {
                    setTimezone('')
                    setMode('none')
                  }
                  
                  setTimeout(() => {
                    isEditingRef.current = false
                  }, 1000)
                }}
                onFocus={() => {
                  isEditingRef.current = true
                  setShowTimezoneDropdown(true)
                }}
                onBlur={() => {
                  // Delay to allow click on dropdown item
                  setTimeout(() => {
                    // If the search value doesn't match a valid timezone, reset it
                    if (timezoneSearch && !IANA_TIMEZONES.includes(timezoneSearch)) {
                      setTimezoneSearch('')
                      if (!timezone) {
                        setMode('none')
                      }
                    } else {
                      setTimezoneSearch('')
                    }
                    setShowTimezoneDropdown(false)
                    isEditingRef.current = false
                  }, 200)
                }}
                placeholder="Search timezone (e.g., America/New_York, Europe/London)"
                disabled={saving}
              />
              {showTimezoneDropdown && (
                <div
                  ref={timezoneDropdownRef}
                  className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-md border bg-card shadow-lg"
                  onMouseDown={(e) => {
                    // Prevent blur when clicking inside dropdown
                    e.preventDefault()
                  }}
                >
                  {IANA_TIMEZONES
                    .filter(tz => 
                      !timezoneSearch || 
                      tz.toLowerCase().includes(timezoneSearch.toLowerCase())
                    )
                    .slice(0, 20)
                    .map((tz) => (
                      <button
                        key={tz}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        onClick={() => {
                          setTimezone(tz)
                          setTimezoneSearch('')
                          setShowTimezoneDropdown(false)
                          setMode('timezone')
                          isEditingRef.current = true
                          setTimeout(() => {
                            isEditingRef.current = false
                          }, 1000)
                        }}
                      >
                        {tz}
                      </button>
                    ))}
                  {IANA_TIMEZONES.filter(tz => 
                    !timezoneSearch || 
                    tz.toLowerCase().includes(timezoneSearch.toLowerCase())
                  ).length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No timezones found
                    </div>
                  )}
                </div>
              )}
            </div>
            {timezone && (
              <div className="text-xs text-muted-foreground">
                Selected: <span className="font-mono text-foreground">{timezone}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Set a timezone for date calculations. Uses IANA timezone database names.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={saving || mode === 'none'}
            >
              Clear Date Manipulation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

