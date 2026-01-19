import { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { getDateConfig, updateDateConfig, getScenarioConfig, setScenario } from '@/lib/api'
import { Calendar, Clock, Globe, RotateCcw, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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

interface DateConfigProps {
  scenario?: string
  onScenarioChange?: (scenario: string) => void
}

export default function DateConfig({ scenario, onScenarioChange }: DateConfigProps) {
  // Ensure scenario is always defined (fallback to 'default' if not provided)
  const currentScenario = scenario || 'default'
  
  const [availableScenarios, setAvailableScenarios] = useState<string[]>([])
  const [switching, setSwitching] = useState(false)
  
  const [fixedDate, setFixedDate] = useState('')
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
  const [mode, setMode] = useState<'fixed' | 'offset' | 'timezone' | 'none'>('none')
  const { toast } = useToast()
  const isEditingRef = useRef(false)
  const timezoneInputRef = useRef<HTMLInputElement>(null)
  const timezoneDropdownRef = useRef<HTMLDivElement>(null)
  
  // Refs to DOM elements to read values directly when saving
  const offsetDaysInputRef = useRef<HTMLInputElement>(null)
  const offsetHoursInputRef = useRef<HTMLInputElement>(null)
  const offsetMinutesInputRef = useRef<HTMLInputElement>(null)
  const offsetSecondsInputRef = useRef<HTMLInputElement>(null)
  const fixedDateInputRef = useRef<HTMLInputElement>(null)
  
  // Refs to store current input values to avoid stale state issues
  const offsetDaysRef = useRef<string>('')
  const offsetHoursRef = useRef<string>('')
  const offsetMinutesRef = useRef<string>('')
  const offsetSecondsRef = useRef<string>('')
  const offsetRef = useRef<string>('')
  const fixedDateRef = useRef<string>('')


  // Convert milliseconds to offset components
  function setOffsetFromMilliseconds(ms: number) {
    const isNegative = ms < 0
    const absMs = Math.abs(ms)
    // Use more precise calculation to avoid rounding errors
    const totalSeconds = Math.floor(absMs / 1000)
    const days = Math.floor(totalSeconds / (24 * 60 * 60))
    const remainingAfterDays = totalSeconds % (24 * 60 * 60)
    const hours = Math.floor(remainingAfterDays / (60 * 60))
    const remainingAfterHours = remainingAfterDays % (60 * 60)
    const minutes = Math.floor(remainingAfterHours / 60)
    const seconds = remainingAfterHours % 60
    
    // Always show days if it's not zero, even if negative
    setOffsetDays(isNegative ? `-${days}` : (days !== 0 ? String(days) : ''))
    setOffsetHours(hours !== 0 ? String(hours) : '')
    setOffsetMinutes(minutes !== 0 ? String(minutes) : '')
    setOffsetSeconds(seconds !== 0 ? String(seconds) : '')
  }


  useEffect(() => {
    loadDateConfig()
    // Refresh current date every second (but don't reload config if user is editing)
    const interval = setInterval(() => {
      if (!isEditingRef.current) {
        updateCurrentDate()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    loadScenarios()
  }, [])

  async function loadScenarios() {
    try {
      const config = await getScenarioConfig()
      const scenarios = (config as any).scenarios || config.availableScenarios || ['default']
      setAvailableScenarios(scenarios)
    } catch (error) {
      console.error('Failed to load scenarios:', error)
    }
  }

  async function handleScenarioChange(newScenario: string) {
    if (newScenario === currentScenario) return
    
    try {
      setSwitching(true)
      await setScenario(newScenario)
      if (onScenarioChange) {
        onScenarioChange(newScenario)
      }
      toast({
        title: 'Success',
        description: `Switched to scenario "${newScenario}"`,
      })
      // Reload date config for the new scenario
      await loadDateConfig()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to switch scenario',
        variant: 'destructive',
      })
    } finally {
      setSwitching(false)
    }
  }

  // Reload date config when scenario changes
  useEffect(() => {
    console.log('[DateConfig] Scenario changed, reloading config:', { scenario, currentScenario })
    // Force reset editing flag when scenario changes to ensure form updates
    isEditingRef.current = false
    // Reset all form fields immediately before loading new config
    setFixedDate('')
    setOffsetDays('')
    setOffsetHours('')
    setOffsetMinutes('')
    setOffsetSeconds('')
    setTimezone('')
    setTimezoneSearch('')
    setMode('none')
    // Clear refs
    fixedDateRef.current = ''
    offsetRef.current = ''
    offsetDaysRef.current = ''
    offsetHoursRef.current = ''
    offsetMinutesRef.current = ''
    offsetSecondsRef.current = ''
    // Now load the new scenario's config
    loadDateConfig()
  }, [scenario, currentScenario])

  async function updateCurrentDate() {
    try {
      const config = await getDateConfig(currentScenario)
      setCurrentDate(config.currentDate)
    } catch (error) {
      // Silently fail - don't show error toast for background updates
      console.error('Failed to update current date:', error)
    }
  }

  async function loadDateConfig() {
    try {
      setLoading(true)
      console.log('[DateConfig] Loading date config for scenario:', currentScenario)
      const config = await getDateConfig(currentScenario)
      console.log('[DateConfig] Loaded config:', { scenario: currentScenario, config })
      setCurrentDate(config.currentDate)
      
      // Always update form fields when loading config (isEditingRef check removed for scenario switching)
      // The scenario change useEffect already resets isEditingRef and clears fields
      if (config.dateManipulation) {
          if (config.dateManipulation.fixedDate) {
            setFixedDate(config.dateManipulation.fixedDate)
            fixedDateRef.current = config.dateManipulation.fixedDate // Update ref
            setMode('fixed')
          } else if (config.dateManipulation.offset !== undefined && config.dateManipulation.offset !== null) {
            const offsetMs = config.dateManipulation.offset
            console.log('[DateConfig] Loading offset:', { offsetMs, calculatedDays: Math.floor(Math.abs(offsetMs) / 1000 / (24 * 60 * 60)) })
            offsetRef.current = String(offsetMs) // Update ref
            setOffsetFromMilliseconds(offsetMs)
            // Also update refs when loading
            const isNegative = offsetMs < 0
            const absMs = Math.abs(offsetMs)
            const totalSeconds = Math.floor(absMs / 1000)
            const days = Math.floor(totalSeconds / (24 * 60 * 60))
            const remainingAfterDays = totalSeconds % (24 * 60 * 60)
            const hours = Math.floor(remainingAfterDays / (60 * 60))
            const remainingAfterHours = remainingAfterDays % (60 * 60)
            const minutes = Math.floor(remainingAfterHours / 60)
            const seconds = remainingAfterHours % 60
            offsetDaysRef.current = isNegative ? `-${days}` : (days !== 0 ? String(days) : '')
            offsetHoursRef.current = hours !== 0 ? String(hours) : ''
            offsetMinutesRef.current = minutes !== 0 ? String(minutes) : ''
            offsetSecondsRef.current = seconds !== 0 ? String(seconds) : ''
            setMode('offset')
          }
          if (config.dateManipulation.timezone) {
            setTimezone(config.dateManipulation.timezone)
            if (mode === 'none') setMode('timezone')
          } else {
            setTimezone('')
            setTimezoneSearch('')
          }
      } else {
        // No dateManipulation property - clear everything
        setMode('none')
        setFixedDate('')
        setOffsetDays('')
        setOffsetHours('')
        setOffsetMinutes('')
        setOffsetSeconds('')
        setTimezone('')
        setTimezoneSearch('')
        // Clear refs too
        fixedDateRef.current = ''
        offsetRef.current = ''
        offsetDaysRef.current = ''
        offsetHoursRef.current = ''
        offsetMinutesRef.current = ''
        offsetSecondsRef.current = ''
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load date config',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      
      // Set editing flag to prevent loadDateConfig from overwriting during save
      isEditingRef.current = true
      
      // CRITICAL: Force React to flush all pending DOM updates before reading
      // This ensures controlled inputs have updated the DOM
      flushSync(() => {
        // Force React to synchronously apply all pending updates
      })
      
      // Small delay to ensure DOM is fully synchronized
      await new Promise(resolve => setTimeout(resolve, 0))
      
      let updateData: any = {}
      
      if (mode === 'fixed') {
        // Read from ref first (updated synchronously in onChange)
        const fixedDateValue = fixedDateRef.current.trim() || fixedDateInputRef.current?.value.trim() || ''
        if (fixedDateValue) {
          updateData.fixedDate = fixedDateValue
          updateData.offset = null
          console.log('[DateConfig] Saving fixed date:', { 
            refValue: fixedDateRef.current,
            domValue: fixedDateInputRef.current?.value,
            finalValue: fixedDateValue
          })
        } else {
          throw new Error('Please enter a fixed date.')
        }
      } else if (mode === 'offset') {
        // Always use component-based calculation if days/hours/minutes/seconds are set
        let offsetNum: number
        
        // CRITICAL: Read from refs FIRST - these are updated synchronously in onChange
        // BEFORE React processes state updates. Refs are updated immediately when onChange fires
        // Then fallback to DOM if refs are empty (defensive)
        const daysValue = offsetDaysRef.current.trim() || offsetDaysInputRef.current?.value?.trim() || ''
        const hoursValue = offsetHoursRef.current.trim() || offsetHoursInputRef.current?.value?.trim() || ''
        const minutesValue = offsetMinutesRef.current.trim() || offsetMinutesInputRef.current?.value?.trim() || ''
        const secondsValue = offsetSecondsRef.current.trim() || offsetSecondsInputRef.current?.value?.trim() || ''
        
        console.log('[DateConfig] Reading values for save:', {
          refValues: {
            days: offsetDaysRef.current,
            hours: offsetHoursRef.current,
            minutes: offsetMinutesRef.current,
            seconds: offsetSecondsRef.current
          },
          domValues: {
            days: offsetDaysInputRef.current?.value,
            hours: offsetHoursInputRef.current?.value,
            minutes: offsetMinutesInputRef.current?.value,
            seconds: offsetSecondsInputRef.current?.value
          },
          stateValues: {
            days: offsetDays,
            hours: offsetHours,
            minutes: offsetMinutes,
            seconds: offsetSeconds
          },
          finalValues: {
            days: daysValue,
            hours: hoursValue,
            minutes: minutesValue,
            seconds: secondsValue
          }
        })
        
        const hasComponents = daysValue || hoursValue || minutesValue || secondsValue
        
        if (hasComponents) {
          // Parse values directly to avoid state timing issues
          const days = daysValue ? parseInt(daysValue, 10) : 0
          const hours = hoursValue ? parseInt(hoursValue, 10) : 0
          const minutes = minutesValue ? parseInt(minutesValue, 10) : 0
          const seconds = secondsValue ? parseInt(secondsValue, 10) : 0
          
          // Validate parsing
          if (daysValue && isNaN(days)) {
            throw new Error(`Invalid days value: "${daysValue}"`)
          }
          if (hoursValue && isNaN(hours)) {
            throw new Error(`Invalid hours value: "${hoursValue}"`)
          }
          if (minutesValue && isNaN(minutes)) {
            throw new Error(`Invalid minutes value: "${minutesValue}"`)
          }
          if (secondsValue && isNaN(seconds)) {
            throw new Error(`Invalid seconds value: "${secondsValue}"`)
          }
          
          // Calculate directly to ensure accuracy
          offsetNum = (days * 24 * 60 * 60 * 1000) + 
                      (hours * 60 * 60 * 1000) + 
                      (minutes * 60 * 1000) + 
                      (seconds * 1000)
          
          console.log('[DateConfig] Saving from components:', { 
            daysValue, hoursValue, minutesValue, secondsValue,
            dom: {
              days: offsetDaysInputRef.current?.value,
              hours: offsetHoursInputRef.current?.value,
              minutes: offsetMinutesInputRef.current?.value,
              seconds: offsetSecondsInputRef.current?.value
            },
            refs: {
              days: offsetDaysRef.current,
              hours: offsetHoursRef.current,
              minutes: offsetMinutesRef.current,
              seconds: offsetSecondsRef.current
            },
            parsed: { days, hours, minutes, seconds },
            calculatedMs: offsetNum,
            calculatedDays: Math.floor(Math.abs(offsetNum) / 1000 / (24 * 60 * 60))
          })
        } else {
          // If no components are set, throw error (milliseconds field removed)
          throw new Error('Please enter an offset value using days, hours, minutes, or seconds.')
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

      console.log('[DateConfig] Saving date config:', { 
        scenario: currentScenario, 
        scenarioType: typeof currentScenario,
        scenarioIsEmpty: currentScenario === '' || currentScenario === null || currentScenario === undefined,
        updateData 
      })
      const result = await updateDateConfig({ ...updateData, scenario: currentScenario })
      console.log('[DateConfig] Save result:', { scenario: currentScenario, result })
      setCurrentDate(result.currentDate)
      const scenarioText = currentScenario ? ` for scenario "${currentScenario}"` : ''
      toast({
        title: 'Success',
        description: `Date manipulation updated successfully${scenarioText}`,
      })
      
      // Update local state to match what we just saved (don't reload from server)
      // This prevents race conditions where loadDateConfig might overwrite user input
      if (mode === 'offset' && updateData.offset !== undefined) {
        // Update the displayed values to match what was saved
        const savedOffset = updateData.offset
        offsetRef.current = String(savedOffset)
        setOffsetFromMilliseconds(savedOffset)
        // Update refs to match what was saved
        const isNegative = savedOffset < 0
        const absMs = Math.abs(savedOffset)
        const totalSeconds = Math.floor(absMs / 1000)
        const days = Math.floor(totalSeconds / (24 * 60 * 60))
        const remainingAfterDays = totalSeconds % (24 * 60 * 60)
        const hours = Math.floor(remainingAfterDays / (60 * 60))
        const remainingAfterHours = remainingAfterDays % (60 * 60)
        const minutes = Math.floor(remainingAfterHours / 60)
        const seconds = remainingAfterHours % 60
        const daysStr = isNegative ? `-${days}` : (days !== 0 ? String(days) : '')
        setOffsetDays(daysStr)
        offsetDaysRef.current = daysStr
        if (offsetDaysInputRef.current) {
          offsetDaysInputRef.current.value = daysStr
        }
        setOffsetHours(hours !== 0 ? String(hours) : '')
        offsetHoursRef.current = hours !== 0 ? String(hours) : ''
        if (offsetHoursInputRef.current) {
          offsetHoursInputRef.current.value = hours !== 0 ? String(hours) : ''
        }
        setOffsetMinutes(minutes !== 0 ? String(minutes) : '')
        offsetMinutesRef.current = minutes !== 0 ? String(minutes) : ''
        if (offsetMinutesInputRef.current) {
          offsetMinutesInputRef.current.value = minutes !== 0 ? String(minutes) : ''
        }
        setOffsetSeconds(seconds !== 0 ? String(seconds) : '')
        offsetSecondsRef.current = seconds !== 0 ? String(seconds) : ''
        if (offsetSecondsInputRef.current) {
          offsetSecondsInputRef.current.value = seconds !== 0 ? String(seconds) : ''
        }
      }
      
      // Reset editing flag after updating local state
      isEditingRef.current = false
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
      await updateDateConfig({ fixedDate: null, offset: null, timezone: null, scenario: currentScenario })
      setFixedDate('')
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
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')
      const second = String(date.getSeconds()).padStart(2, '0')
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`
    } catch {
      return dateString
    }
  }

  if (loading) {
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
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle>Date Manipulation</CardTitle>
              <CardDescription>
                Manipulate dates returned by <code className="text-xs bg-muted px-1 py-0.5 rounded">getCurrentDate()</code> for testing time-dependent functionality.
              </CardDescription>
            </div>
            <div className="ml-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={switching} className="min-w-[150px]">
                    {switching ? 'Switching...' : `Scenario: ${currentScenario}`}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[150px]">
                  {availableScenarios.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      onClick={() => handleScenarioChange(s)}
                      className={s === currentScenario ? 'bg-accent' : ''}
                    >
                      {s}
                      {s === currentScenario && ' ✓'}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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
              ref={fixedDateInputRef}
              type="text"
              value={fixedDate}
              onChange={(e) => {
                    isEditingRef.current = true
                    const newValue = e.target.value
                    setFixedDate(newValue)
                    fixedDateRef.current = newValue // Update ref immediately
                    if (newValue) setMode('fixed')
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
                  ref={offsetDaysInputRef}
                  type="number"
                  value={offsetDays || ''}
                  onChange={(e) => {
                    isEditingRef.current = true
                    const newValue = e.target.value
                    // Update ref immediately (for save handler) - this is synchronous
                    offsetDaysRef.current = newValue
                    
                    // Calculate offset FIRST (before state updates)
                    const days = newValue ? parseInt(newValue, 10) : 0
                    const hours = offsetHoursRef.current ? parseInt(offsetHoursRef.current, 10) : 0
                    const minutes = offsetMinutesRef.current ? parseInt(offsetMinutesRef.current, 10) : 0
                    const seconds = offsetSecondsRef.current ? parseInt(offsetSecondsRef.current, 10) : 0
                    const ms = (days * 24 * 60 * 60 * 1000) + 
                               (hours * 60 * 60 * 1000) + 
                               (minutes * 60 * 1000) + 
                               (seconds * 1000)
                    
                    // Update ref immediately (synchronous)
                    offsetRef.current = String(ms)
                    
                    // Update React state
                    setOffsetDays(newValue)
                    
                    if (newValue || offsetHoursRef.current || offsetMinutesRef.current || offsetSecondsRef.current) {
                      setMode('offset')
                    }
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
                  ref={offsetHoursInputRef}
                  type="number"
                  value={offsetHours || ''}
                  onChange={(e) => {
                    isEditingRef.current = true
                    const newValue = e.target.value
                    // Update ref immediately (synchronous)
                    offsetHoursRef.current = newValue
                    
                    // Calculate FIRST (before state updates)
                    const days = offsetDaysRef.current ? parseInt(offsetDaysRef.current, 10) : 0
                    const hours = newValue ? parseInt(newValue, 10) : 0
                    const minutes = offsetMinutesRef.current ? parseInt(offsetMinutesRef.current, 10) : 0
                    const seconds = offsetSecondsRef.current ? parseInt(offsetSecondsRef.current, 10) : 0
                    const ms = (days * 24 * 60 * 60 * 1000) + 
                               (hours * 60 * 60 * 1000) + 
                               (minutes * 60 * 1000) + 
                               (seconds * 1000)
                    
                    // Update ref immediately
                    offsetRef.current = String(ms)
                    
                    // Update React state
                    setOffsetHours(newValue)
                      
                      if (offsetDaysRef.current || newValue || offsetMinutesRef.current || offsetSecondsRef.current) {
                        setMode('offset')
                      }
                  }}
                  onFocus={() => {
                    isEditingRef.current = true
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      isEditingRef.current = false
                    }, 1000)
                  }}
                  placeholder="0"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Minutes</label>
                <Input
                  ref={offsetMinutesInputRef}
                  type="number"
                  value={offsetMinutes || ''}
                  onChange={(e) => {
                    isEditingRef.current = true
                    const newValue = e.target.value
                    // Update ref immediately (synchronous)
                    offsetMinutesRef.current = newValue
                    
                    // Calculate FIRST (before state updates)
                    const days = offsetDaysRef.current ? parseInt(offsetDaysRef.current, 10) : 0
                    const hours = offsetHoursRef.current ? parseInt(offsetHoursRef.current, 10) : 0
                    const minutes = newValue ? parseInt(newValue, 10) : 0
                    const seconds = offsetSecondsRef.current ? parseInt(offsetSecondsRef.current, 10) : 0
                    const ms = (days * 24 * 60 * 60 * 1000) + 
                               (hours * 60 * 60 * 1000) + 
                               (minutes * 60 * 1000) + 
                               (seconds * 1000)
                    
                    // Update ref immediately
                    offsetRef.current = String(ms)
                    
                      // Update React state - update milliseconds immediately like the buttons do
                      setOffsetMinutes(newValue)
                      
                      if (offsetDaysRef.current || offsetHoursRef.current || newValue || offsetSecondsRef.current) {
                        setMode('offset')
                      }
                  }}
                  onFocus={() => {
                    isEditingRef.current = true
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      isEditingRef.current = false
                    }, 1000)
                  }}
                  placeholder="0"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Seconds</label>
                <Input
                  ref={offsetSecondsInputRef}
                  type="number"
                  value={offsetSeconds || ''}
                  onChange={(e) => {
                    isEditingRef.current = true
                    const newValue = e.target.value
                    // Update ref immediately (synchronous)
                    offsetSecondsRef.current = newValue
                    
                    // Calculate FIRST (before state updates)
                    const days = offsetDaysRef.current ? parseInt(offsetDaysRef.current, 10) : 0
                    const hours = offsetHoursRef.current ? parseInt(offsetHoursRef.current, 10) : 0
                    const minutes = offsetMinutesRef.current ? parseInt(offsetMinutesRef.current, 10) : 0
                    const seconds = newValue ? parseInt(newValue, 10) : 0
                    const ms = (days * 24 * 60 * 60 * 1000) + 
                               (hours * 60 * 60 * 1000) + 
                               (minutes * 60 * 1000) + 
                               (seconds * 1000)
                    
                    // Update ref immediately
                    offsetRef.current = String(ms)
                    
                    // Update React state
                    setOffsetSeconds(newValue)
                      
                      if (offsetDaysRef.current || offsetHoursRef.current || offsetMinutesRef.current || newValue) {
                        setMode('offset')
                      }
                  }}
                  onFocus={() => {
                    isEditingRef.current = true
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      isEditingRef.current = false
                    }, 1000)
                  }}
                  placeholder="0"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Display calculated offset and resulting date/time */}
            {(offsetDays || offsetHours || offsetMinutes || offsetSeconds) && (() => {
              const days = offsetDays ? parseInt(offsetDays, 10) : 0
              const hours = offsetHours ? parseInt(offsetHours, 10) : 0
              const minutes = offsetMinutes ? parseInt(offsetMinutes, 10) : 0
              const seconds = offsetSeconds ? parseInt(offsetSeconds, 10) : 0
              const totalMs = (days * 24 * 60 * 60 * 1000) +
                             (hours * 60 * 60 * 1000) +
                             (minutes * 60 * 1000) +
                             (seconds * 1000)
              const resultDate = new Date(Date.now() + totalMs)
              
              // Format as yyyy-mm-dd HH:mm:ss
              const year = resultDate.getFullYear()
              const month = String(resultDate.getMonth() + 1).padStart(2, '0')
              const day = String(resultDate.getDate()).padStart(2, '0')
              const hour = String(resultDate.getHours()).padStart(2, '0')
              const minute = String(resultDate.getMinutes()).padStart(2, '0')
              const second = String(resultDate.getSeconds()).padStart(2, '0')
              const formattedDate = `${year}-${month}-${day} ${hour}:${minute}:${second}`
              
              return (
                <div className="space-y-1 pt-2 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Total offset:</span>
                    <span className="font-mono">{totalMs.toLocaleString()} ms</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Resulting date:</span>
                    <span className="font-mono">{formattedDate}</span>
                  </div>
                </div>
              )
            })()}

            {/* Quick action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  isEditingRef.current = true
                  // Add 1 day to current values
                  const currentDays = offsetDays ? parseInt(offsetDays, 10) : 0
                  const currentHours = offsetHours ? parseInt(offsetHours, 10) : 0
                  const currentMinutes = offsetMinutes ? parseInt(offsetMinutes, 10) : 0
                  const currentSeconds = offsetSeconds ? parseInt(offsetSeconds, 10) : 0
                  const newDays = currentDays + 1
                  const daysStr = newDays !== 0 ? String(newDays) : ''
                  offsetDaysRef.current = daysStr
                  setOffsetDays(daysStr)
                  setOffsetHours(currentHours !== 0 ? String(currentHours) : '')
                  setOffsetMinutes(currentMinutes !== 0 ? String(currentMinutes) : '')
                  setOffsetSeconds(currentSeconds !== 0 ? String(currentSeconds) : '')
                  const ms = (newDays * 24 * 60 * 60 * 1000) +
                             (currentHours * 60 * 60 * 1000) +
                             (currentMinutes * 60 * 1000) +
                             (currentSeconds * 1000)
                  offsetRef.current = String(ms)
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
                  // Subtract 1 day from current values
                  const currentDays = offsetDays ? parseInt(offsetDays, 10) : 0
                  const currentHours = offsetHours ? parseInt(offsetHours, 10) : 0
                  const currentMinutes = offsetMinutes ? parseInt(offsetMinutes, 10) : 0
                  const currentSeconds = offsetSeconds ? parseInt(offsetSeconds, 10) : 0
                  const newDays = currentDays - 1
                  const daysStr = newDays !== 0 ? String(newDays) : ''
                  offsetDaysRef.current = daysStr
                  setOffsetDays(daysStr)
                  setOffsetHours(currentHours !== 0 ? String(currentHours) : '')
                  setOffsetMinutes(currentMinutes !== 0 ? String(currentMinutes) : '')
                  setOffsetSeconds(currentSeconds !== 0 ? String(currentSeconds) : '')
                  const ms = (newDays * 24 * 60 * 60 * 1000) +
                             (currentHours * 60 * 60 * 1000) +
                             (currentMinutes * 60 * 1000) +
                             (currentSeconds * 1000)
                  offsetRef.current = String(ms)
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
                  // Add 7 days to current values
                  const currentDays = offsetDays ? parseInt(offsetDays, 10) : 0
                  const currentHours = offsetHours ? parseInt(offsetHours, 10) : 0
                  const currentMinutes = offsetMinutes ? parseInt(offsetMinutes, 10) : 0
                  const currentSeconds = offsetSeconds ? parseInt(offsetSeconds, 10) : 0
                  const newDays = currentDays + 7
                  const daysStr = newDays !== 0 ? String(newDays) : ''
                  offsetDaysRef.current = daysStr
                  setOffsetDays(daysStr)
                  setOffsetHours(currentHours !== 0 ? String(currentHours) : '')
                  setOffsetMinutes(currentMinutes !== 0 ? String(currentMinutes) : '')
                  setOffsetSeconds(currentSeconds !== 0 ? String(currentSeconds) : '')
                  const ms = (newDays * 24 * 60 * 60 * 1000) +
                             (currentHours * 60 * 60 * 1000) +
                             (currentMinutes * 60 * 1000) +
                             (currentSeconds * 1000)
                  offsetRef.current = String(ms)
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
                  // Add 1 hour to current values
                  const currentDays = offsetDays ? parseInt(offsetDays, 10) : 0
                  const currentHours = offsetHours ? parseInt(offsetHours, 10) : 0
                  const currentMinutes = offsetMinutes ? parseInt(offsetMinutes, 10) : 0
                  const currentSeconds = offsetSeconds ? parseInt(offsetSeconds, 10) : 0
                  const newHours = currentHours + 1
                  const daysStr = currentDays !== 0 ? String(currentDays) : ''
                  const hoursStr = newHours !== 0 ? String(newHours) : ''
                  offsetDaysRef.current = daysStr
                  offsetHoursRef.current = hoursStr
                  setOffsetDays(daysStr)
                  setOffsetHours(hoursStr)
                  setOffsetMinutes(currentMinutes !== 0 ? String(currentMinutes) : '')
                  setOffsetSeconds(currentSeconds !== 0 ? String(currentSeconds) : '')
                  const ms = (currentDays * 24 * 60 * 60 * 1000) +
                             (newHours * 60 * 60 * 1000) +
                             (currentMinutes * 60 * 1000) +
                             (currentSeconds * 1000)
                  offsetRef.current = String(ms)
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

