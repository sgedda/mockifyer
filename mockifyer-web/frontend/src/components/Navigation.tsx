import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Menu, Moon, Sun, Github } from 'lucide-react'
import { useState } from 'react'
import Logo from './Logo'
import { useTheme } from '@/lib/use-theme'

const navItems = [
  { href: '/getting-started', label: 'Getting Started' },
  { href: '/playground', label: 'Playground' },
  { href: '/comparisons', label: 'Comparisons' },
  { href: '/e2e-tutorial', label: 'E2E Tutorial' },
  { href: '/contact', label: 'Contact' },
]

export default function Navigation() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  const isActive = (path: string) => {
    return location.pathname === path || 
           (path === '/' && location.pathname === '/')
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

