import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'
import RunItButton from '@/components/RunItButton'
import { MCP_TOOLS } from '@/lib/product-docs'

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-16 space-y-16">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          Dashboard & Tooling
        </h1>
        <p className="text-muted-foreground mt-4 text-lg max-w-3xl">
          Optional tooling on top of the core libraries: Dashboard UI, Atlas tracing, and MCP integration
        </p>
      </header>

      {/* Dashboard */}
      <section>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Dashboard UI</CardTitle>
            <CardDescription className="text-base">
              Web interface for managing scenarios, client lanes, and network traffic
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-muted-foreground leading-relaxed mb-4">
                <strong className="text-foreground">@sgedda/mockifyer-dashboard</strong> runs locally to manage scenarios, client lanes, 
                network hops, and Date Config. With Redis or SQLite, it proxies traffic so each device/app 
                has its own isolated mock world.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {['Active scenario and client lane management', 'Browse and edit JSON mocks for each world', 'Network view: live hops filtered by lane', 'Date Config: per-scenario date overrides', 'Domain-path rules: control which endpoints to record/mock'].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <CodeBlock
              language="bash"
              code={`npx @sgedda/mockifyer-dashboard --path ./mock-data`}
            />
            <div className="flex gap-3 flex-wrap">
              <Link to="/config-reference">
                <Button variant="outline" size="sm">
                  Configuration Reference
                </Button>
              </Link>
              <RunItButton 
                project="nested-services"
                title="Try Live Demo: Nested Services + Tracing"
                size="sm"
              />
            </div>
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm text-foreground">
                <strong>Live Demo:</strong> <span className="text-muted-foreground">
                  See the dashboard in action with a BFF calling 3 downstream services (Weather → Places → Currency). 
                  Watch request tracing correlate the entire chain, switch scenarios from the UI, and explore mocks in the dashboard.
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Atlas */}
      <section id="network">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Atlas: Live Tracing with the <code className="text-sm">t</code> Key</CardTitle>
            <CardDescription className="text-base">
              Press <code className="text-sm">t</code> in the Metro terminal to capture and visualize nested HTTP calls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              When running React Native with Metro, press <code className="text-xs bg-muted px-1 py-0.5 rounded border border-border">t</code> to 
              start <strong className="text-foreground">Atlas capture</strong>. A browser opens showing a live stream of correlated, nested 
              HTTP calls as an expandable/collapsible tree: app → BFF → downstream services.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {['View request/response payloads with inline search', 'Find booking data the UI doesn\'t display yet', 'Trace error chains across multiple hops', 'Verify what actually went over the wire', 'Press t again to stop and render searchable HTML docs'].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-foreground">
                <strong>Atlas vs Network view:</strong> <span className="text-muted-foreground">The dashboard's Network tab shows live traffic hop-by-hop. 
                Atlas maps and searches across an entire captured session, generating AI-ready documentation.</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* MCP */}
      <section>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">MCP Integration</CardTitle>
            <CardDescription className="text-base">
              AI tools for Cursor and Claude Desktop
              <span className="inline-flex items-center bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 text-xs px-2 py-0.5 rounded ml-2">
                Experimental
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">@sgedda/mockifyer-mcp</strong> exposes dashboard APIs to Cursor and Claude Desktop 
              via Model Context Protocol. Tell your AI: "set my lane to trips-empty" or "override booking status to CONFIRMED".
            </p>
            <div>
              <h3 className="font-semibold mb-3">Available MCP Tools</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {MCP_TOOLS.map((tool) => (
                  <li key={tool} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span className="font-mono text-xs">{tool}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Next Steps */}
      <section className="border-t border-border pt-12">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Get Started</CardTitle>
            <CardDescription className="text-base">
              Install and configure dashboard tooling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <Link to="/getting-started" className="p-4 rounded-lg border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all">
                <h3 className="font-semibold mb-2">Installation Guide</h3>
                <p className="text-sm text-muted-foreground">Step-by-step setup instructions</p>
              </Link>
              <Link to="/config-reference" className="p-4 rounded-lg border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all">
                <h3 className="font-semibold mb-2">Configuration</h3>
                <p className="text-sm text-muted-foreground">Dashboard settings and options</p>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
