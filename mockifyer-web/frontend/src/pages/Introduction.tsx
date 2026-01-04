import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ThumbsUp, ExternalLink } from 'lucide-react'
import Logo from '@/components/Logo'
import { useToast } from '@/components/ui/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
            <strong className="text-foreground text-lg mb-4 block">Key Benefits:</strong>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                <span className="text-2xl flex-shrink-0">🔒</span>
                <div>
                  <strong className="text-foreground block mb-1">Deterministic testing</strong>
                  <p className="text-sm text-muted-foreground">Predictable, reproducible tests with structured JSON mock data</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                <span className="text-2xl flex-shrink-0">📅</span>
                <div>
                  <strong className="text-foreground block mb-1">Date manipulation</strong>
                  <p className="text-sm text-muted-foreground">Test time-dependent features with fixed or offset dates</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                <span className="text-2xl flex-shrink-0">🔄</span>
                <div>
                  <strong className="text-foreground block mb-1">Easy recording</strong>
                  <p className="text-sm text-muted-foreground">Automatically capture real API responses for later use</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                <span className="text-2xl flex-shrink-0">📁</span>
                <div>
                  <strong className="text-foreground block mb-1">Easy data discovery</strong>
                  <p className="text-sm text-muted-foreground">All captured responses stored as searchable JSON files in your project</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                <span className="text-2xl flex-shrink-0">🎭</span>
                <div>
                  <strong className="text-foreground block mb-1">Scenario switching</strong>
                  <p className="text-sm text-muted-foreground">Switch between different mock data sets (happy path, errors, edge cases) with just a click</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                <span className="text-2xl flex-shrink-0">🧪</span>
                <div>
                  <strong className="text-foreground block mb-1">Automatic test generation</strong>
                  <p className="text-sm text-muted-foreground">Generate unit tests automatically when recording mocks</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                <span className="text-2xl flex-shrink-0">🌐</span>
                <div>
                  <strong className="text-foreground block mb-1">Works with any HTTP client</strong>
                  <p className="text-sm text-muted-foreground">Supports Axios, Fetch, and more</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                <span className="text-2xl flex-shrink-0">🚀</span>
                <div>
                  <strong className="text-foreground block mb-1">Offline development</strong>
                  <p className="text-sm text-muted-foreground">Work without internet connection or external API dependencies</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Why Mockifyer?</CardTitle>
          <CardDescription>
            The motivation behind creating Mockifyer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Mockifyer was created to address the lack of an easy way to record and replicate API responses for mocked data. 
            Traditional mocking solutions often require manual setup, don't handle state changes well, and make it difficult 
            to test different scenarios reliably.
          </p>
          <p className="text-muted-foreground">
            With Mockifyer, you can easily record real API responses and set up different datasets called "scenarios" to 
            replicate realistic testing scenarios. This allows you to test various outcomes—happy paths, error cases, edge 
            cases—without worrying about state changes. Features like deterministic dates ensure your tests remain consistent 
            and reproducible, eliminating flaky tests caused by time-dependent logic.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Focus</CardTitle>
          <CardDescription>
            Platform support and future plans
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Our current focus is on building something useful that works seamlessly in both <strong>Node.js</strong> and 
            <strong> React Native</strong> environments. These platforms have unique challenges—Node.js services need 
            reliable API mocking for backend testing, while React Native requires special handling for Metro bundler and 
            file system access.
          </p>
          <p className="text-muted-foreground">
            We plan to expand support to other environments in the future, making Mockifyer a universal solution for API 
            mocking across different platforms and frameworks.
          </p>
        </CardContent>
      </Card>

      <UpcomingFeaturesCard />

      <Card>
        <CardHeader>
          <CardTitle>Playground</CardTitle>
          <CardDescription>
            The Playground is an interactive example application that demonstrates Mockifyer's capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/playground">
            <Button>Explore Playground</Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link to="/getting-started" className="block">
            <Button variant="outline" className="w-full justify-start">
              Get Started Guide
            </Button>
          </Link>
          <Link to="/playground" className="block">
            <Button variant="outline" className="w-full justify-start">
              Try the Playground
            </Button>
          </Link>
          <Link to="/request-flow" className="block">
            <Button variant="outline" className="w-full justify-start">
              View Request Flow Visualization
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

interface Feature {
  id: string
  title: string
  description: string
  icon: string
  linearId?: string | null
  linearUrl?: string
  tags?: string[]
}

