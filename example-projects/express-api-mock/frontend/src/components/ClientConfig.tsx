import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ClientConfigProps {
  clientType: 'axios' | 'fetch'
  scope: 'local' | 'global'
  onClientTypeChange: (value: 'axios' | 'fetch') => void
  onScopeChange: (value: 'local' | 'global') => void
}

export default function ClientConfig({
  clientType,
  scope,
  onClientTypeChange,
  onScopeChange,
}: ClientConfigProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Configuration</CardTitle>
        <CardDescription>
          Configure which HTTP client and scope to use for requests
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="client-type">HTTP Client</Label>
            <Select value={clientType} onValueChange={onClientTypeChange}>
              <SelectTrigger id="client-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="axios">Axios</SelectItem>
                <SelectItem value="fetch">Fetch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="scope">Scope</Label>
            <Select value={scope} onValueChange={onScopeChange}>
              <SelectTrigger id="scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="global">Global</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 p-3 bg-muted rounded-md">
          <p className="text-sm">
            <strong>Current Config:</strong>{' '}
            <span className="font-mono">
              {clientType.charAt(0).toUpperCase() + clientType.slice(1)} +{' '}
              {scope.charAt(0).toUpperCase() + scope.slice(1)}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}


