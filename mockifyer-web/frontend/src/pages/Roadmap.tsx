import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function Roadmap() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Roadmap</CardTitle>
          <CardDescription>
            Upcoming features and ideas for Mockifyer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="default">Planned</Badge>
              <div>
                <h4 className="font-semibold">Enhanced Request Matching</h4>
                <p className="text-sm text-muted-foreground">
                  Improved algorithms for matching requests with more flexibility
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="default">Planned</Badge>
              <div>
                <h4 className="font-semibold">Mock File Versioning</h4>
                <p className="text-sm text-muted-foreground">
                  Track changes to mock files over time
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="default">Planned</Badge>
              <div>
                <h4 className="font-semibold">GraphQL Query Normalization</h4>
                <p className="text-sm text-muted-foreground">
                  Better handling of GraphQL queries with variable matching
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge variant="outline">In Progress</Badge>
              <div>
                <h4 className="font-semibold">Dashboard Improvements</h4>
                <p className="text-sm text-muted-foreground">
                  Enhanced UI with React and shadcn/ui components
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
