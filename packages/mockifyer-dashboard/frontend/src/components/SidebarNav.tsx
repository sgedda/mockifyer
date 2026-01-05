import { Link, useLocation } from 'react-router-dom'
import { FileText, BarChart3, Settings, Zap, GitBranch, Calendar } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

interface SidebarNavProps {
  activeTab?: string
  onTabChange: (tab: string) => void
  onNavigate?: () => void
}

export default function SidebarNav({ onTabChange, onNavigate }: SidebarNavProps) {
  const location = useLocation()
  
  const navItems = [
    { id: 'stats', label: 'Statistics', icon: BarChart3, path: '/' },
    { id: 'mocks', label: 'Mocks', icon: FileText, path: '/mocks' },
    { id: 'timeline', label: 'Timeline', icon: GitBranch, path: '/timeline' },
    { id: 'date-config', label: 'Date Config', icon: Calendar, path: '/date-config' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ]

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname === path
  }

  return (
    <Sidebar className="border-r border-border bg-card h-full w-64">
      <SidebarHeader className="px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Mockifyer</div>
            <div className="text-xs text-muted-foreground">Dashboard</div>
          </div>
        </div>
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => {
                  onTabChange(item.id)
                  onNavigate?.() // Close sidebar on mobile when navigating
                }}
                className="block"
              >
                <SidebarMenuItem
                  active={isActive(item.path)}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </SidebarMenuItem>
              </Link>
            )
          })}
        </SidebarGroup>
      </SidebarContent>
      <Separator />
      <SidebarFooter className="px-4 py-4">
            <div className="text-xs text-muted-foreground">
              Version 1.2.0
            </div>
      </SidebarFooter>
    </Sidebar>
  )
}

