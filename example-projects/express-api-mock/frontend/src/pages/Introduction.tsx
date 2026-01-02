import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import Logo from '@/components/Logo'

export default function Introduction() {
  return (
    <div className="space-y-8">
      <header className="text-center py-12">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          A powerful Node.js library for mocking and recording API calls, with advanced date manipulation for
          deterministic testing
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>What is Mockifyer?</CardTitle>
          <CardDescription>
            Mockifyer is a comprehensive API mocking and testing library designed to make your development and
            testing workflows more efficient and reliable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            It intercepts HTTP requests made by your application and can either replay previously recorded responses
            or record new ones for future use.
          </p>
          <div>
            <strong className="text-foreground">Key Benefits:</strong>
            <ul className="list-disc list-inside mt-2 space-y-2 text-muted-foreground">
              <li>🚫 <strong>No more API rate limits:</strong> Test without worrying about external API quotas</li>
              <li>⚡ <strong>Faster tests:</strong> Mock responses are instant, no network latency</li>
              <li>🔒 <strong>Deterministic testing:</strong> Same inputs always produce the same outputs</li>
              <li>📅 <strong>Date manipulation:</strong> Test time-dependent features with fixed or offset dates</li>
              <li>🔄 <strong>Easy recording:</strong> Automatically capture real API responses for later use</li>
              <li>🌐 <strong>Works with any HTTP client:</strong> Supports Axios, Fetch, and more</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Playground</CardTitle>
          <CardDescription>
            The Playground is an interactive example application that demonstrates Mockifyer's capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/playground.html">
            <Button>Explore Playground</Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link to="/getting-started.html" className="block">
            <Button variant="outline" className="w-full justify-start">
              Get Started Guide
            </Button>
          </Link>
          <Link to="/playground.html" className="block">
            <Button variant="outline" className="w-full justify-start">
              Try the Playground
            </Button>
          </Link>
          <Link to="/request-flow.html" className="block">
            <Button variant="outline" className="w-full justify-start">
              View Request Flow Visualization
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

