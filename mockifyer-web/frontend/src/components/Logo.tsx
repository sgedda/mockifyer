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
    sm: { text: 'text-lg', icon: 'w-8 h-8' },
    md: { text: 'text-xl', icon: 'w-10 h-10' },
    lg: { text: 'text-3xl md:text-4xl', icon: 'w-14 h-14 md:w-16 md:h-16' },
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
          <img
            src="/logo-transparent.svg"
            alt="Mockifyer logo"
            className={cn(
              'transition-transform duration-300 group-hover:scale-110',
              sizeClasses[size].icon
            )}
          />
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

