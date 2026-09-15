import { useState } from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { useMockFavorites } from '@/lib/favorites-context'

export function FavoriteStarButton({
  filename,
  requestHash,
  className,
}: {
  filename: string
  requestHash?: string | null
  className?: string
}) {
  const { isFavorite, toggleFavorite } = useMockFavorites()
  const { toast } = useToast()
  const [pending, setPending] = useState(false)
  const favorited = isFavorite(requestHash)

  async function handleClick(event: React.MouseEvent) {
    event.stopPropagation()
    event.preventDefault()
    try {
      setPending(true)
      await toggleFavorite(filename, requestHash)
    } catch (error: unknown) {
      toast({
        title: 'Could not update favorite',
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'destructive',
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      disabled={pending}
      onClick={(event) => void handleClick(event)}
      title={favorited ? 'Remove from favorites' : 'Favorite this request (all scenarios)'}
      aria-label={favorited ? 'Remove from favorites' : 'Favorite this request'}
      aria-pressed={favorited}
    >
      <Star
        className={`h-4 w-4 ${favorited ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
      />
    </Button>
  )
}
