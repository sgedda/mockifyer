import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-24 text-center space-y-8">
      <div className="space-y-4">
        <h1 className="text-6xl sm:text-8xl font-bold text-primary">404</h1>
        <h2 className="text-2xl sm:text-3xl font-semibold">Page Not Found</h2>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      
      <div className="flex flex-wrap justify-center gap-4">
        <Link to="/">
          <Button size="lg" className="h-12 px-8">
            <Home className="mr-2 h-5 w-5" />
            Go Home
          </Button>
        </Link>
        <Button size="lg" variant="outline" className="h-12 px-8" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-5 w-5" />
          Go Back
        </Button>
      </div>
    </div>
  )
}
