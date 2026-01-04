import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'

interface EndpointField {
  id: string
  label: string
  type: 'text' | 'select' | 'textarea' | 'checkbox'
  placeholder?: string
  defaultValue?: string | boolean
  required?: boolean
  options?: Array<{ value: string; label: string; group?: string }>
  rows?: number
}

interface EndpointConfig {
  name: string
  icon: string
  apiPath: string
  method: 'GET' | 'POST'
  fields: EndpointField[]
  buildUrl: (params: Record<string, any>) => string
  buildTitle: (params: Record<string, any>) => string
  buildBody?: (params: Record<string, any>) => any
}

interface UnifiedEndpointTesterProps {
  clientType: 'axios' | 'fetch'
  scope: 'local' | 'global'
  onResponse: (response: any) => void
}

const endpointConfigs: Record<string, EndpointConfig> = {
  'weather-current': {
    name: 'Current Weather',
    icon: '🌤️',
    apiPath: '/api/weather-unified/current',
    method: 'GET',
    fields: [
      {
        id: 'city',
        label: 'City Name',
        type: 'text',
        placeholder: 'e.g., London, New York, Tokyo',
        defaultValue: 'London',
        required: true,
      },
      {
        id: 'full-response',
        label: 'Show full API response',
        type: 'checkbox',
        defaultValue: false,
      },
    ],
    buildUrl: (params) => {
      const city = encodeURIComponent(params.city || 'London')
      const full = params['full-response'] ? '?full=true' : ''
      return `/api/weather-unified/current/${city}${full}`
    },
    buildTitle: (params) => `Current Weather for ${params.city || 'Unknown'}`,
  },
  'weather-forecast': {
    name: 'Weather Forecast',
    icon: '📅',
    apiPath: '/api/weather-unified/forecast',
    method: 'GET',
    fields: [
      {
        id: 'city',
        label: 'City Name',
        type: 'text',
        placeholder: 'e.g., London, New York, Tokyo',
        defaultValue: 'London',
        required: true,
      },
      {
        id: 'days',
        label: 'Number of Days',
        type: 'select',
        options: [
          { value: '1', label: '1 day' },
          { value: '2', label: '2 days' },
          { value: '3', label: '3 days' },
          { value: '5', label: '5 days' },
          { value: '7', label: '7 days' },
        ],
        defaultValue: '3',
      },
      {
        id: 'full-response',
        label: 'Show full API response',
        type: 'checkbox',
        defaultValue: false,
      },
    ],
    buildUrl: (params) => {
      const city = encodeURIComponent(params.city || 'London')
      const days = params.days || '3'
      const full = params['full-response'] ? '&full=true' : ''
      return `/api/weather-unified/forecast/${city}?days=${days}${full}`
    },
    buildTitle: (params) =>
      `${params.days || '3'}-Day Forecast for ${params.city || 'Unknown'}`,
  },
  'football-fixtures': {
    name: 'Football Fixtures',
    icon: '⚽',
    apiPath: '/api/football-unified/fixtures',
    method: 'GET',
    fields: [
      {
        id: 'season',
        label: 'Season',
        type: 'select',
        options: [
          { value: '2021', label: '2021' },
          { value: '2022', label: '2022' },
          { value: '2023', label: '2023' },
        ],
        defaultValue: '2022',
      },
      {
        id: 'team',
        label: 'Team (optional)',
        type: 'select',
        placeholder: 'Select a team...',
        options: [
          { value: '33', label: 'Manchester United', group: 'Premier League' },
          { value: '50', label: 'Manchester City', group: 'Premier League' },
          { value: '40', label: 'Liverpool', group: 'Premier League' },
          { value: '42', label: 'Arsenal', group: 'Premier League' },
          { value: '49', label: 'Chelsea', group: 'Premier League' },
        ],
        defaultValue: '',
      },
    ],
    buildUrl: (params) => {
      const season = params.season || '2022'
      const team = params.team ? `&team=${params.team}` : ''
      return `/api/football-unified/fixtures?season=${season}${team}`
    },
    buildTitle: (params) =>
      `Football Fixtures${params.season ? ` - Season ${params.season}` : ''}`,
  },
  'football-standings': {
    name: 'League Standings',
    icon: '🏆',
    apiPath: '/api/football-unified/standings',
    method: 'GET',
    fields: [
      {
        id: 'league',
        label: 'League',
        type: 'select',
        options: [
          { value: '39', label: 'Premier League (England)' },
          { value: '140', label: 'La Liga (Spain)' },
          { value: '78', label: 'Bundesliga (Germany)' },
          { value: '135', label: 'Serie A (Italy)' },
          { value: '61', label: 'Ligue 1 (France)' },
        ],
        defaultValue: '39',
      },
      {
        id: 'season',
        label: 'Season',
        type: 'select',
        options: [
          { value: '2021', label: '2021' },
          { value: '2022', label: '2022' },
          { value: '2023', label: '2023' },
        ],
        defaultValue: '2022',
      },
    ],
    buildUrl: (params) => {
      const league = params.league || '39'
      const season = params.season || '2022'
      return `/api/football-unified/standings/${league}?season=${season}`
    },
    buildTitle: (params) =>
      `League Standings${params.season ? ` - Season ${params.season}` : ''}`,
  },
  'football-team': {
    name: 'Team Information',
    icon: '👥',
    apiPath: '/api/football-unified/team',
    method: 'GET',
    fields: [
      {
        id: 'team',
        label: 'Team',
        type: 'select',
        options: [
          { value: '33', label: 'Manchester United', group: 'Premier League' },
          { value: '50', label: 'Manchester City', group: 'Premier League' },
          { value: '40', label: 'Liverpool', group: 'Premier League' },
          { value: '42', label: 'Arsenal', group: 'Premier League' },
          { value: '49', label: 'Chelsea', group: 'Premier League' },
        ],
        defaultValue: '33',
      },
    ],
    buildUrl: (params) => {
      const team = params.team || '33'
      return `/api/football-unified/team/${team}`
    },
    buildTitle: () => 'Team Information',
  },
  'graphql': {
    name: 'GraphQL Query',
    icon: '🔷',
    apiPath: '/api/graphql-unified/query',
    method: 'POST',
    fields: [
      {
        id: 'query',
        label: 'GraphQL Query',
        type: 'textarea',
        rows: 8,
        placeholder: 'Enter your GraphQL query here...',
        defaultValue: `query ($page: Int) {
  characters(page: $page) {
    results {
      id
      name
      status
      species
    }
  }
}`,
      },
      {
        id: 'variables',
        label: 'Variables (JSON, optional)',
        type: 'textarea',
        rows: 3,
        placeholder: '{"page": 1}',
        defaultValue: '{"page": 3}',
      },
    ],
    buildUrl: () => '/api/graphql-unified/query',
    buildTitle: () => 'GraphQL Query Result',
    buildBody: (params) => ({
      query: params.query,
      variables: params.variables ? JSON.parse(params.variables) : {},
    }),
  },
  'events': {
    name: 'Date-Filtered Events',
    icon: '📅',
    apiPath: '/api/events/filtered',
    method: 'GET',
    fields: [
      {
        id: 'filter',
        label: 'Filter',
        type: 'select',
        options: [
          { value: 'all', label: 'All Events' },
          { value: 'upcoming', label: 'Upcoming Events' },
          { value: 'past', label: 'Past Events' },
          { value: 'today', label: "Today's Events" },
        ],
        defaultValue: 'all',
      },
    ],
    buildUrl: (params) => {
      const filter = params.filter && params.filter !== 'all' ? `?filter=${params.filter}` : ''
      return `/api/events/filtered${filter}`
    },
    buildTitle: (params) => {
      const filterText = params.filter && params.filter !== 'all'
        ? ` - ${params.filter.charAt(0).toUpperCase() + params.filter.slice(1)}`
        : ''
      return `Date-Filtered Events${filterText}`
    },
  },
}

