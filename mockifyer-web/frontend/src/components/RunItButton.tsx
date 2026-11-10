import { Button } from '@/components/ui/button'
import { Play } from 'lucide-react'

interface RunItButtonProps {
  project: string
  file?: string
  title?: string
  variant?: 'default' | 'outline'
  size?: 'default' | 'sm' | 'lg'
}

const GITHUB_REPO = 'sgedda/mockifyer'
const DEFAULT_BRANCH = 'main'

export default function RunItButton({ 
  project, 
  file, 
  title = 'Run in StackBlitz',
  variant = 'default',
  size = 'default'
}: RunItButtonProps) {
  const stackblitzUrl = `https://stackblitz.com/github/${GITHUB_REPO}/tree/${DEFAULT_BRANCH}/demos/${project}${file ? `?file=${file}` : ''}`

  const handleClick = () => {
    window.open(stackblitzUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <Button 
      onClick={handleClick}
      variant={variant}
      size={size}
      className="font-medium"
    >
      <Play className="mr-2 h-4 w-4" />
      {title}
    </Button>
  )
}
