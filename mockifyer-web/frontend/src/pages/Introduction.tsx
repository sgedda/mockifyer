import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ThumbsUp, ExternalLink } from 'lucide-react'
import Logo from '@/components/Logo'
import { useToast } from '@/components/ui/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HERO_TAGLINE } from '@/lib/use-page-seo'
import HomeFaq from '@/components/HomeFaq'
import PackagesOverview from '@/components/PackagesOverview'
import { KEY_FEATURES, MCP_TOOLS } from '@/lib/product-docs'
import CodeBlock from '@/components/CodeBlock'

export default function Introduction() {
  return (
    <div className="space-y-0">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,.12),transparent_60%)]"></div>
        <div className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20 [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"></div>
        
        <div className="relative mx-auto max-w-[1200px] px-5 py-20 sm:py-28 text-center">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Deterministic test state that{' '}
            <span className="mockifyer-gradient-text">doesn't drift</span>
          </h1>
          
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            {HERO_TAGLINE}
          </p>
          
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link to="/getting-started">
              <Button size="lg" className="h-12 px-8 text-base font-medium">
                Get Started
              </Button>
            </Link>
            <Link to="/playground">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base font-medium">
                Try Playground
              </Button>
            </Link>
          </div>
          
          <div className="mx-auto mt-14 grid max-w-md grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-sm text-muted-foreground">Packages</div>
              <div className="text-2xl font-semibold text-foreground mt-1">6</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Open Source</div>
              <div className="text-2xl font-semibold text-foreground mt-1">MIT</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Platform</div>
              <div className="text-2xl font-semibold text-foreground mt-1">JS/TS</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-[1200px] px-5 py-16 space-y-20">
        {/* What is Mockifyer */}
        <section>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-2xl">What is Mockifyer?</CardTitle>
              <CardDescription className="text-base">
                Deterministic test state that doesn&apos;t drift — switchable scenario worlds for realistic testing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  Modern applications depend on many underlying systems. Test data disappears or goes stale, 
                  dates drift, and setting up the right state takes manual admin work. Mockifyer gives you 
                  deterministic state that doesn&apos;t drift.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Record real API responses once, switch between complete <strong className="text-foreground">scenario worlds</strong> at 
                  runtime (trips-empty, trips-one, trips-many, checkin-open), and control dates so time-dependent 
                  tests stay stable. No more &quot;works on my machine&quot; — the same mock world loads for everyone.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Key Features Grid */}
        <section>
          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">What you get today</h2>
            <p className="mt-2 text-muted-foreground">Everything you need for deterministic API mocking</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {KEY_FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
              >
                <span className="text-3xl block mb-3">{feature.icon}</span>
                <h3 className="text-foreground font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Packages Overview */}
        <section>
          <PackagesOverview />
        </section>

        {/* Why Mockifyer */}
        <section>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-2xl">Why Mockifyer?</CardTitle>
              <CardDescription className="text-base">
                The problem it solves
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-muted-foreground leading-relaxed">
                Applications depend on many underlying systems — APIs, databases, third-party services. 
                Testing these integrations is challenging:
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex gap-3">
                  <span className="text-primary font-semibold">→</span>
                  <span>
                    <strong className="text-foreground">Test data disappears or goes stale:</strong> A booking 
                    created yesterday might be expired today, or deleted by another developer
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-semibold">→</span>
                  <span>
                    <strong className="text-foreground">Dates drift:</strong> Time-dependent logic like 
                    &quot;upcoming trips&quot; or &quot;check-in window&quot; breaks as calendar dates move forward
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-semibold">→</span>
                  <span>
                    <strong className="text-foreground">State setup takes manual work:</strong> Creating the 
                    right test state requires clicking through admin panels or running database scripts
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-semibold">→</span>
                  <span>
                    <strong className="text-foreground">Previous fixes were hacky:</strong> Hardcoded backend 
                    bypasses tied to one test user, supporting only one dataset at a time
                  </span>
                </li>
              </ul>
              <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-foreground font-medium">
                  Mockifyer gives you deterministic state that doesn&apos;t drift. Record 
                  real API responses once, switch between complete scenarios at runtime, and control dates to keep 
                  time-dependent tests stable.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* FAQ */}
        <section>
          <HomeFaq />
        </section>

        {/* Dashboard & MCP */}
        <section>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-2xl">Dashboard & MCP</CardTitle>
              <CardDescription className="text-base">
                Optional tooling on top of the core libraries
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
              <div className="pt-4 border-t border-border">
                <p className="text-muted-foreground leading-relaxed mb-3">
                  <strong className="text-foreground">@sgedda/mockifyer-mcp</strong> exposes dashboard APIs to Cursor and Claude Desktop 
                  via Model Context Protocol. <span className="inline-flex items-center bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 text-xs px-2 py-0.5 rounded ml-2">
                    Experimental
                  </span>
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {MCP_TOOLS.map((tool) => (
                    <li key={tool} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span className="font-mono text-xs">{tool}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link to="/config-reference">
                <Button variant="outline" size="sm">
                  Configuration reference
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>

        {/* Atlas Tracing */}
        <section>
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
                  <strong>Atlas vs Network view:</strong> <span className="text-muted-foreground">The dashboard&apos;s Network tab shows live traffic hop-by-hop. 
                  Atlas maps and searches across an entire captured session, generating AI-ready documentation.</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Maestro E2E */}
        <section>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-2xl">Deterministic Maestro E2E</CardTitle>
              <CardDescription className="text-base">
                Launch arguments lock the mock world on every test run
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-muted-foreground leading-relaxed">
                Launch arguments <code className="text-xs bg-muted px-1 py-0.5 rounded border border-border">mockifyerClientId</code> and{' '}
                <code className="text-xs bg-muted px-1 py-0.5 rounded border border-border">scenario</code> start the app in the same 
                mock world on every test run. No flaky API dependencies, no race conditions.
              </p>
              <CodeBlock
                language="yaml"
                code={`- launchApp:
    clearState: true
    arguments:
      mockifyerClientId: e2e-trips-one
      scenario: trips-one`}
              />
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Workflow:</strong> Record the real API responses, have an AI write a Maestro test that 
                  starts with that scenario, then assert on what the UI components render. Every run replays the 
                  exact same backend state.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Upcoming Features */}
        <section>
          <UpcomingFeaturesCard />
        </section>

        {/* Next Steps */}
        <section>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-2xl">Next Steps</CardTitle>
              <CardDescription className="text-base">
                Explore Mockifyer's capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Link to="/getting-started" className="group block p-6 rounded-xl border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                  <div className="text-lg font-semibold text-foreground mb-2">Get Started</div>
                  <p className="text-sm text-muted-foreground">Installation and setup guide</p>
                </Link>
                <Link to="/playground" className="group block p-6 rounded-xl border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                  <div className="text-lg font-semibold text-foreground mb-2">Playground</div>
                  <p className="text-sm text-muted-foreground">Interactive demo application</p>
                </Link>
                <Link to="/comparisons" className="group block p-6 rounded-xl border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                  <div className="text-lg font-semibold text-foreground mb-2">Comparisons</div>
                  <p className="text-sm text-muted-foreground">How Mockifyer compares to alternatives</p>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}

