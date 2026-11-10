import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Menu, Moon, Sun, Github, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import Logo from './Logo'
import { useTheme } from '@/lib/use-theme'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const navItems = [
  { href: '/getting-started', label: 'Get Started' },
  { href: '/features', label: 'Features' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/packages', label: 'Packages' },
  { href: '/faq', label: 'FAQ' },
]

const guideItems = [
  { href: '/guides/mock-at-the-network-edge', label: 'Mock at the Network Edge' },
  { href: '/guides/reproduce-tester-bugs', label: 'Reproduce Tester Bugs' },
  { href: '/guides/stable-react-native-e2e', label: 'Stable React Native E2E' },
  { href: '/guides/mock-drift', label: 'Stop Mock Drift' },
  { href: '/guides/react-native-without-msw', label: 'React Native: Handlers vs Recording' },
]

export default function Navigation() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  const isActive = (path: string) => {
    return location.pathname === path || 
           (path === '/' && location.pathname === '/')
  }

  const isGuidesActive = () => {
    return location.pathname.startsWith('/guides/')
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-5">
        <Link to="/" className="flex items-center gap-2 flex-shrink-0" aria-label="Mockifyer home">
          <Logo />
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`px-3 py-1.5 rounded-md text-[15px] font-medium transition-colors ${
                isActive(item.href)
                  ? 'text-foreground bg-muted'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {item.label}
            </Link>
          ))}
          
          {/* Guides Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`px-3 py-1.5 rounded-md text-[15px] font-medium transition-colors inline-flex items-center gap-1 ${
                  isGuidesActive()
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                Guides
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {guideItems.map((guide) => (
                <DropdownMenuItem key={guide.href} asChild>
                  <Link to={guide.href} className="cursor-pointer">
                    {guide.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Desktop Actions */}
        <div className="ml-auto hidden lg:flex items-center gap-2">
          <a
            href="https://github.com/sgedda/mockifyer"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="GitHub"
          >
            <Github className="h-5 w-5" />
          </a>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault()
              toggleTheme()
            }}
            className="rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Mobile Actions */}
        <div className="ml-auto lg:hidden flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault()
              toggleTheme()
            }}
            className="text-muted-foreground"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-muted-foreground"
            aria-label="Menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="lg:hidden border-t border-border px-5 py-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2.5 rounded-lg text-[15px] font-medium ${
                isActive(item.href)
                  ? 'text-foreground bg-muted'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {item.label}
            </Link>
          ))}
          
          {/* Guides submenu */}
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Guides
          </div>
          {guideItems.map((guide) => (
            <Link
              key={guide.href}
              to={guide.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 ml-2 rounded-lg text-sm font-medium ${
                isActive(guide.href)
                  ? 'text-foreground bg-muted'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {guide.label}
            </Link>
          ))}
          
          <a
            href="https://github.com/sgedda/mockifyer"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[15px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
        </nav>
      )}
    </nav>
  )
}

