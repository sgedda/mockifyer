import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Folder, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import PackagesOverview from '@/components/PackagesOverview'
import { REPO_ONLY_PACKAGES, SITE_GITHUB } from '@/lib/product-docs'

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
          Packages
        </h1>
        <p className="text-muted-foreground mt-4 text-lg max-w-3xl">
          npm packages and repo-only tools
        </p>
      </header>

      <section>
        <PackagesOverview />
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Not Published to npm</h2>
          <p className="text-muted-foreground mt-2">These packages are only available by building from source in the monorepo.</p>
        </div>
        {REPO_ONLY_PACKAGES.map((pkg) => (
          <Card key={pkg.name}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Folder className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-xl">{pkg.name}</CardTitle>
                    <CardDescription className="mt-1">v{pkg.version} • Not on npm</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">{pkg.role}</p>
              <div className="bg-muted/50 rounded-lg p-3 border border-border space-y-1">
                <p className="text-sm font-medium">Build from source:</p>
                <code className="block text-xs font-mono bg-background/50 px-2 py-1 rounded">
                  cd {pkg.buildPath} && npm install && npm run build
                </code>
              </div>
              <a 
                href={`${SITE_GITHUB}/tree/main/${pkg.buildPath}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                View in GitHub
              </a>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
