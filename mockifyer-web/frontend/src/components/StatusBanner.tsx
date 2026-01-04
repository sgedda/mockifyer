import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Github } from 'lucide-react'

interface StatusData {
  mockifyerVersion: string
  deployedDate: string
  githubRepo: string
}

export default function StatusBanner() {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    try {
      const response = await fetch('/api/status')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Failed to load status:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return null
  }

  const deployedDateTime = status?.deployedDate
    ? (() => {
        const date = new Date(status.deployedDate)
        return date.toLocaleString()
      })()
    : 'Unknown'

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">📦 Mockifyer:</span>
              <Badge variant="default">
                {status?.mockifyerVersion || 'unknown'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">🚀 Deployed:</span>
              <span className="text-sm text-muted-foreground">
                {deployedDateTime}
              </span>
            </div>
          </div>
          {status?.githubRepo && (
            <a
              href={status.githubRepo}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" />
              <span>GitHub</span>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}


