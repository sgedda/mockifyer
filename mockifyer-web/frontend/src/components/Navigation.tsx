import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Menu, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import Logo from './Logo'
import { useTheme } from '@/lib/use-theme'

const navItems = [
  { href: '/getting-started', label: 'Getting Started' },
  { href: '/playground', label: 'Playground' },
  { href: '/timeline', label: 'Timeline' },
  { href: '/settings', label: 'Settings' },
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
    <nav className="border-b bg-card">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-2">
          <Logo className="flex-shrink-0" />
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-end min-w-0 max-w-full overflow-hidden">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`px-2 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                    isActive(item.href)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Theme Toggle - Always visible on desktop */}
          <div className="hidden md:flex items-center flex-shrink-0 ml-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault()
                toggleTheme()
              }}
              className="flex-shrink-0"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault()
                toggleTheme()
              }}
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
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t py-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm font-medium ${
                  isActive(item.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}

