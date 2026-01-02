import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { getMockFiles, getMockFile, deleteMockFile, updateMockFile, type MockFile } from '@/lib/api'
import { Trash2, Eye, RefreshCw, Edit2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export default function MockFileBrowser() {
  const [files, setFiles] = useState<MockFile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<any>(null)
  const [editingFile, setEditingFile] = useState<any>(null)
  const [editContent, setEditContent] = useState('')
  const [editError, setEditError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    loadFiles()
  }, [])

  async function loadFiles() {
    setLoading(true)
    try {
      const data = await getMockFiles()
      setFiles(data.files)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load mock files',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleViewFile(filename: string) {
    try {
      const data = await getMockFile(filename)
      setSelectedFile(data)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load mock file',
        variant: 'destructive',
      })
    }
  }

  async function handleDeleteFile(filename: string) {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) {
      return
    }

    try {
      await deleteMockFile(filename)
      toast({
        title: 'Success',
        description: 'Mock file deleted successfully',
      })
      loadFiles()
      if (selectedFile?.filename === filename) {
        setSelectedFile(null)
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete mock file',
        variant: 'destructive',
      })
    }
  }

  async function handleEditFile(filename: string) {
    try {
      const data = await getMockFile(filename)
      // Extract response data for editing
      const responseData = data.data?.response?.data || data.data?.response || {}
      setEditContent(JSON.stringify(responseData, null, 2))
      setEditingFile(data)
      setEditError('')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load file for editing',
        variant: 'destructive',
      })
    }
  }

  function validateJSON(jsonString: string): boolean {
    if (!jsonString.trim()) {
      setEditError('')
      return true
    }
    try {
      JSON.parse(jsonString)
      setEditError('')
      return true
    } catch (e: any) {
      setEditError(`Invalid JSON: ${e.message}`)
      return false
    }
  }

  async function handleSaveEdit() {
    if (!editingFile || !validateJSON(editContent)) {
      return
    }

    try {
      const parsedData = editContent.trim() ? JSON.parse(editContent) : {}
      await updateMockFile(editingFile.filename, parsedData)
      toast({
        title: 'Success',
        description: 'Mock file updated successfully',
      })
      setEditingFile(null)
      setEditContent('')
      loadFiles()
      if (selectedFile?.filename === editingFile.filename) {
        handleViewFile(editingFile.filename)
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update mock file',
        variant: 'destructive',
      })
    }
  }

  const filteredFiles = files.filter((file) =>
    file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.endpoint?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mock Files Browser</CardTitle>
              <CardDescription>
                View and manage recorded mock files ({files.length} total)
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadFiles}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by filename or endpoint..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchTerm ? 'No files match your search' : 'No mock files found'}
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredFiles.map((file) => (
                <Card key={file.filename}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium truncate">{file.filename}</p>
                          <Badge variant="outline" className="text-xs">
                            {(file.size / 1024).toFixed(1)} KB
                          </Badge>
                        </div>
                        {file.endpoint && (
                          <p className="text-xs text-muted-foreground truncate">
                            {file.endpoint}
                          </p>
                        )}
                        {file.graphqlInfo && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            GraphQL
                          </Badge>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Modified: {new Date(file.modified).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewFile(file.filename)}
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditFile(file.filename)}
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteFile(file.filename)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedFile && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Mock File: {selectedFile.filename}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Request</h4>
                <pre className="bg-muted p-4 rounded-md overflow-auto max-h-64 text-xs">
                  {JSON.stringify(selectedFile.data.request, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Response</h4>
                <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-xs">
                  {JSON.stringify(selectedFile.data.response, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingFile} onOpenChange={(open) => !open && setEditingFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Mock File: {editingFile?.filename}</DialogTitle>
            <DialogDescription>
              Edit the response data (other fields will be preserved)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Response Data (JSON)</label>
              <textarea
                value={editContent}
                onChange={(e) => {
                  setEditContent(e.target.value)
                  validateJSON(e.target.value)
                }}
                className="w-full h-96 p-3 rounded-md border bg-background font-mono text-sm resize-y"
                placeholder="Enter JSON response data"
              />
              {editError && (
                <p className="text-sm text-destructive mt-2">{editError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFile(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={!!editError}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

