import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-md border bg-surface px-3 text-sm text-text-main placeholder:text-text-disabled',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand',
        'disabled:opacity-60 disabled:bg-surface-muted',
        invalid
          ? 'border-danger-500 focus:ring-danger-500/30 focus:border-danger-500'
          : 'border-border',
        className
      )}
      {...props}
    />
  )
})
