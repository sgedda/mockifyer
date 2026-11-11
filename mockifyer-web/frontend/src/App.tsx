import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import Navigation from './components/Navigation'
import Footer from './components/Footer'
import { Navigate } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import { ThemeProvider } from './lib/use-theme'
import PageSeoManager from './components/PageSeoManager'

// Eager load only the homepage
import Introduction from './pages/Introduction'

// Lazy load all other pages for code splitting
const DateConfig = lazy(() => import('./pages/DateConfig'))
const GettingStarted = lazy(() => import('./pages/GettingStarted'))
const ConfigReference = lazy(() => import('./pages/ConfigReference'))
const Contact = lazy(() => import('./pages/Contact'))
const Comparisons = lazy(() => import('./pages/Comparisons'))
const E2ETutorial = lazy(() => import('./pages/E2ETutorial'))
const Features = lazy(() => import('./pages/Features'))
const FAQ = lazy(() => import('./pages/FAQ'))
const Packages = lazy(() => import('./pages/Packages'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const MockAtTheNetworkEdge = lazy(() => import('./pages/guides/MockAtTheNetworkEdge'))
const ReproduceTesterBugs = lazy(() => import('./pages/guides/ReproduceTesterBugs'))
const StableReactNativeE2E = lazy(() => import('./pages/guides/StableReactNativeE2E'))
const MockDrift = lazy(() => import('./pages/guides/MockDrift'))
const ReactNativeWithoutMSW = lazy(() => import('./pages/guides/ReactNativeWithoutMSW'))
const Guides = lazy(() => import('./pages/Guides'))
const NotFound = lazy(() => import('./pages/NotFound'))

function HashScrollHandler() {
  const location = useLocation()

  useEffect(() => {
    if (location.hash) {
      const element = document.getElementById(location.hash.substring(1))
      if (element) {
        setTimeout(() => {
          const headerOffset = 64
          const elementPosition = element.getBoundingClientRect().top
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          })
        }, 0)
      }
    }
  }, [location])

  return null
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      {/* Ensure .dark class is included in build - used dynamically */}
      <div className="hidden dark:block" />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <div className="min-h-screen bg-background">
          <PageSeoManager />
          <HashScrollHandler />
          <Navigation />
          <main>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
              <Route path="/" element={<Introduction />} />
              <Route path="/index.html" element={<Introduction />} />
              <Route path="/features" element={<Features />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/packages" element={<Packages />} />
              <Route path="/dashboard" element={<Dashboard />} />
              
              {/* Guides */}
              <Route path="/guides" element={<Guides />} />
              <Route path="/guides/mock-at-the-network-edge" element={<MockAtTheNetworkEdge />} />
              <Route path="/guides/reproduce-tester-bugs" element={<ReproduceTesterBugs />} />
              <Route path="/guides/stable-react-native-e2e" element={<StableReactNativeE2E />} />
              <Route path="/guides/mock-drift" element={<MockDrift />} />
              <Route path="/guides/react-native-without-msw" element={<ReactNativeWithoutMSW />} />
              
              {/* Redirects for removed pages */}
              <Route path="/playground" element={<Navigate to="/getting-started" replace />} />
              <Route path="/timeline" element={<Navigate to="/dashboard#network" replace />} />
              <Route path="/settings" element={<Navigate to="/date-config" replace />} />
              
              <Route path="/date-config" element={<DateConfig />} />
              <Route path="/getting-started" element={<GettingStarted />} />
              <Route path="/config-reference" element={<ConfigReference />} />
              <Route path="/comparisons" element={<Comparisons />} />
              <Route path="/e2e-tutorial" element={<E2ETutorial />} />
              <Route path="/contact" element={<Contact />} />
              
              {/* 404 catch-all */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
          <Toaster />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App

