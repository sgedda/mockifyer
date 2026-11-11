import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PUBLISHED_PACKAGES } from '@/lib/product-docs'
import { ExternalLink, Copy } from 'lucide-react'
import { useState, useRef } from 'react'

interface PackagesOverviewProps {
  title?: string
  description?: string
}

export default function PackagesOverview({
  title = 'Published packages',
  description = 'Install scoped npm packages from @sgedda — not the private monorepo root.',
}: PackagesOverviewProps) {
  const [copiedPackage, setCopiedPackage] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copyInstallCommand = (installCmd: string, pkgName: string) => {
    navigator.clipboard.writeText(installCmd)
    setCopiedPackage(pkgName)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => setCopiedPackage(null), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {PUBLISHED_PACKAGES.map((pkg) => {
            const installCmd = pkg.install || `npm install ${pkg.name}`
            return (
              <div key={pkg.name} className="space-y-3 pb-6 border-b border-border/50 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={pkg.npmUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-lg text-primary hover:underline inline-flex items-center gap-1.5"
                      >
                        {pkg.name}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <Badge variant="secondary">{pkg.version}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-2">{pkg.role}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 bg-muted/50 rounded-lg px-4 py-3 border border-border">
                    <code className="text-sm font-mono flex-1">{installCmd}</code>
                    <button
                      onClick={() => copyInstallCommand(installCmd, pkg.name)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded hover:bg-background/80"
                      aria-label="Copy install command"
                    >
                      {copiedPackage === pkg.name ? (
                        <span className="text-xs font-medium text-green-600 dark:text-green-400">Copied!</span>
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <a
                    href={`https://github.com/sgedda/mockifyer/tree/main/packages/${pkg.name.split('/')[1]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View source
                  </a>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-sm text-muted-foreground pt-4 border-t border-border/50">
          Full documentation:{' '}
          <a
            href="https://github.com/sgedda/mockifyer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            github.com/sgedda/mockifyer
          </a>
        </p>
      </CardContent>
    </Card>
  )
}
