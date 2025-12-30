import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { deleteMock, duplicateMock } from '@/lib/api'
import type { MockFile, MockData } from '@/types'
import { RefreshCw, Trash2, Copy, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface MockListProps {
  mocks: MockFile[]
  loading: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedMock: MockData | null
  onSelectMock: (file: MockFile) => void
  onRefresh: () => void
}

export default function MockList({
  mocks,
  loading,
  searchQuery,
  onSearchChange,
  selectedMock,
  onSelectMock,
  onRefresh,
}: MockListProps) {
  const { toast } = useToast()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(filename: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return

    try {
      setDeleting(filename)
      await deleteMock(filename)
      toast({
        title: 'Success',
        description: 'Mock deleted successfully',
      })
      onRefresh()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete mock',
        variant: 'destructive',
      })
    } finally {
      setDeleting(null)
    }
  }

  async function handleDuplicate(filename: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      const result = await duplicateMock(filename)
      toast({
        title: 'Success',
        description: `Mock duplicated as ${result.newFilename}`,
      })
      onRefresh()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to duplicate mock',
        variant: 'destructive',
      })
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Input
          placeholder="🔍 Search by filename, endpoint, or method..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1"
        />
        <Button onClick={onRefresh} variant="outline" size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">Loading mocks...</div>
          </CardContent>
        </Card>
      ) : mocks.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              {searchQuery ? 'No mocks found matching your search' : 'No mocks found'}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {mocks.map((mock) => {
            const isSelected = selectedMock?.filename === mock.filename
            return (
              <Card
                key={mock.filename}
                className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-md ${
                  isSelected ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => onSelectMock(mock)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2 text-foreground">{mock.filename}</CardTitle>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="text-primary">📦</span>
                          {formatFileSize(mock.size)}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="text-primary">🕒</span>
                          {formatDate(mock.modified)}
                        </span>
                        {mock.graphqlInfo && (
                          <Badge variant="outline" className="border-purple-500/30 bg-purple-500/20 text-purple-300">
                            GraphQL
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDuplicate(mock.filename, e)}
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDelete(mock.filename, e)}
                        disabled={deleting === mock.filename}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {mock.endpoint && (
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                      <ExternalLink className="h-3 w-3" />
                      <span className="break-all">{mock.endpoint}</span>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

