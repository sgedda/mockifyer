import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Template {
  name: string
  description: string
  method: 'GET' | 'POST'
  endpoint: string
  body?: string
  category: string
}

const templates: Template[] = [
  {
    name: 'Weather - Current',
    description: 'Get current weather for a city',
    method: 'GET',
    endpoint: '/api/weather-unified/current/London',
    category: 'Weather',
  },
  {
    name: 'Weather - Forecast',
    description: 'Get 3-day forecast',
    method: 'GET',
    endpoint: '/api/weather-unified/forecast/Paris?days=3',
    category: 'Weather',
  },
  {
    name: 'Football - Standings',
    description: 'Get league standings',
    method: 'GET',
    endpoint: '/api/football-unified/standings',
    category: 'Football',
  },
  {
    name: 'Football - Fixtures',
    description: 'Get match fixtures',
    method: 'GET',
    endpoint: '/api/football-unified/fixtures',
    category: 'Football',
  },
  {
    name: 'GraphQL - Characters',
    description: 'Query Rick and Morty characters',
    method: 'POST',
    endpoint: '/api/graphql-unified/query',
    body: JSON.stringify({
      query: `{
        characters {
          results {
            id
            name
            status
            species
          }
        }
      }`,
      variables: {},
    }, null, 2),
    category: 'GraphQL',
  },
  {
    name: 'GraphQL - Character by ID',
    description: 'Get specific character details',
    method: 'POST',
    endpoint: '/api/graphql-unified/query',
    body: JSON.stringify({
      query: `query GetCharacter($id: ID!) {
        character(id: $id) {
          id
          name
          status
          species
          type
          gender
          origin {
            name
          }
          location {
            name
          }
        }
      }`,
      variables: { id: '1' },
    }, null, 2),
    category: 'GraphQL',
  },
]

interface RequestTemplatesProps {
  onSelect: (template: Template) => void
}

export default function RequestTemplates({ onSelect }: RequestTemplatesProps) {
  const categories = Array.from(new Set(templates.map((t) => t.category)))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request Templates</CardTitle>
        <CardDescription>
          Quick start with pre-configured requests
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {categories.map((category) => (
            <div key={category}>
              <h4 className="text-sm font-semibold mb-2">{category}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {templates
                  .filter((t) => t.category === category)
                  .map((template) => (
                    <Button
                      key={template.name}
                      variant="outline"
                      className="h-auto p-3 justify-start"
                      onClick={() => onSelect(template)}
                    >
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{template.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {template.method}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {template.description}
                        </p>
                      </div>
                    </Button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}


