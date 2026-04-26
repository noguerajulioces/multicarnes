import { SelectHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/utils'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-main',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand',
        'disabled:opacity-60 disabled:bg-surface-muted',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
})
