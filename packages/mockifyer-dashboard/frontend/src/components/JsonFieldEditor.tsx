import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react'

interface JsonFieldEditorProps {
  data: any
  path?: string
  onChange: (data: any) => void
  level?: number
}

function getFieldType(value: any): 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  return typeof value as 'string' | 'number' | 'boolean'
}

export default function JsonFieldEditor({ data, path = '', onChange, level = 0 }: JsonFieldEditorProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function toggleCollapse(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function updateField(key: string, value: any) {
    const newData = Array.isArray(data) ? [...data] : { ...data }
    if (Array.isArray(data)) {
      newData[parseInt(key)] = value
    } else {
      newData[key] = value
    }
    onChange(newData)
  }

  function deleteField(key: string) {
    const newData = Array.isArray(data) ? [...data] : { ...data }
    if (Array.isArray(data)) {
      newData.splice(parseInt(key), 1)
    } else {
      delete newData[key]
    }
    onChange(newData)
  }

  function addField(key?: string) {
    const newData = Array.isArray(data) ? [...data] : { ...data }
    if (Array.isArray(data)) {
      newData.push('')
    } else {
      const newKey = key || `field${Object.keys(data).length + 1}`
      newData[newKey] = ''
    }
    onChange(newData)
  }

  // Handle null
  if (data === null) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">null</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange('')}
          className="h-6 px-2"
        >
          Change to string
        </Button>
      </div>
    )
  }

  // Handle primitive types (string, number, boolean)
  if (typeof data !== 'object') {
    const type = getFieldType(data)
    return (
      <div className="flex items-center gap-2">
        {type === 'boolean' ? (
          <select
            value={String(data)}
            onChange={(e) => onChange(e.target.value === 'true')}
            className="h-8 px-2 rounded-md border border-input bg-background text-sm"
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : type === 'number' ? (
          <Input
            type="number"
            value={data}
            onChange={(e) => {
              const num = e.target.value === '' ? 0 : parseFloat(e.target.value)
              onChange(isNaN(num) ? e.target.value : num)
            }}
            className="h-8 text-sm"
          />
        ) : type === 'null' ? (
          <span className="text-muted-foreground text-sm px-2">null</span>
        ) : (
          <Input
            value={String(data)}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-sm"
          />
        )}
        <select
          value={type}
          onChange={(e) => {
            const newType = e.target.value
            if (newType === 'number') onChange(0)
            else if (newType === 'boolean') onChange(false)
            else if (newType === 'null') onChange(null)
            else if (newType === 'object') onChange({})
            else if (newType === 'array') onChange([])
            else onChange('')
          }}
          className="h-8 px-2 rounded-md border border-input bg-background text-xs"
        >
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="null">null</option>
          <option value="object">object</option>
          <option value="array">array</option>
        </select>
      </div>
    )
  }

  const isArray = Array.isArray(data)
  const entries = isArray 
    ? data.map((value, index) => [String(index), value])
    : Object.entries(data)

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => {
        const fieldPath = path ? `${path}.${key}` : key
        const isCollapsed = collapsed[fieldPath]
        const type = getFieldType(value)
        const isComplex = type === 'object' || type === 'array'

        return (
          <div key={key} className="border-l-2 border-border pl-3" style={{ marginLeft: `${level * 16}px` }}>
            <div className="flex items-center gap-2 mb-1">
              {isComplex && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleCollapse(fieldPath)}
                  className="h-6 w-6 p-0"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              )}
              {!isArray && (
                <Input
                  value={key}
                  onChange={(e) => {
                    const newData = { ...data }
                    const oldValue = newData[key]
                    delete newData[key]
                    newData[e.target.value] = oldValue
                    onChange(newData)
                  }}
                  className="h-7 text-sm font-mono w-32"
                />
              )}
              {isArray && (
                <span className="text-xs text-muted-foreground w-8">[{key}]</span>
              )}
              {!isComplex && (
                <div className="flex-1">
                  <JsonFieldEditor
                    data={value}
                    path={fieldPath}
                    onChange={(newValue) => updateField(key, newValue)}
                    level={level}
                  />
                </div>
              )}
              {isComplex && isCollapsed && (
                <span className="text-xs text-muted-foreground">
                  {type === 'array' ? `Array (${(value as any[]).length} items)` : 'Object'}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteField(key)}
                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            {isComplex && !isCollapsed && (
              <div className="mt-1">
                <JsonFieldEditor
                  data={value}
                  path={fieldPath}
                  onChange={(newValue) => updateField(key, newValue)}
                  level={level + 1}
                />
              </div>
            )}
          </div>
        )
      })}
      <div className="flex items-center gap-2" style={{ marginLeft: `${level * 16}px` }}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addField()}
          className="h-7 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          {isArray ? 'Add Item' : 'Add Field'}
        </Button>
      </div>
    </div>
  )
}

