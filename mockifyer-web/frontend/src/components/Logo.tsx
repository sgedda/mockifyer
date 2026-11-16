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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1024 1024"
            role="img"
            aria-label="Mockifyer"
            className={cn(
              'transition-transform duration-300 group-hover:scale-110',
              sizeClasses[size].icon
            )}
          >
            <defs>
              <linearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#4a7bff', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#7b3fe4', stopOpacity: 1 }} />
              </linearGradient>
              <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#4a7bff', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#7b3fe4', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <rect x="64" y="64" width="896" height="896" rx="120" fill="none" stroke="url(#borderGradient)" strokeWidth="32"/>
            <path d="M 280 680 L 280 340 L 380 520 L 512 340 L 644 520 L 744 340 L 744 680 L 664 680 L 664 480 L 564 620 L 512 540 L 460 620 L 360 480 L 360 680 Z" className="fill-foreground"/>
            <g transform="translate(680, 680)">
              <path d="M 40 -60 A 60 60 0 1 1 -20 -80" fill="none" stroke="url(#arrowGradient)" strokeWidth="24" strokeLinecap="round"/>
              <path d="M -20 -80 L -40 -100 L -5 -100 Z" fill="url(#arrowGradient)"/>
            </g>
          </svg>
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

