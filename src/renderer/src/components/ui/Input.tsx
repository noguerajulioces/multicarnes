import { InputHTMLAttributes, forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  showToggle?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, showToggle, type, ...props },
  ref
) {
  const [reveal, setReveal] = useState(false)
  const isPasswordToggle = showToggle && type === 'password'
  const effectiveType = isPasswordToggle ? (reveal ? 'text' : 'password') : type

  const inputEl = (
    <input
      ref={ref}
      type={effectiveType}
      className={cn(
        'h-10 w-full rounded-md border bg-surface px-3 text-sm text-text-main placeholder:text-text-disabled',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand',
        'disabled:opacity-60 disabled:bg-surface-muted',
        invalid
          ? 'border-danger-500 focus:ring-danger-500/30 focus:border-danger-500'
          : 'border-border',
        isPasswordToggle && 'pr-10',
        className
      )}
      {...props}
    />
  )

  if (!isPasswordToggle) return inputEl

  return (
    <div className="relative">
      {inputEl}
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setReveal((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-2.5 text-text-muted hover:text-text-main"
        aria-label={reveal ? 'Ocultar' : 'Mostrar'}
        title={reveal ? 'Ocultar' : 'Mostrar'}
      >
        {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
})
