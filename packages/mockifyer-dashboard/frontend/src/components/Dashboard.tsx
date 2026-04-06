import { useState, useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
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
  const [loadingMock, setLoadingMock] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const { toast } = useToast()

  // Sync activeTab with URL path
  useEffect(() => {
    const tabFromPath = getActiveTabFromPath()
    if (tabFromPath !== activeTab) {
      setActiveTab(tabFromPath)
    }
  }, [location.pathname])

  useEffect(() => {
    if (activeTab === 'mocks') {
      loadMocks()
      // Check for endpoint query parameter
      const params = new URLSearchParams(location.search)
      const qParam = params.get('q')
      const endpointParam = params.get('endpoint')
      if (qParam) {
        setSearchQuery(qParam)
      } else if (endpointParam) {
        setSearchQuery(endpointParam)
      }
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
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load mocks',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectMock(file: MockFile) {
    try {
      setLoadingMock(true)
      const mockData = await getMock(file.filename)
      setSelectedMock(mockData)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load mock data',
        variant: 'destructive',
      })
    } finally {
      setLoadingMock(false)
    }
  }

  const filteredMocks = mocks.filter(mock => {
    const query = searchQuery.toLowerCase()
    return (
      mock.filename.toLowerCase().includes(query) ||
      mock.endpoint?.toLowerCase().includes(query) ||
      mock.graphqlInfo?.query.toLowerCase().includes(query)
    )
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
                    loadingMock={loadingMock}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    selectedMock={selectedMock}
                    onSelectMock={handleSelectMock}
                    onRefresh={loadMocks}
                  />
                  <Dialog
                    open={!!selectedMock}
                    onOpenChange={(open) => {
                      if (!open) setSelectedMock(null)
                    }}
                  >
                    <DialogContent
                      showCloseButton
                      className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96rem,96vw)] w-[min(96rem,96vw)]"
                    >
                      {selectedMock ? (
                        <>
                          <DialogTitle className="sr-only">Edit mock {selectedMock.filename}</DialogTitle>
                          <MockEditor
                            variant="modal"
                            mock={selectedMock}
                            onClose={() => setSelectedMock(null)}
                            onSave={loadMocks}
                          />
                        </>
                      ) : null}
                    </DialogContent>
                  </Dialog>
                </div>
              }
            />
            <Route path="/timeline" element={<Timeline scenario={scenario} />} />
            <Route path="/date-config" element={<DateConfig />} />
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

