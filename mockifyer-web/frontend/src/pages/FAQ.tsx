import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import HomeFaq from '@/components/HomeFaq'

export default function FAQ() {
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
          Frequently Asked Questions
        </h1>
        <p className="text-muted-foreground mt-4 text-lg max-w-3xl">
          Common questions about Mockifyer and how it works
        </p>
      </header>

      <section>
        <HomeFaq />
      </section>

      <section className="border-t border-border pt-12">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Still Have Questions?</CardTitle>
            <CardDescription className="text-base">
              Get in touch or explore our documentation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4">
              <Link to="/contact">
                <Button variant="outline" className="w-full">
                  Contact Us
                </Button>
              </Link>
              <Link to="/getting-started">
                <Button variant="outline" className="w-full">
                  Documentation
                </Button>
              </Link>
              <a href="https://github.com/sgedda/mockifyer/issues" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full">
                  GitHub Issues
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
