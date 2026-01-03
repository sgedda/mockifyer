import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'

interface JsonFieldEditorProps {
  value: any
  onChange: (value: any) => void
  path?: string
  level?: number
}

export default function JsonFieldEditor({ value, onChange, path = '', level = 0 }: JsonFieldEditorProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const isImageUrl = (str: string): boolean => {
    if (typeof str !== 'string') return false
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i
    return imageExtensions.test(str) || str.startsWith('data:image/')
  }

  const updateNestedValue = (newValue: any) => {
    onChange(newValue)
  }

  const updateObjectField = (key: string, fieldValue: any) => {
    const newValue = { ...value }
    newValue[key] = fieldValue
    updateNestedValue(newValue)
  }

  const deleteObjectField = (key: string) => {
    const newValue = { ...value }
    delete newValue[key]
    updateNestedValue(newValue)
  }

  const addObjectField = () => {
    const newKey = prompt('Enter field name:')
    if (newKey && newKey.trim()) {
      updateObjectField(newKey.trim(), '')
    }
  }

  const updateArrayItem = (index: number, itemValue: any) => {
    const newValue = [...value]
    newValue[index] = itemValue
    updateNestedValue(newValue)
  }

  const deleteArrayItem = (index: number) => {
    const newValue = value.filter((_: any, i: number) => i !== index)
    updateNestedValue(newValue)
  }

  const addArrayItem = () => {
    const newValue = [...value, '']
    updateNestedValue(newValue)
  }

  if (value === null || value === undefined) {
    return (
      <div className="flex items-center gap-2 py-1" style={{ paddingLeft: `${level * 20}px` }}>
        <Label className="w-32 text-xs font-mono text-muted-foreground shrink-0">{path || 'value'}:</Label>
        <Input
          type="text"
          value="null"
          disabled
          className="flex-1 text-xs"
        />
      </div>
    )
  }

  if (Array.isArray(value)) {
    const isCollapsed = collapsed[path] === true
    return (
      <div className="border-l-2 border-muted pl-1 sm:pl-2" style={{ marginLeft: `${level * 8}px` }}>
        <div className="flex items-center gap-1 sm:gap-2 py-2 sm:py-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 sm:h-5 sm:w-5 p-0 shrink-0"
            onClick={() => toggleCollapse(path)}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4 sm:h-3 sm:w-3" /> : <ChevronDown className="h-4 w-4 sm:h-3 sm:w-3" />}
          </Button>
          <Label className="text-sm sm:text-xs font-mono font-semibold truncate min-w-0">{path || 'Array'}:</Label>
          <span className="text-xs text-muted-foreground shrink-0">Array ({value.length} items)</span>
        </div>
        {!isCollapsed && (
          <div className="mt-1 space-y-1">
            {value.map((item: any, index: number) => (
              <div key={index} className="flex items-start gap-1 sm:gap-2 py-2 sm:py-1 min-w-0">
                <Label className="w-8 sm:w-8 text-xs text-muted-foreground shrink-0 pt-2 sm:pt-1">[{index}]:</Label>
                <div className="flex-1">
                  {typeof item === 'object' && item !== null && !Array.isArray(item) ? (
                    <JsonFieldEditor
                      value={item}
                      onChange={(newItem) => updateArrayItem(index, newItem)}
                      path={`${path}[${index}]`}
                      level={level + 1}
                    />
                  ) : Array.isArray(item) ? (
                    <JsonFieldEditor
                      value={item}
                      onChange={(newItem) => updateArrayItem(index, newItem)}
                      path={`${path}[${index}]`}
                      level={level + 1}
                    />
                  ) : typeof item === 'boolean' ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="checkbox"
                          checked={item}
                          onChange={(e) => updateArrayItem(index, e.target.checked)}
                          className="h-5 w-5 sm:h-4 sm:w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-xs text-muted-foreground">{item ? 'true' : 'false'}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 sm:h-6 sm:w-6 p-0 shrink-0 self-start sm:self-auto"
                        onClick={() => deleteArrayItem(index)}
                      >
                        <Trash2 className="h-4 w-4 sm:h-3 sm:w-3" />
                      </Button>
                    </div>
                  ) : typeof item === 'string' && isImageUrl(item) ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1">
                        <Input
                          type="text"
                          value={item ?? ''}
                          onChange={(e) => updateArrayItem(index, e.target.value)}
                          className="flex-1 text-xs min-h-[40px] sm:min-h-0 min-w-0"
                        />
                        <div className="shrink-0 w-16 h-16 sm:w-12 sm:h-12 border rounded overflow-hidden bg-muted">
                          <img
                            src={item}
                            alt={`Item ${index}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 sm:h-6 sm:w-6 p-0 shrink-0 self-start sm:self-auto"
                        onClick={() => deleteArrayItem(index)}
                      >
                        <Trash2 className="h-4 w-4 sm:h-3 sm:w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Input
                        type={typeof item === 'number' ? 'number' : 'text'}
                        value={item ?? ''}
                        onChange={(e) => {
                          let newItem: any = e.target.value
                          if (typeof item === 'number') {
                            newItem = parseFloat(e.target.value) || 0
                          }
                          updateArrayItem(index, newItem)
                        }}
                        className="flex-1 text-xs min-h-[40px] sm:min-h-0 min-w-0"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 sm:h-6 sm:w-6 p-0 shrink-0 self-start sm:self-auto"
                        onClick={() => deleteArrayItem(index)}
                      >
                        <Trash2 className="h-4 w-4 sm:h-3 sm:w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div style={{ paddingLeft: `${(level + 1) * 8}px` }}>
              <Button
                variant="outline"
                size="sm"
                className="h-9 sm:h-7 text-xs mt-2"
                onClick={addArrayItem}
              >
                <Plus className="h-4 w-4 sm:h-3 sm:w-3 mr-1" />
                Add Item
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (typeof value === 'object' && value !== null) {
    const isCollapsed = collapsed[path] === true
    return (
      <div className="border-l-2 border-muted pl-1 sm:pl-2" style={{ marginLeft: `${level * 8}px` }}>
        <div className="flex items-center gap-1 sm:gap-2 py-2 sm:py-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 sm:h-5 sm:w-5 p-0 shrink-0"
            onClick={() => toggleCollapse(path)}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4 sm:h-3 sm:w-3" /> : <ChevronDown className="h-4 w-4 sm:h-3 sm:w-3" />}
          </Button>
          <Label className="text-sm sm:text-xs font-mono font-semibold truncate min-w-0">{path || 'Object'}:</Label>
          <span className="text-xs text-muted-foreground shrink-0">Object</span>
        </div>
        {!isCollapsed && (
          <div className="mt-1 space-y-1">
            {Object.entries(value).map(([key, fieldValue]) => (
              <div key={key}>
                {typeof fieldValue === 'object' && fieldValue !== null ? (
                  <JsonFieldEditor
                    value={fieldValue}
                    onChange={(newFieldValue) => updateObjectField(key, newFieldValue)}
                    path={key}
                    level={level + 1}
                  />
                ) : typeof fieldValue === 'boolean' ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 sm:py-1 min-w-0" style={{ paddingLeft: `${(level + 1) * 8}px` }}>
                    <Label className="text-xs font-mono text-muted-foreground sm:w-32 shrink-0 break-words">{key}:</Label>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="checkbox"
                        checked={fieldValue}
                        onChange={(e) => updateObjectField(key, e.target.checked)}
                        className="h-5 w-5 sm:h-4 sm:w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-xs text-muted-foreground">{fieldValue ? 'true' : 'false'}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 sm:h-6 sm:w-6 p-0 shrink-0 self-start sm:self-auto"
                      onClick={() => deleteObjectField(key)}
                    >
                      <Trash2 className="h-4 w-4 sm:h-3 sm:w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 sm:py-1 min-w-0" style={{ paddingLeft: `${(level + 1) * 8}px` }}>
                    <Label className="text-xs font-mono text-muted-foreground sm:w-32 shrink-0 break-words">{key}:</Label>
                    {typeof fieldValue === 'string' && isImageUrl(fieldValue) ? (
                      <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <Input
                          type="text"
                          value={fieldValue ?? ''}
                          onChange={(e) => updateObjectField(key, e.target.value)}
                          className="flex-1 text-xs min-h-[40px] sm:min-h-0 min-w-0"
                        />
                        <div className="shrink-0 w-16 h-16 sm:w-12 sm:h-12 border rounded overflow-hidden bg-muted">
                          <img
                            src={fieldValue}
                            alt={key}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>
                      </div>
                    ) : typeof fieldValue === 'string' && fieldValue.length > 50 ? (
                      <textarea
                        value={fieldValue ?? ''}
                        onChange={(e) => updateObjectField(key, e.target.value)}
                        className="flex-1 text-xs min-h-[80px] sm:min-h-[60px] p-2 rounded-md border"
                        rows={4}
                      />
                    ) : (
                      <Input
                        type={typeof fieldValue === 'number' ? 'number' : 'text'}
                        value={fieldValue ?? ''}
                        onChange={(e) => {
                          let newFieldValue: any = e.target.value
                          if (typeof fieldValue === 'number') {
                            newFieldValue = parseFloat(e.target.value) || 0
                          }
                          updateObjectField(key, newFieldValue)
                        }}
                        className="flex-1 text-xs min-h-[40px] sm:min-h-0 min-w-0"
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 sm:h-6 sm:w-6 p-0 shrink-0 self-start sm:self-auto"
                      onClick={() => deleteObjectField(key)}
                    >
                      <Trash2 className="h-4 w-4 sm:h-3 sm:w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            <div style={{ paddingLeft: `${(level + 1) * 8}px` }}>
              <Button
                variant="outline"
                size="sm"
                className="h-9 sm:h-7 text-xs mt-2"
                onClick={addObjectField}
              >
                <Plus className="h-4 w-4 sm:h-3 sm:w-3 mr-1" />
                Add Field
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Primitive value (shouldn't happen at root, but handle it)
  if (typeof value === 'boolean') {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 sm:py-1 min-w-0" style={{ paddingLeft: `${level * 8}px` }}>
        <Label className="text-xs font-mono text-muted-foreground sm:w-32 shrink-0 break-words">{path || 'value'}:</Label>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-5 w-5 sm:h-4 sm:w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground">{value ? 'true' : 'false'}</span>
        </div>
      </div>
    )
  }

  const isLongString = typeof value === 'string' && value.length > 50
  const isImage = typeof value === 'string' && isImageUrl(value)
  
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 sm:py-1 min-w-0" style={{ paddingLeft: `${level * 8}px` }}>
      <Label className="text-xs font-mono text-muted-foreground sm:w-32 shrink-0 break-words">{path || 'value'}:</Label>
      {isImage ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1">
          <Input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 text-xs min-h-[40px] sm:min-h-0 min-w-0"
          />
          <div className="shrink-0 w-16 h-16 sm:w-12 sm:h-12 border rounded overflow-hidden bg-muted">
            <img
              src={value}
              alt={path || 'image'}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
        </div>
      ) : isLongString ? (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-xs min-h-[80px] sm:min-h-[60px] p-2 rounded-md border"
          rows={4}
        />
      ) : (
        <Input
          type={typeof value === 'number' ? 'number' : 'text'}
          value={value ?? ''}
          onChange={(e) => {
            let newValue: any = e.target.value
            if (typeof value === 'number') {
              newValue = parseFloat(e.target.value) || 0
            }
            onChange(newValue)
          }}
          className="flex-1 text-xs min-h-[40px] sm:min-h-0 min-w-0"
        />
      )}
    </div>
  )
}

