import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'

type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'mockifyer-theme'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

/**
 * Get initial theme from localStorage or system preference
 * This function can be called before React renders to prevent flash
 */
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  
  // Check localStorage first
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
  if (stored === 'light' || stored === 'dark') {
    return stored
  }
  
  // Fallback to system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  
  return 'light'
}

/**
 * Apply theme class to document root
 * For light mode, we remove the 'dark' class (use :root defaults)
 * For dark mode, we add the 'dark' class
 * Also removes any other theme classes like 'dim'
 */
function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  
  const root = document.documentElement
  // Remove all theme classes first
  root.classList.remove('dark', 'dim', 'light')
  
  // Add the appropriate theme class
  if (theme === 'dark') {
    root.classList.add('dark')
  }
  // For light mode, we don't add any class (use :root defaults)
}

/**
 * Theme Provider component
 * Wrap your app with this to enable theme management
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  // Wrapper to ensure theme is applied when state changes
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    }
  }, [])

  useEffect(() => {
    // Apply theme on mount and when it changes
    applyTheme(theme)
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const newTheme = prev === 'light' ? 'dark' : 'light'
      // Apply immediately
      applyTheme(newTheme)
      if (typeof window !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme)
      }
      return newTheme
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Hook to access theme context
 * Must be used within a ThemeProvider
 */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

/**
 * Initialize theme synchronously before React renders
 * Call this in main.tsx before ReactDOM.render
 */
export function initTheme() {
  const initialTheme = getInitialTheme()
  applyTheme(initialTheme)
}

