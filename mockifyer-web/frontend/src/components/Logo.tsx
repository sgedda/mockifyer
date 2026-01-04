import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
  as?: 'link' | 'div'
}

export default function Logo({ className, showIcon = true, size = 'md', as = 'link' }: LogoProps) {
  const sizeClasses = {
    sm: { text: 'text-lg', icon: 'text-2xl', padding: 'p-1.5' },
    md: { text: 'text-xl', icon: 'text-3xl', padding: 'p-2' },
    lg: { text: 'text-3xl md:text-4xl', icon: 'text-5xl md:text-6xl', padding: 'p-2.5 md:p-3' },
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
          {/* Icon container */}
          <div className={cn(
            'relative rounded-lg transition-all duration-300',
            sizeClasses[size].padding
          )}>
            <span className={cn(
              'text-foreground transition-transform duration-300 group-hover:scale-110 inline-block',
              sizeClasses[size].icon
            )}>
              🎭
            </span>
          </div>
        </div>
      )}
      <span className="text-foreground font-extrabold tracking-tight">
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

