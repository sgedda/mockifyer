import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function ConfigReference() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuration Reference</CardTitle>
          <CardDescription>
            Complete reference for Mockifyer configuration options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="setup">
            <TabsList>
              <TabsTrigger value="setup">Setup Options</TabsTrigger>
              <TabsTrigger value="env">Environment Variables</TabsTrigger>
              <TabsTrigger value="date">Date Configuration</TabsTrigger>
            </TabsList>

            <TabsContent value="setup" className="space-y-4 mt-4">
              <div>
                <h4 className="font-semibold mb-2">setupMockifyer Options</h4>
                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
{`{
  mockDataPath: string;        // Path to store/load mock files
  recordMode?: boolean;         // Enable recording mode
  failOnMissingMock?: boolean;  // Fail if no mock found
  useGlobalAxios?: boolean;     // Patch global axios instance
  useGlobalFetch?: boolean;     // Patch global fetch
  generateTests?: {             // Auto-generate tests
    enabled: boolean;
    framework: 'jest' | 'vitest' | 'mocha';
    outputPath: string;
  }
}`}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="env" className="space-y-4 mt-4">
              <div>
                <h4 className="font-semibold mb-2">Environment Variables</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <code className="bg-muted px-2 py-1 rounded">MOCKIFYER_ENABLED</code>
                    <p className="text-muted-foreground mt-1">Enable/disable Mockifyer</p>
                  </div>
                  <div>
                    <code className="bg-muted px-2 py-1 rounded">MOCKIFYER_PATH</code>
                    <p className="text-muted-foreground mt-1">Path to mock data directory</p>
                  </div>
                  <div>
                    <code className="bg-muted px-2 py-1 rounded">MOCKIFYER_RECORD</code>
                    <p className="text-muted-foreground mt-1">Enable recording mode</p>
                  </div>
                  <div>
                    <code className="bg-muted px-2 py-1 rounded">MOCKIFYER_DATE</code>
                    <p className="text-muted-foreground mt-1">Fixed date (ISO format)</p>
                  </div>
                  <div>
                    <code className="bg-muted px-2 py-1 rounded">MOCKIFYER_DATE_OFFSET</code>
                    <p className="text-muted-foreground mt-1">Date offset in milliseconds</p>
                  </div>
                  <div>
                    <code className="bg-muted px-2 py-1 rounded">MOCKIFYER_TIMEZONE</code>
                    <p className="text-muted-foreground mt-1">IANA timezone identifier</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="date" className="space-y-4 mt-4">
              <div>
                <h4 className="font-semibold mb-2">Date Manipulation</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Use <code className="bg-muted px-1 rounded">getCurrentDate()</code> from{' '}
                  <code className="bg-muted px-1 rounded">@sgedda/mockifyer-core</code> instead of{' '}
                  <code className="bg-muted px-1 rounded">new Date()</code> for date manipulation to work.
                </p>
                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
{`import { getCurrentDate } from '@sgedda/mockifyer-core';

// Use this instead of new Date()
const currentDate = getCurrentDate();`}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
