import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import EnvVarReference from '@/components/EnvVarReference'
import PackagesOverview from '@/components/PackagesOverview'
import CodeBlock from '@/components/CodeBlock'
import {
  ACTIVATION_MODE_DOCS,
  MCP_TOOLS,
  SETUP_MOCKIFYER_OPTIONS,
} from '@/lib/product-docs'

export default function ConfigReference() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuration Reference</h1>
        <p className="text-muted-foreground mt-2">
          setupMockifyer options, environment variables, activation modes, and optional tooling
        </p>
      </div>

      <PackagesOverview
        title="Packages"
        description="Published @sgedda libraries — versions match the current monorepo release."
      />

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Aligned with @sgedda/mockifyer-core types and ENV_VARS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="setup">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="env">Environment</TabsTrigger>
              <TabsTrigger value="activation">Activation</TabsTrigger>
              <TabsTrigger value="date">Dates</TabsTrigger>
              <TabsTrigger value="tooling">Dashboard & MCP</TabsTrigger>
            </TabsList>

            <TabsContent value="setup" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Pass these to <code className="bg-muted px-1 rounded">setupMockifyer()</code> from
                @sgedda/mockifyer-axios or @sgedda/mockifyer-fetch. React Native uses{' '}
                <code className="bg-muted px-1 rounded">setupMockifyerForReactNative</code> plus{' '}
                <code className="bg-muted px-1 rounded">MOCKIFYER_MODE</code> for startup gating.
              </p>
              <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                {SETUP_MOCKIFYER_OPTIONS}
              </pre>
            </TabsContent>

            <TabsContent value="env" className="mt-4">
              <EnvVarReference />
            </TabsContent>

            <TabsContent value="activation" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Control whether each outbound HTTP call is intercepted. Env{' '}
                <code className="bg-muted px-1 rounded">MOCKIFYER_ACTIVATION_MODE</code> overrides{' '}
                <code className="bg-muted px-1 rounded">activationMode</code> in config. Header name:{' '}
                <code className="bg-muted px-1 rounded">X-Mockifyer-Client-Id</code> (exported from core).
              </p>
              <ul className="space-y-3 text-sm">
                {ACTIVATION_MODE_DOCS.map((item) => (
                  <li key={item.mode}>
                    <strong className="font-mono">{item.mode}</strong>
                    <span className="text-muted-foreground"> — {item.description}</span>
                  </li>
                ))}
              </ul>
              <CodeBlock
                language="typescript"
                code={`import { setupMockifyer } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data',
  activationMode: 'client_id_header',
  recordMode: false,
});

// Real API (no header)
await axios.get('https://api.example.com/health');

// Mocked or recorded
await axios.get('https://api.example.com/v1/profile', {
  headers: { 'X-Mockifyer-Client-Id': 'ci-lane-1' },
});`}
              />
            </TabsContent>

            <TabsContent value="date" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground mb-4">
                Use <code className="bg-muted px-1 rounded">getCurrentDate()</code> from{' '}
                @sgedda/mockifyer-core instead of <code className="bg-muted px-1 rounded">new Date()</code>.
                Priority: env vars → setupMockifyer dateManipulation → system time.
              </p>
              <CodeBlock
                language="typescript"
                code={`import { setupMockifyer, getCurrentDate } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data',
  dateManipulation: { fixedDate: '2024-01-01T00:00:00.000Z' },
});

const now = getCurrentDate();`}
              />
            </TabsContent>

            <TabsContent value="tooling" className="space-y-4 mt-4">
              <div>
                <h4 className="font-semibold mb-2">Dashboard</h4>
                <CodeBlock
                  language="bash"
                  code={`npx @sgedda/mockifyer-dashboard --path ./mock-data
# default http://localhost:3002

# Redis proxy + client lanes (multi-service)
npx @sgedda/mockifyer-dashboard --provider redis --redis-url redis://127.0.0.1:6379`}
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Browse and edit mock JSON, activate passthrough recordings, switch scenarios, view
                  network events and per-lane client connections.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">MCP server (@sgedda/mockifyer-mcp)</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Connect from Cursor or Claude Desktop while the dashboard is running:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                  {MCP_TOOLS.map((tool) => (
                    <li key={tool}>{tool}</li>
                  ))}
                </ul>
                <CodeBlock
                  language="json"
                  className="mt-3"
                  code={`{
  "mcpServers": {
    "mockifyer": {
      "command": "node",
      "args": ["/path/to/mockifyer/packages/mockifyer-mcp/dist/cli.js"],
      "env": { "MOCKIFYER_DASHBOARD_URL": "http://localhost:3002" }
    }
  }
}`}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
