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

      <section className="p-4 border border-blue-500/50 bg-blue-500/10 rounded-md">
        <p className="text-blue-900 dark:text-blue-200 text-sm">
          <strong>Note:</strong> The MCP server for Cursor and Claude Desktop is available at{' '}
          <code className="bg-muted px-1 py-0.5 rounded">packages/mockifyer-mcp</code> in the{' '}
          <a 
            href="https://github.com/sgedda/mockifyer" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            GitHub repo
          </a>
          . It's experimental and local-only (not published to npm). See{' '}
          <code className="bg-muted px-1 py-0.5 rounded">.cursor/README.md</code> for setup instructions.
        </p>
      </section>
    </div>
  )
}
