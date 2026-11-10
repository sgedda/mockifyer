import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Github, ArrowRight, PlayCircle, Code, Layers, TestTube2, Calendar, Database, Workflow } from 'lucide-react'
import Logo from '@/components/Logo'
import CodeBlock from '@/components/CodeBlock'
import { HERO_TAGLINE } from '@/lib/use-page-seo'

export default function Introduction() {
  return (
    <div className="space-y-0">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,.12),transparent_60%)]"></div>
        <div className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20 [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"></div>
        
        <div className="relative mx-auto max-w-[1200px] px-5 py-16 sm:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Hero Content */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Logo size="md" />
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground leading-tight">
                Deterministic test state that{' '}
                <span className="mockifyer-gradient-text">doesn't drift</span>
              </h1>
              
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl">
                {HERO_TAGLINE}
              </p>
              
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/getting-started">
                  <Button size="lg" className="h-12 px-8 text-base font-medium">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a href="https://github.com/sgedda/mockifyer" target="_blank" rel="noopener noreferrer">
                  <Button size="lg" variant="outline" className="h-12 px-8 text-base font-medium">
                    <Github className="mr-2 h-5 w-5" />
                    GitHub
                  </Button>
                </a>
              </div>
            </div>

            {/* Right: Code Example */}
            <div className="lg:order-last">
              <CodeBlock
                language="typescript"
                code={`// Setup once
setupMockifyerForReactNative({
  mockDataPath: './mock-data',
  defaultScenario: 'trips-many'
});

// Switch scenarios at runtime
setActiveScenario('trips-empty');
setActiveScenario('trips-one');
setActiveScenario('checkin-open');

// Same mock world, every test run`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Why Mockifyer */}
      <section className="mx-auto max-w-[1200px] px-5 py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-center mb-4">Why Mockifyer?</h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Testing integrations is challenging when data disappears, dates drift, and state setup requires manual work
        </p>
        
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="text-2xl mb-3">💔</div>
            <h3 className="font-semibold text-lg mb-2">Test Data Disappears</h3>
            <p className="text-sm text-muted-foreground">
              A booking created yesterday might be expired today, or deleted by another developer
            </p>
          </div>
          
          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="text-2xl mb-3">📅</div>
            <h3 className="font-semibold text-lg mb-2">Dates Drift</h3>
            <p className="text-sm text-muted-foreground">
              Time-dependent logic like "upcoming trips" or "check-in window" breaks as calendar dates move forward
            </p>
          </div>
          
          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="text-2xl mb-3">⚙️</div>
            <h3 className="font-semibold text-lg mb-2">Manual State Setup</h3>
            <p className="text-sm text-muted-foreground">
              Creating the right test state requires clicking through admin panels or running database scripts
            </p>
          </div>
          
          <div className="p-6 rounded-xl border border-border bg-card">
            <div className="text-2xl mb-3">✅</div>
            <h3 className="font-semibold text-lg mb-2">Mockifyer Fixes This</h3>
            <p className="text-sm text-muted-foreground">
              Record once, switch scenarios at runtime, control dates—deterministic state that doesn't drift
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-[1200px] px-5 py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-center mb-12">How It Works</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                <Code className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg mb-2">1. Record</h3>
              <p className="text-sm text-muted-foreground">
                Capture real API responses as JSON files during development
              </p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                <Layers className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg mb-2">2. Switch Scenarios</h3>
              <p className="text-sm text-muted-foreground">
                Organize mocks into complete worlds: trips-empty, trips-one, trips-many
              </p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                <PlayCircle className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-lg mb-2">3. Replay in Tests</h3>
              <p className="text-sm text-muted-foreground">
                Lock the mock world with launch arguments—same state every run
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="mx-auto max-w-[1200px] px-5 py-20">
        <h2 className="text-3xl font-semibold tracking-tight text-center mb-4">Key Features</h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Everything you need for deterministic API mocking and testing
        </p>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="group p-6 rounded-xl border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
            <Layers className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Switchable Scenarios</h3>
            <p className="text-sm text-muted-foreground">
              Flip between complete mock datasets at runtime from your dev menu
            </p>
          </div>
          
          <div className="group p-6 rounded-xl border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
            <Calendar className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Deterministic Dates</h3>
            <p className="text-sm text-muted-foreground">
              Fix dates per scenario so time-dependent tests stay stable
            </p>
          </div>
          
          <div className="group p-6 rounded-xl border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
            <TestTube2 className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Maestro E2E</h3>
            <p className="text-sm text-muted-foreground">
              Launch arguments lock the mock world—no API flakes
            </p>
          </div>
          
          <div className="group p-6 rounded-xl border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
            <Database className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Client Lanes</h3>
            <p className="text-sm text-muted-foreground">
              Per-device isolation via Redis/SQLite for multi-tester workflows
            </p>
          </div>
          
          <div className="group p-6 rounded-xl border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
            <Workflow className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Atlas Tracing</h3>
            <p className="text-sm text-muted-foreground">
              Press 't' in Metro to capture nested HTTP calls with payload search
            </p>
          </div>
          
          <div className="group p-6 rounded-xl border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
            <Code className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">React Native + Expo</h3>
            <p className="text-sm text-muted-foreground">
              Hybrid storage, Metro sync, device-to-repo two-way sync
            </p>
          </div>
        </div>
        
        <div className="text-center mt-12">
          <Link to="/features">
            <Button variant="outline" size="lg">
              View All Features
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-[1200px] px-5 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight mb-4">Ready to Get Started?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Install Mockifyer and start building deterministic tests in minutes
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/getting-started">
              <Button size="lg" className="h-12 px-8 text-base font-medium">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/playground">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base font-medium">
                <PlayCircle className="mr-2 h-5 w-5" />
                Try Playground
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
