import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../../../lib/utils'

export interface PeriodOption<T extends string> {
  value: T
  label: string
}

interface PeriodSelectorProps<T extends string> {
  value: T
  options: PeriodOption<T>[]
  onChange: (v: T) => void
}

export function PeriodSelector<T extends string>({
  value,
  options,
  onChange
}: PeriodSelectorProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-surface-muted text-text-main hover:bg-surface-sunken transition-colors"
      >
        {current?.label}
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-10 min-w-[140px] bg-surface border border-border rounded-lg shadow-popover py-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs hover:bg-surface-muted',
                opt.value === value ? 'text-brand font-medium' : 'text-text-main'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
