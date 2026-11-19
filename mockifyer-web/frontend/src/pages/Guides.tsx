import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { GUIDE_ITEMS } from '@/lib/product-docs'
import { PAGE_SEO } from '@/lib/seo-config'

export default function Guides() {
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-16 space-y-12">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight flex items-center gap-3">
          <BookOpen className="h-10 w-10 text-primary" />
          Mockifyer Guides
        </h1>
        <p className="text-muted-foreground mt-4 text-lg max-w-3xl">
          Practical guides for record-replay API mocking across Node, React Native, browsers, and CI.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {GUIDE_ITEMS.map((guide) => {
          const seo = PAGE_SEO[guide.href]
          return (
            <Link key={guide.href} to={guide.href} className="group">
              <Card className="h-full border-border transition-colors group-hover:border-primary/40">
                <CardHeader>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">
                    {guide.label}
                  </CardTitle>
                  {seo?.description ? (
                    <CardDescription className="text-base">{seo.description}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent>
                  <span className="text-sm font-medium text-primary">Read guide →</span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </section>

      <section className="border-t border-border pt-10">
        <p className="text-muted-foreground mb-4">Looking for install steps or comparisons?</p>
        <div className="flex flex-wrap gap-3">
          <Link to="/getting-started">
            <Button variant="outline">Getting Started</Button>
          </Link>
          <Link to="/comparisons">
            <Button variant="outline">Comparisons</Button>
          </Link>
          <Link to="/faq">
            <Button variant="outline">FAQ</Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
