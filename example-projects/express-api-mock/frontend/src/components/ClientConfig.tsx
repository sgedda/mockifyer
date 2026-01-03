import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronDown, ChevronUp } from 'lucide-react'
import CodeBlock from './CodeBlock'

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
  // Load saved state from localStorage, default to true (expanded)
  const [isCodeExpanded, setIsCodeExpanded] = useState(() => {
    const saved = localStorage.getItem('client-config-code-expanded')
    return saved !== null ? saved === 'true' : true
  })

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('client-config-code-expanded', String(isCodeExpanded))
  }, [isCodeExpanded])

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

        <div className="mt-6">
          <div className="mb-4 p-3 bg-muted rounded-md">
            <p className="text-sm font-semibold mb-2">Scope Differences:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>Global:</strong> Patches the global <code className="bg-background px-1 rounded">fetch</code> or <code className="bg-background px-1 rounded">axios</code> - all HTTP requests in your app are automatically mocked</li>
              <li><strong>Local:</strong> Returns a wrapped instance - only requests made through that instance are mocked, doesn't affect global HTTP clients</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              <strong>Use Local when:</strong> You want isolated mocking, multiple Mockifyer instances, or don't want to affect other libraries/modules using HTTP clients.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCodeExpanded(!isCodeExpanded)}
            className="w-full justify-between p-2 h-auto"
          >
            <span className="text-sm font-semibold">Code Example</span>
            {isCodeExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          {isCodeExpanded && (
            <div className="mt-3">
          {clientType === 'axios' ? (
            <CodeBlock
              code={scope === 'global' 
                ? `import { setupMockifyerAxios } from '@sgedda/mockifyer-axios';

// Setup Mockifyer with Axios (patches global axios)
setupMockifyerAxios({
  mockDataPath: './mock-data',
  recordMode: false,
  useGlobalAxios: true,
});

// Use global axios directly - no need to store return value
import axios from 'axios';

// GET request
const getResponse = await axios.get('/api/users/1');
console.log(getResponse.data);

// POST request
const postResponse = await axios.post('/api/users', {
  name: 'John',
  email: 'john@example.com'
});
console.log(postResponse.data);`
                : `import { setupMockifyerAxios } from '@sgedda/mockifyer-axios';

// Setup Mockifyer with Axios (returns wrapped instance)
const axios = setupMockifyerAxios({
  mockDataPath: './mock-data',
  recordMode: false,
  useGlobalAxios: false,
});

// Use the returned axios instance
// GET request
const getResponse = await axios.get('/api/users/1');
console.log(getResponse.data);

// POST request
const postResponse = await axios.post('/api/users', {
  name: 'John',
  email: 'john@example.com'
});
console.log(postResponse.data);`}
              language="typescript"
              small
            />
          ) : (
            <CodeBlock
              code={scope === 'global'
                ? `import { setupMockifyerFetch } from '@sgedda/mockifyer-fetch';

// Setup Mockifyer with Fetch (patches global fetch)
setupMockifyerFetch({
  mockDataPath: './mock-data',
  recordMode: false,
  useGlobalFetch: true,
});

// Use global fetch directly - no need to store return value
// GET request
const getResponse = await fetch('/api/users/1');
const getData = await getResponse.json();
console.log(getData);

// POST request
const postResponse = await fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John',
    email: 'john@example.com'
  })
});
const postData = await postResponse.json();
console.log(postData);`
                : `import { setupMockifyerFetch } from '@sgedda/mockifyer-fetch';

// Setup Mockifyer with Fetch (returns wrapped function)
const fetch = setupMockifyerFetch({
  mockDataPath: './mock-data',
  recordMode: false,
  useGlobalFetch: false,
});

// Use the returned fetch function
// GET request
const getResponse = await fetch('/api/users/1');
const getData = await getResponse.json();
console.log(getData);

// POST request
const postResponse = await fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John',
    email: 'john@example.com'
  })
});
const postData = await postResponse.json();
console.log(postData);`}
              language="typescript"
              small
            />
          )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}


