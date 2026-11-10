import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KEY_FEATURES } from '@/lib/product-docs'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function Features() {
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-16 space-y-12">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          All Features
        </h1>
        <p className="text-muted-foreground mt-4 text-lg max-w-3xl">
          Complete list of Mockifyer's capabilities for deterministic API mocking and testing
        </p>
      </header>

      <section>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {KEY_FEATURES.map((feature) => (
            <Card key={feature.title} className="border-border">
              <CardHeader>
                <div className="text-4xl mb-3">{feature.icon}</div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-border pt-12">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Learn More</CardTitle>
            <CardDescription className="text-base">
              Explore guides and documentation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <Link to="/getting-started" className="p-4 rounded-lg border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all">
                <h3 className="font-semibold mb-2">Getting Started</h3>
                <p className="text-sm text-muted-foreground">Installation and setup guide</p>
              </Link>
              <Link to="/playground" className="p-4 rounded-lg border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all">
                <h3 className="font-semibold mb-2">Playground</h3>
                <p className="text-sm text-muted-foreground">Interactive demo application</p>
              </Link>
              <Link to="/e2e-tutorial" className="p-4 rounded-lg border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all">
                <h3 className="font-semibold mb-2">E2E Tutorial</h3>
                <p className="text-sm text-muted-foreground">End-to-end testing guide</p>
              </Link>
              <Link to="/dashboard" className="p-4 rounded-lg border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all">
                <h3 className="font-semibold mb-2">Dashboard</h3>
                <p className="text-sm text-muted-foreground">Dashboard and MCP tooling</p>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