function UpcomingFeaturesCard() {
  const { toast } = useToast()
  const [features, setFeatures] = useState<Feature[]>([])
  const [votes, setVotes] = useState<Record<string, number>>({})
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
  const [featureDetails, setFeatureDetails] = useState<string | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  useEffect(() => {
    // Load votes and user's voted features from server
    async function loadVotes() {
      try {
        const response = await fetch('/api/feature-votes', {
          credentials: 'include', // Include cookies for user tracking
        })
        if (response.ok) {
          const data = await response.json()
          setVotes(data.votes || {})
          setUserVotes(new Set(data.userVotedFeatures || []))
        }
      } catch (error) {
        console.error('Failed to load votes:', error)
      }
    }

    // Fetch features from Linear API
    async function fetchFeaturesFromLinear() {
      try {
        const response = await fetch('/api/linear-features')
        if (response.ok) {
          const linearFeatures = await response.json()
          setFeatures(linearFeatures)
        } else {
          // Fallback to default features if API fails
          setFeatures([
            {
              id: 'enhanced-matching',
              title: 'Enhanced Request Matching',
              description: 'Improved algorithms for matching requests with more flexibility and accuracy',
              icon: '🔮',
            },
            {
              id: 'mock-versioning',
              title: 'Mock File Versioning',
              description: 'Track changes to mock files over time and manage different versions of your mock data',
              icon: '📚',
            },
            {
              id: 'graphql-normalization',
              title: 'GraphQL Query Normalization',
              description: 'Better handling of GraphQL queries with improved variable matching and query normalization',
              icon: '🔍',
            },
            {
              id: 'platform-support',
              title: 'Additional Platform Support',
              description: 'Extend Mockifyer to work with more environments and frameworks beyond Node.js and React Native',
              icon: '🌐',
            },
          ])
        }
      } catch (error) {
        console.error('Failed to fetch Linear features:', error)
        // Fallback to default features
        setFeatures([
          {
            id: 'enhanced-matching',
            title: 'Enhanced Request Matching',
            description: 'Improved algorithms for matching requests with more flexibility and accuracy',
            icon: '🔮',
          },
          {
            id: 'mock-versioning',
            title: 'Mock File Versioning',
            description: 'Track changes to mock files over time and manage different versions of your mock data',
            icon: '📚',
          },
          {
            id: 'graphql-normalization',
            title: 'GraphQL Query Normalization',
            description: 'Better handling of GraphQL queries with improved variable matching and query normalization',
            icon: '🔍',
          },
          {
            id: 'platform-support',
            title: 'Additional Platform Support',
            description: 'Extend Mockifyer to work with more environments and frameworks beyond Node.js and React Native',
            icon: '🌐',
          },
        ])
      } finally {
        setLoading(false)
      }
    }

    loadVotes()
    fetchFeaturesFromLinear()
  }, [])

  const handleToggleVote = async (featureId: string) => {
    try {
      const response = await fetch(`/api/feature-votes/${featureId}/toggle`, {
        method: 'POST',
        credentials: 'include', // Include cookies for user tracking
      })

      const result = await response.json()

      if (!response.ok) {
        // Handle error response from server
        toast({
          title: 'Already Voted',
          description: result.error || 'You have already voted for this feature from this network',
          variant: 'destructive',
        })
        return
      }
      
      // Update local state
      setVotes({
        ...votes,
        [featureId]: result.voteCount,
      })
      
      // Update user votes
      const newUserVotes = new Set(userVotes)
      if (result.hasVoted) {
        newUserVotes.add(featureId)
      } else {
        newUserVotes.delete(featureId)
      }
      setUserVotes(newUserVotes)

      toast({
        title: result.hasVoted ? 'Upvoted!' : 'Vote removed',
        description: result.hasVoted 
          ? 'Thank you for your feedback' 
          : 'Your vote has been removed',
      })
    } catch (error: any) {
      console.error('Failed to toggle vote:', error)
      toast({
        title: 'Error',
        description: 'Failed to save your vote. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleFeatureClick = async (feature: Feature) => {
    if (!feature.linearId) {
      return // Can't open modal without Linear ID
    }

    setSelectedFeature(feature)
    setLoadingDetails(true)
    setFeatureDetails(null)

    try {
      const response = await fetch(`/api/linear-features/${feature.linearId}`)
      if (response.ok) {
        const data = await response.json()
        setFeatureDetails(data.description || data.message || 'No description available')
      } else {
        setFeatureDetails('Failed to load issue details')
      }
    } catch (error) {
      console.error('Failed to load feature details:', error)
      setFeatureDetails('Failed to load issue details')
    } finally {
      setLoadingDetails(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Features</CardTitle>
        <CardDescription>
          What's coming next in Mockifyer. Upvote features you'd like to see prioritized!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-center text-muted-foreground py-4">Loading features...</div>
        ) : (
          <div className="space-y-3">
            {features
              .sort((a, b) => {
                const votesA = votes[a.id] || 0
                const votesB = votes[b.id] || 0
                return votesB - votesA // Sort descending by vote count
              })
              .map((feature) => {
                const voteCount = votes[feature.id] || 0
                const hasVoted = userVotes.has(feature.id)
              
              return (
                <div
                  key={feature.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors ${
                    feature.linearId ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => feature.linearId && handleFeatureClick(feature)}
                >
                  <span className="text-lg flex-shrink-0">{feature.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-semibold">{feature.title}</h4>
                          {feature.tags && feature.tags.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {feature.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant={hasVoted ? 'default' : 'outline'}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleVote(feature.id)
                        }}
                        className="flex items-center gap-1.5 h-7 px-2 flex-shrink-0"
                      >
                        <ThumbsUp className={`h-3 w-3 ${hasVoted ? 'fill-current' : ''}`} />
                        <span className="text-xs">{voteCount}</span>
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Feature Details Modal */}
      <Dialog open={!!selectedFeature} onOpenChange={(open) => !open && setSelectedFeature(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="flex items-center gap-2">
                  {selectedFeature?.icon && <span className="text-2xl">{selectedFeature.icon}</span>}
                  {selectedFeature?.title}
                </DialogTitle>
                <DialogDescription className="mt-2">
                  {selectedFeature?.description}
                </DialogDescription>
              </div>
              {selectedFeature?.linearUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <a
                    href={selectedFeature.linearUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    View in Linear
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}
            </div>
            {selectedFeature?.tags && selectedFeature.tags.length > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {selectedFeature.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </DialogHeader>
          <div className="mt-4">
            {loadingDetails ? (
              <div className="text-center text-muted-foreground py-8">Loading details...</div>
            ) : featureDetails ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md overflow-x-auto">
                  {featureDetails}
                </pre>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No additional details available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