export default function UnifiedEndpointTester({
  clientType,
  scope,
  onResponse,
}: UnifiedEndpointTesterProps) {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('weather-current')
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const config = endpointConfigs[selectedEndpoint]

  // Initialize form values when endpoint changes
  useEffect(() => {
    if (config) {
      const initialValues: Record<string, any> = {}
      config.fields.forEach((field) => {
        if (field.type === 'checkbox') {
          initialValues[field.id] = field.defaultValue || false
        } else {
          initialValues[field.id] = field.defaultValue || ''
        }
      })
      setFormValues(initialValues)
    }
  }, [selectedEndpoint])

  const updateFormValue = (fieldId: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  const handleExecute = async () => {
    if (!config) return

    // Validate required fields
    const requiredFields = config.fields.filter((f) => f.required)
    for (const field of requiredFields) {
      if (!formValues[field.id] || formValues[field.id].toString().trim() === '') {
        toast({
          title: 'Validation Error',
          description: `Please fill in the required field: ${field.label}`,
          variant: 'destructive',
        })
        return
      }
    }

    setLoading(true)
    let finalUrl = ''
    const options: RequestInit = {
      method: config.method,
    }
    
    try {
      const url = config.buildUrl(formValues)
      const urlObj = new URL(url, window.location.origin)
      urlObj.searchParams.set('clientType', clientType)
      urlObj.searchParams.set('scope', scope)
      finalUrl = urlObj.pathname + urlObj.search

      if (config.method === 'POST' && config.buildBody) {
        options.headers = {
          'Content-Type': 'application/json',
        }
        options.body = JSON.stringify(config.buildBody(formValues))
      }

      const startTime = Date.now()
      const response = await fetch(finalUrl, options)
      const duration = Date.now() - startTime
      const data = await response.json()
      const mocked = response.headers.get('x-mockifyer') === 'true'
      const limitReached = response.headers.get('x-mockifyer-limit-reached') === 'true'

      // Check if limit is reached
      if (limitReached || data?.limitReached) {
        const limitMessage = data?.message || data?.error || 'Maximum requests per scenario reached. Please delete some mock files or switch to a different scenario.'
        toast({
          title: 'Maximum Requests Reached',
          description: limitMessage,
          variant: 'destructive',
          duration: 5000,
        })
      }

      onResponse({
        data,
        mocked,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        mockFilename: response.headers.get('x-mockifyer-filename'),
        mockTimestamp: response.headers.get('x-mockifyer-timestamp'),
        endpointName: `${config.icon} ${config.name}`,
        title: config.buildTitle(formValues),
        duration,
        url: finalUrl,
        method: config.method,
        requestBody: options.body,
      })
    } catch (error: any) {
      // Extract error message (handle both regular errors and axios errors)
      let errorMessage = error?.message || error?.response?.data?.message || error?.response?.data?.error || 'An error occurred'
      
      // Check if this is a limit error
      const isLimitError = error?.isLimitError || 
                          errorMessage?.includes('Maximum') || 
                          errorMessage?.includes('requests per scenario') ||
                          errorMessage?.includes('requests per scenario reached')
      
      // Show clear message for limit errors
      if (isLimitError) {
        toast({
          title: 'Maximum Requests Reached',
          description: 'Cannot make more requests. Maximum requests per scenario reached. Please delete some mock files or switch to a different scenario.',
          variant: 'destructive',
          duration: 5000, // Show for 5 seconds
        })
      } else {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
      }
      
      onResponse({
        error: errorMessage,
        endpointName: `${config.icon} ${config.name}`,
        title: config.buildTitle(formValues),
        url: finalUrl,
        method: config.method,
        requestBody: options.body,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unified Endpoint Tester</CardTitle>
        <CardDescription>
          Test different API endpoints with dynamic form generation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Select Endpoint</Label>
          <Select value={selectedEndpoint} onValueChange={setSelectedEndpoint}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(endpointConfigs).map(([key, endpoint]) => (
                <SelectItem key={key} value={key}>
                  {endpoint.icon} {endpoint.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {config && (
          <>
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-semibold">
                {config.icon} {config.name}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {config.method} {config.apiPath}
              </p>
            </div>

            <div className="space-y-4">
              {config.fields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={`field-${field.id}`}>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {field.type === 'text' && (
                    <Input
                      id={`field-${field.id}`}
                      value={formValues[field.id] || ''}
                      onChange={(e) => updateFormValue(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                    />
                  )}
                  {field.type === 'select' && (
                    <Select
                      value={formValues[field.id] || field.defaultValue || undefined}
                      onValueChange={(value) => updateFormValue(field.id, value)}
                    >
                      <SelectTrigger id={`field-${field.id}`}>
                        <SelectValue placeholder={field.placeholder || 'Select an option...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.filter(option => option.value !== '').map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {field.type === 'textarea' && (
                    <textarea
                      id={`field-${field.id}`}
                      value={formValues[field.id] || ''}
                      onChange={(e) => updateFormValue(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      rows={field.rows || 4}
                      className="w-full p-3 rounded-md border bg-background font-mono text-sm resize-y"
                    />
                  )}
                  {field.type === 'checkbox' && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`field-${field.id}`}
                        checked={formValues[field.id] || false}
                        onChange={(e) => updateFormValue(field.id, e.target.checked)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor={`field-${field.id}`} className="cursor-pointer">
                        {field.label}
                      </Label>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button onClick={handleExecute} disabled={loading} className="w-full">
              {loading ? 'Loading...' : 'Execute Request'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

