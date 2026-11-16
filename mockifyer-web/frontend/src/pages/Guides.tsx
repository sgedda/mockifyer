import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getExistingContent, GUIDES } from '@/lib/content-registry'
import { ArrowRight } from 'lucide-react'

export default function Guides() {
  const existingGuides = getExistingContent(GUIDES)

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 space-y-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold mb-4">Mockifyer Guides</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          In-depth guides for testing patterns, React Native E2E, debugging tester bugs, and avoiding mock drift.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {existingGuides.map((guide) => (
          <Card key={guide.path} className="hover:border-primary/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-xl">
                <Link to={guide.path} className="hover:text-primary transition-colors flex items-center gap-2">
                  {guide.title}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </CardTitle>
              <CardDescription>{guide.summary}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to={guide.path}
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                Read guide
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle>More Resources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Link to="/comparisons" className="text-primary hover:underline font-medium">
              Tool Comparisons
            </Link>
            <p className="text-sm text-muted-foreground mt-1">
              Compare Mockifyer with MSW, Polly.js, Nock, WireMock, and other mocking tools.
            </p>
          </div>
          <div>
            <Link to="/e2e-tutorial" className="text-primary hover:underline font-medium">
              E2E Tutorial
            </Link>
            <p className="text-sm text-muted-foreground mt-1">
              End-to-end walkthrough using the WanderWeird demo: multi-service scenarios and tracing.
            </p>
          </div>
          <div>
            <Link to="/getting-started" className="text-primary hover:underline font-medium">
              Getting Started
            </Link>
            <p className="text-sm text-muted-foreground mt-1">
              Install and configure Mockifyer for axios or fetch in minutes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
