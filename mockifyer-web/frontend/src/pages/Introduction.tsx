import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Github, ArrowRight, PlayCircle, Calendar, Database, Code2, Sparkles, Construction, Target, Zap, GitBranch, Terminal } from 'lucide-react'
import Logo from '@/components/Logo'
import CodeBlock from '@/components/CodeBlock'

export default function Introduction() {
  return (
    <div className="space-y-0">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,.12),transparent_60%)]"></div>
        <div className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20 [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"></div>
        
        <div className="relative mx-auto max-w-[1200px] px-5 py-16 sm:py-24">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-6">
              <Logo size="lg" />
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground leading-tight">
              Record real traffic.{' '}
              <span className="mockifyer-gradient-text">Replay in tests.</span>
            </h1>
            
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              HTTP mock record/replay for JavaScript and React Native. No account, no cloud—mocks are JSON in your repo or your own Redis/SQLite.
            </p>
            
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/getting-started">
                <Button size="lg" className="h-12 px-8 text-base font-medium">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/e2e-tutorial">
                <Button size="lg" variant="outline" className="h-12 px-8 text-base font-medium">
                  <PlayCircle className="mr-2 h-5 w-5" />
                  E2E Tutorial
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* See It In Action Showcase */}
      <section className="mx-auto max-w-[1200px] px-5 py-16 border-b border-border">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-semibold tracking-tight mb-3">See It In Action</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Record traffic, edit mocks in the dashboard, and control delay/status for every scenario
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            Want to try it yourself? Check out the{' '}
            <a 
              href="https://github.com/sgedda/mockifyer/tree/main/example-projects/wanderweird-travel" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              WanderWeird demo app
            </a>
            {' '}— a full-stack Expo + multi-service example (7 Node services, Umbraco CMS, scenarios, request tracing).{' '}
            <Link to="/e2e-tutorial" className="text-primary hover:underline font-medium">
              E2E Tutorial →
            </Link>
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto rounded-xl border border-border bg-card overflow-hidden">
          <video
            src="/videos/e2e-tutorial/delay-and-status-override_b200.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="w-full"
            style={{ aspectRatio: '1662/800' }}
          >
            Your browser doesn't support video playback.
          </video>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4 mt-6 max-w-4xl mx-auto">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <video
              src="/videos/e2e-tutorial/mock-editor-body-edit_7064.mp4"
              muted
              loop
              playsInline
              preload="metadata"
              className="w-full"
              onMouseEnter={(e) => e.currentTarget.play()}
              onMouseLeave={(e) => e.currentTarget.pause()}
            >
              Your browser doesn't support video playback.
            </video>
            <div className="p-3 text-sm text-center text-muted-foreground">
              Edit mock response bodies in real-time
            </div>
          </div>
          
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <video
              src="/videos/e2e-tutorial/header-scenario-picker_4de8.mp4"
              muted
              loop
              playsInline
              preload="metadata"
              className="w-full"
              onMouseEnter={(e) => e.currentTarget.play()}
              onMouseLeave={(e) => e.currentTarget.pause()}
            >
              Your browser doesn't support video playback.
            </video>
            <div className="p-3 text-sm text-center text-muted-foreground">
              Switch scenarios to test different states
            </div>
          </div>
        </div>
      </section>

      {/* Problems It Solves */}
      <section className="mx-auto max-w-[1200px] px-5 py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-center mb-4">The Problems Mockifyer Solves</h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Testing integrations is hard when dependencies aren't stable
        </p>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border border-border bg-card">
            <Construction className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">API Isn't Ready Yet</h3>
            <p className="text-sm text-muted-foreground">
              Backend is still being built but you need to build and test the frontend now
            </p>
          </div>
          
          <div className="p-6 rounded-xl border border-border bg-card">
            <Target className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">Hard-to-Reproduce States</h3>
            <p className="text-sm text-muted-foreground">
              Errors, slowness, a specific date, or edge cases that you can't easily set up in a live API
            </p>
          </div>
          
          <div className="p-6 rounded-xl border border-border bg-card">
            <Zap className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">E2E Tests Flake on Live Data</h3>
            <p className="text-sm text-muted-foreground">
              Real APIs change, data disappears, dates drift—tests that passed yesterday fail today
            </p>
          </div>
          
          <div className="p-6 rounded-xl border border-border bg-card">
            <GitBranch className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">Trace Requests Across Services</h3>
            <p className="text-sm text-muted-foreground">
              Follow request chains service-to-service via <code className="text-xs bg-muted px-1 py-0.5 rounded">x-mockifyer-request-id</code> headers. See what each hop sent and received.
            </p>
          </div>
          
          <div className="p-6 rounded-xl border border-border bg-card">
            <Terminal className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-2">Replicate Any Request with curl</h3>
            <p className="text-sm text-muted-foreground">
              Export recorded requests as copy-paste curl commands. Test backends directly, share reproduction steps.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works - 3 Steps */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-[1200px] px-5 py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-center mb-12">How It Works</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                <Code2 className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg mb-2">1. Record</h3>
              <p className="text-sm text-muted-foreground">
                Run with <code className="text-xs bg-muted px-1 py-0.5 rounded border border-border">MOCKIFYER_RECORD=true</code>. Every HTTP request is captured as JSON.
              </p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                <Database className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg mb-2">2. Organize Scenarios</h3>
              <p className="text-sm text-muted-foreground">
                Edit mocks in the dashboard. Create scenario folders (trips-empty, trips-many).
              </p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                <PlayCircle className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg mb-2">3. Replay in Tests</h3>
              <p className="text-sm text-muted-foreground">
                Lock the scenario with launch arguments—same state every run.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="mx-auto max-w-[1200px] px-5 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-semibold tracking-tight mb-4">Setup in 30 Seconds</h2>
          <p className="text-muted-foreground mb-8">
            Add one setup call at app startup. That's it.
          </p>
          
          <CodeBlock
            language="typescript"
            code={`import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch';

setupMockifyerForReactNative({
  mockDataPath: './mock-data',
  recordMode: false,
  dateManipulation: {
    fixedDate: '2024-12-20',
    timezone: 'America/New_York'
  }
});

// Your app code runs normally—fetch is patched automatically`}
          />
          
          <div className="mt-8 p-5 rounded-xl border border-primary/20 bg-primary/5">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">Date Freezing & Shifting</h3>
                <p className="text-sm text-muted-foreground">
                  Fix dates per scenario so "check-in opens today" stays stable. Shift relative to now, or freeze at a specific date. Time-dependent tests stay green.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-[1200px] px-5 py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-center mb-12">Use Cases</h2>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="p-6 rounded-xl border border-border bg-card">
              <Code2 className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-lg mb-2">React Native Development</h3>
              <p className="text-sm text-muted-foreground">
                Develop mobile apps with consistent mock data. Switch scenarios from your dev menu, test edge cases, and work offline.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border border-border bg-card">
              <PlayCircle className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-lg mb-2">Deterministic E2E Tests</h3>
              <p className="text-sm text-muted-foreground">
                Lock the mock world with launch arguments. Same state every run—no flakes, no external dependencies.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border border-border bg-card">
              <Database className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-lg mb-2">Demos & Presentations</h3>
              <p className="text-sm text-muted-foreground">
                Show your app with perfect data every time. No network issues, no unexpected responses during the demo.
              </p>
            </div>
            
            <div className="p-6 rounded-xl border border-border bg-card">
              <Sparkles className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-lg mb-2">AI Agents via MCP</h3>
              <p className="text-sm text-muted-foreground">
                Connect Cursor or Claude to your dashboard. AI can search mocks, set scenarios, and override field values. <strong>Not on npm</strong>—local tooling only.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-[1200px] px-5 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Ready to Get Started?</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Install Mockifyer and start building deterministic tests in minutes. No account required, no cloud service—everything runs locally.
        </p>
        
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/getting-started">
            <Button size="lg" className="h-12 px-8 text-base font-medium">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/e2e-tutorial">
            <Button size="lg" variant="outline" className="h-12 px-8 text-base font-medium">
              <PlayCircle className="mr-2 h-5 w-5" />
              E2E Tutorial
            </Button>
          </Link>
          <a href="https://github.com/sgedda/mockifyer" target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="outline" className="h-12 px-8 text-base font-medium">
              <Github className="mr-2 h-5 w-5" />
              GitHub
            </Button>
          </a>
        </div>
      </section>
    </div>
  )
}
