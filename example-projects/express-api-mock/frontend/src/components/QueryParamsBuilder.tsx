import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Plus } from 'lucide-react'

interface QueryParam {
  key: string
  value: string
}

interface QueryParamsBuilderProps {
  params: QueryParam[]
  onChange: (params: QueryParam[]) => void
}

export default function QueryParamsBuilder({ params, onChange }: QueryParamsBuilderProps) {
  const addParam = () => {
    onChange([...params, { key: '', value: '' }])
  }

  const updateParam = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...params]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const removeParam = (index: number) => {
    onChange(params.filter((_, i) => i !== index))
  }

  const buildQueryString = () => {
    const validParams = params.filter((p) => p.key.trim() !== '')
    if (validParams.length === 0) return ''
    const searchParams = new URLSearchParams()
    validParams.forEach((p) => {
      if (p.key.trim()) {
        searchParams.append(p.key.trim(), p.value.trim())
      }
    })
    return searchParams.toString()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Query Parameters</label>
        <Button type="button" variant="outline" size="sm" onClick={addParam}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {params.map((param, index) => (
          <div key={index} className="flex gap-2">
            <Input
              placeholder="Key"
              value={param.key}
              onChange={(e) => updateParam(index, 'key', e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Value"
              value={param.value}
              onChange={(e) => updateParam(index, 'value', e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeParam(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {params.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            No query parameters. Click "Add" to add one.
          </p>
        )}
      </div>
      {buildQueryString() && (
        <div className="mt-2 p-2 bg-muted rounded-md">
          <p className="text-xs font-mono text-muted-foreground">
            ?{buildQueryString()}
          </p>
        </div>
      )}
    </div>
  )
}


