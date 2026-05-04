import { HelpCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface TourButtonProps {
  onClick: () => void
  label?: string
  size?: 'sm' | 'md'
  className?: string
}

export function TourButton({
  onClick,
  label = 'Tutorial',
  size = 'md',
  className
}: TourButtonProps) {
  const iconSize = size === 'sm' ? 12 : 16
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Ver ${label.toLowerCase()}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-muted transition-colors',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-2 text-sm',
        className
      )}
    >
      <HelpCircle size={iconSize} />
      {label}
    </button>
  )
}
