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
    sm: { text: 'text-lg', imgSize: 32, imgClass: 'w-8 h-8' },
    md: { text: 'text-xl', imgSize: 48, imgClass: 'w-12 h-12' },
    lg: { text: 'text-3xl md:text-4xl', imgSize: 64, imgClass: 'w-16 h-16 md:w-20 md:h-20' },
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
            src="/logo-192.png"
            alt="Mockifyer"
            width={sizeClasses[size].imgSize}
            height={sizeClasses[size].imgSize}
            className={cn(
              'transition-transform duration-300 group-hover:scale-110',
              sizeClasses[size].imgClass
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

