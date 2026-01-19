import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui/use-toast'
import MockList from './MockList'
import MockEditor from './MockEditor'
import StatsView from './StatsView'
import Settings from './Settings'
import Timeline from './Timeline'
import DateConfig from './DateConfig'
import SidebarNav from './SidebarNav'
import { getMocks, getMock } from '@/lib/api'
import type { MockFile, MockData } from '@/types'

interface DashboardProps {
  scenario: string
  onScenarioChange: (scenario: string) => void
}

export default function Dashboard({ scenario, onScenarioChange }: DashboardProps) {
  const location = useLocation()
  const navigate = useNavigate()
  
  // Get active tab from URL path
  const getActiveTabFromPath = () => {
    const path = location.pathname
    if (path === '/mocks') return 'mocks'
    if (path === '/timeline') return 'timeline'
    if (path === '/date-config') return 'date-config'
    if (path === '/settings') return 'settings'
    return 'stats' // default to stats (root path)
  }
  
  const [activeTab, setActiveTab] = useState(getActiveTabFromPath())
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mocks, setMocks] = useState<MockFile[]>([])
  const [selectedMock, setSelectedMock] = useState<MockData | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const { toast } = useToast()
  const mockEditorRef = useRef<HTMLDivElement>(null)

  // Sync activeTab with URL path
  useEffect(() => {
    const tabFromPath = getActiveTabFromPath()
    if (tabFromPath !== activeTab) {
      setActiveTab(tabFromPath)
    }
  }, [location.pathname])

  useEffect(() => {
    if (activeTab === 'mocks') {
      loadMocks().then((loadedMocks) => {
        // Check for endpoint, method, or filename query parameter after mocks are loaded
        const params = new URLSearchParams(location.search)
        const endpointParam = params.get('endpoint')
        const methodParam = params.get('method')
        const filenameParam = params.get('filename')
        
        if (endpointParam) {
          setSearchQuery(endpointParam)
        } else if (methodParam) {
          // Set search query to method for display purposes
          setSearchQuery(methodParam)
        }
        
        if (filenameParam && loadedMocks) {
          // Find and select the mock with matching filename
          const mockFile = loadedMocks.find((m: MockFile) => m.filename === filenameParam)
          if (mockFile) {
            handleSelectMock(mockFile)
          }
        }
      })
    }
  }, [scenario, activeTab, location.search])

  // Handle tab change - update URL
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setSidebarOpen(false) // Close sidebar on mobile when navigating
    const pathMap: Record<string, string> = {
      'mocks': '/mocks',
      'timeline': '/timeline',
      'stats': '/',
      'date-config': '/date-config',
      'settings': '/settings',
    }
    navigate(pathMap[tab] || '/')
  }

  async function loadMocks() {
    try {
      setLoading(true)
      const data = await getMocks(scenario)
      setMocks(data.files)
      return data.files
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load mocks',
        variant: 'destructive',
      })
      return []
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectMock(file: MockFile) {
    try {
      const mockData = await getMock(file.filename)
      setSelectedMock(mockData)
      // Scroll to editor after a delay to ensure it's rendered
      setTimeout(() => {
        if (mockEditorRef.current) {
          mockEditorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 200)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load mock data',
        variant: 'destructive',
      })
    }
  }

  // Also scroll when selectedMock changes (in case it's set from elsewhere)
  useEffect(() => {
    if (selectedMock && mockEditorRef.current) {
      setTimeout(() => {
        mockEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 200)
    }
  }, [selectedMock])

  const filteredMocks = mocks.filter(mock => {
    const query = searchQuery.toLowerCase()
    const params = new URLSearchParams(location.search)
    const methodParam = params.get('method')
    
    // Filter by method if specified
    if (methodParam) {
      // Extract method from filename (format: timestamp_METHOD_url.json)
      // Filename format: YYYY-MM-DD_HH-MM-SS_METHOD_url.json
      let mockMethod = 'GET'
      
      const filenameParts = mock.filename.split('_')
      if (filenameParts.length >= 3) {
        // The method is typically the 3rd part (index 2) after timestamp parts
        // Format: YYYY-MM-DD_HH-MM-SS_METHOD_url.json
        const potentialMethod = filenameParts[2].toUpperCase()
        // Check if it's a valid HTTP method
        const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
        if (validMethods.includes(potentialMethod)) {
          mockMethod = potentialMethod
        }
      }
      
      if (mockMethod !== methodParam.toUpperCase()) {
        return false
      }
    }
    
    // Filter by search query
    if (query) {
      return (
        mock.filename.toLowerCase().includes(query) ||
        mock.endpoint?.toLowerCase().includes(query) ||
        mock.graphqlInfo?.query.toLowerCase().includes(query)
      )
    }
    
    return true
  })

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - hidden on mobile, shown via hamburger */}
      <div
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <SidebarNav 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          onNavigate={() => setSidebarOpen(false)}
        />
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            {/* Hamburger menu button - visible on mobile */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-md hover:bg-accent transition-colors"
              aria-label="Toggle menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {sidebarOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-semibold">Mockifyer Dashboard</h1>
              <p className="text-sm text-muted-foreground">Manage and view your API mock data</p>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Routes>
            <Route
              path="/"
              element={
                <StatsView
                  scenario={scenario}
                  onScenarioChange={(newScenario) => {
                    onScenarioChange(newScenario)
                  }}
                />
              }
            />
            <Route
              path="/mocks"
              element={
                <div className="space-y-6">
                  <MockList
                    mocks={filteredMocks}
                    loading={loading}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    selectedMock={selectedMock}
                    onSelectMock={handleSelectMock}
                    onRefresh={loadMocks}
                  />
                  {selectedMock && (
                    <MockEditor
                      ref={mockEditorRef}
                      mock={selectedMock}
                      onClose={() => setSelectedMock(null)}
                      onSave={loadMocks}
                    />
                  )}
                </div>
              }
            />
            <Route path="/timeline" element={<Timeline scenario={scenario} />} />
            <Route path="/date-config" element={<DateConfig scenario={scenario} onScenarioChange={onScenarioChange} />} />
            <Route
              path="/settings"
              element={
                <Settings
                  scenario={scenario}
                  onScenarioChange={(newScenario) => {
                    onScenarioChange(newScenario)
                    setSelectedMock(null)
                  }}
                />
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  )
}

