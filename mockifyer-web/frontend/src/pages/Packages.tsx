import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import PackagesOverview from '@/components/PackagesOverview'

export default function Packages() {
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
          Published Packages
        </h1>
        <p className="text-muted-foreground mt-4 text-lg max-w-3xl">
          All @sgedda/mockifyer-* packages published to npm
        </p>
      </header>

      <section>
        <PackagesOverview />
      </section>
    </div>
  )
}
