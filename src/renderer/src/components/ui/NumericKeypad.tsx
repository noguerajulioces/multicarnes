import { Delete } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface NumericKeypadProps {
  value: string
  onChange: (v: string) => void
  onSubmit?: () => void
  maxLength?: number
  className?: string
}

export function NumericKeypad({
  value,
  onChange,
  onSubmit,
  maxLength = 6,
  className
}: NumericKeypadProps) {
  const press = (digit: string) => {
    if (value.length < maxLength) onChange(value + digit)
  }
  const back = () => onChange(value.slice(0, -1))

  const keyClass =
    'h-12 rounded-lg border border-border bg-surface text-lg font-medium hover:bg-surface-muted active:scale-95 transition flex items-center justify-center'

  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button key={d} type="button" onClick={() => press(d)} className={keyClass}>
          {d}
        </button>
      ))}
      <button type="button" onClick={back} aria-label="Borrar" className={keyClass}>
        <Delete size={18} />
      </button>
      <button type="button" onClick={() => press('0')} className={keyClass}>
        0
      </button>
      <button
        type="button"
        onClick={onSubmit}
        className="h-12 rounded-lg bg-brand text-white font-medium hover:bg-brand-hover active:scale-95 transition"
      >
        OK
      </button>
    </div>
  )
}
