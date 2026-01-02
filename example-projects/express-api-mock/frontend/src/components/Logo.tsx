import { Link } from 'react-router-dom'
import { Network } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
  as?: 'link' | 'div'
}

export default function Logo({ className, showIcon = true, size = 'md', as = 'link' }: LogoProps) {
  const sizeClasses = {
    sm: { text: 'text-lg', icon: 'h-4 w-4', padding: 'p-1.5' },
    md: { text: 'text-xl', icon: 'h-5 w-5', padding: 'p-2' },
    lg: { text: 'text-3xl md:text-4xl', icon: 'h-8 w-8 md:h-10 md:w-10', padding: 'p-2.5 md:p-3' },
  }

  const content = (
    <div
      className={cn(
        'flex items-center gap-2.5 md:gap-3 font-bold',
        sizeClasses[size].text,
        className
      )}
    >
      {showIcon && (
        <div className="relative flex-shrink-0 group">
          {/* Animated glow effect */}
          <div className="absolute inset-0 bg-primary/40 blur-xl rounded-xl group-hover:bg-primary/60 transition-colors duration-300"></div>
          {/* Icon container with gradient */}
          <div className={cn(
            'relative bg-gradient-to-br from-primary via-primary/95 to-primary/80 rounded-lg shadow-lg border border-primary/30',
            'group-hover:shadow-primary/50 group-hover:shadow-xl transition-all duration-300',
            sizeClasses[size].padding
          )}>
            <Network 
              className={cn(
                'text-primary-foreground transition-transform duration-300 group-hover:scale-110',
                sizeClasses[size].icon
              )} 
              strokeWidth={2.5} 
            />
          </div>
        </div>
      )}
      <span className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 bg-clip-text text-transparent font-extrabold tracking-tight">
        Mockifyer
      </span>
    </div>
  )

  if (as === 'div') {
    return content
  }

  return (
    <Link 
      to="/" 
      className="inline-block transition-transform hover:scale-105 active:scale-95 duration-200"
    >
      {content}
    </Link>
  )
}