interface Feature {
  id: string
  title: string
  description: string
  icon: string
  linearId?: string | null
  linearUrl?: string
  tags?: string[]
}

function UpcomingFeaturesCard() {
  const { toast } = useToast()
  const [features, setFeatures] = useState<Feature[]>([])
  const [votes, setVotes] = useState<Record<string, number>>({})
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
  const [featureDetails, setFeatureDetails] = useState<string | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  useEffect(() => {
    // Load votes and user's voted features from server
    async function loadVotes() {
      try {
        const response = await fetch('/api/feature-votes', {
          credentials: 'include', // Include cookies for user tracking
        })
        if (response.ok) {
          const data = await response.json()
          setVotes(data.votes || {})
          setUserVotes(new Set(data.userVotedFeatures || []))
        }
      } catch (error) {
        console.error('Failed to load votes:', error)
      }
    }

    // Fetch features from Linear API
    async function fetchFeaturesFromLinear() {
      try {
        const response = await fetch('/api/linear-features')
        if (response.ok) {
          const linearFeatures = await response.json()
          setFeatures(linearFeatures)
        } else {
          // Fallback to default features if API fails
          setFeatures([
            {
              id: 'enhanced-matching',
              title: 'Enhanced Request Matching',
              description: 'Improved algorithms for matching requests with more flexibility and accuracy',
              icon: '🔮',
            },
            {
              id: 'mock-versioning',
              title: 'Mock File Versioning',
              description: 'Track changes to mock files over time and manage different versions of your mock data',
              icon: '📚',
            },
            {
              id: 'graphql-normalization',
              title: 'GraphQL Query Normalization',
              description: 'Better handling of GraphQL queries with improved variable matching and query normalization',
              icon: '🔍',
            },
            {
              id: 'platform-support',
              title: 'Additional Platform Support',
              description: 'Extend Mockifyer to work with more environments and frameworks beyond Node.js and React Native',
              icon: '🌐',
            },
          ])
        }
      } catch (error) {
        console.error('Failed to fetch Linear features:', error)
        // Fallback to default features
        setFeatures([
          {
            id: 'enhanced-matching',
            title: 'Enhanced Request Matching',
            description: 'Improved algorithms for matching requests with more flexibility and accuracy',
            icon: '🔮',
          },
          {
            id: 'mock-versioning',
            title: 'Mock File Versioning',
            description: 'Track changes to mock files over time and manage different versions of your mock data',
            icon: '📚',
          },
          {
            id: 'graphql-normalization',
            title: 'GraphQL Query Normalization',
            description: 'Better handling of GraphQL queries with improved variable matching and query normalization',
            icon: '🔍',
          },
          {
            id: 'platform-support',
            title: 'Additional Platform Support',
            description: 'Extend Mockifyer to work with more environments and frameworks beyond Node.js and React Native',
            icon: '🌐',
          },
        ])
      } finally {
        setLoading(false)
      }
    }

    loadVotes()
    fetchFeaturesFromLinear()
  }, [])

  const handleToggleVote = async (featureId: string) => {
    try {
      const response = await fetch(`/api/feature-votes/${featureId}/toggle`, {
        method: 'POST',
        credentials: 'include', // Include cookies for user tracking
      })

      const result = await response.json()

      if (!response.ok) {
        // Handle error response from server
        toast({
          title: 'Already Voted',
          description: result.error || 'You have already voted for this feature from this network',
          variant: 'destructive',
        })
        return
      }
      
      // Update local state
      setVotes({
        ...votes,
        [featureId]: result.voteCount,
      })
      
      // Update user votes
      const newUserVotes = new Set(userVotes)
      if (result.hasVoted) {
        newUserVotes.add(featureId)
      } else {
        newUserVotes.delete(featureId)
      }
      setUserVotes(newUserVotes)

      toast({
        title: result.hasVoted ? 'Upvoted!' : 'Vote removed',
        description: result.hasVoted 
          ? 'Thank you for your feedback' 
          : 'Your vote has been removed',
      })
    } catch (error: any) {
      console.error('Failed to toggle vote:', error)
      toast({
        title: 'Error',
        description: 'Failed to save your vote. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleFeatureClick = async (feature: Feature) => {
    if (!feature.linearId) {
      return // Can't open modal without Linear ID
    }

    setSelectedFeature(feature)
    setLoadingDetails(true)
    setFeatureDetails(null)

    try {
      const response = await fetch(`/api/linear-features/${feature.linearId}`)
      if (response.ok) {
        const data = await response.json()
        setFeatureDetails(data.description || data.message || 'No description available')
      } else {
        setFeatureDetails('Failed to load issue details')
      }
    } catch (error) {
      console.error('Failed to load feature details:', error)
      setFeatureDetails('Failed to load issue details')
    } finally {
      setLoadingDetails(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Features</CardTitle>
        <CardDescription>
          What's coming next in Mockifyer. Upvote features you'd like to see prioritized!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-center text-muted-foreground py-4">Loading features...</div>
        ) : (
          <div className="space-y-3">
            {features
              .sort((a, b) => {
                const votesA = votes[a.id] || 0
                const votesB = votes[b.id] || 0
                return votesB - votesA // Sort descending by vote count
              })
              .map((feature) => {
                const voteCount = votes[feature.id] || 0
                const hasVoted = userVotes.has(feature.id)
              
              return (
                <div
                  key={feature.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors ${
                    feature.linearId ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => feature.linearId && handleFeatureClick(feature)}
                >
                  <span className="text-lg flex-shrink-0">{feature.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-semibold">{feature.title}</h4>
                          {feature.tags && feature.tags.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {feature.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant={hasVoted ? 'default' : 'outline'}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleVote(feature.id)
                        }}
                        className="flex items-center gap-1.5 h-7 px-2 flex-shrink-0"
                      >
                        <ThumbsUp className={`h-3 w-3 ${hasVoted ? 'fill-current' : ''}`} />
                        <span className="text-xs">{voteCount}</span>
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Feature Details Modal */}
      <Dialog open={!!selectedFeature} onOpenChange={(open) => !open && setSelectedFeature(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="flex items-center gap-2">
                  {selectedFeature?.icon && <span className="text-2xl">{selectedFeature.icon}</span>}
                  {selectedFeature?.title}
                </DialogTitle>
                <DialogDescription className="mt-2">
                  {selectedFeature?.description}
                </DialogDescription>
              </div>
              {selectedFeature?.linearUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <a
                    href={selectedFeature.linearUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    View in Linear
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}
            </div>
            {selectedFeature?.tags && selectedFeature.tags.length > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {selectedFeature.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </DialogHeader>
          <div className="mt-4">
            {loadingDetails ? (
              <div className="text-center text-muted-foreground py-8">Loading details...</div>
            ) : featureDetails ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md overflow-x-auto">
                  {featureDetails}
                </pre>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No additional details available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

