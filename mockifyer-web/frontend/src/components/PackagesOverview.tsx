import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PUBLISHED_PACKAGES } from '@/lib/product-docs'
import { ExternalLink } from 'lucide-react'

interface PackagesOverviewProps {
  title?: string
  description?: string
}

export default function PackagesOverview({
  title = 'Published packages',
  description = 'Install scoped npm packages from @sgedda — not the private monorepo root.',
}: PackagesOverviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 pr-4 font-semibold">Package</th>
                <th className="pb-2 pr-4 font-semibold">Version</th>
                <th className="pb-2 font-semibold">Role</th>
              </tr>
            </thead>
            <tbody>
              {PUBLISHED_PACKAGES.map((pkg) => (
                <tr key={pkg.name} className="border-b border-border/50 align-top">
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <a
                      href={pkg.npmUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {pkg.name}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant="secondary">{pkg.version}</Badge>
                  </td>
                  <td className="py-3 text-muted-foreground">{pkg.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          Full source and deep docs:{' '}
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
