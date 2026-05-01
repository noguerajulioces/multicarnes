import { forwardRef } from 'react'
import { Input, type InputProps } from './Input'

export interface MoneyInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: number
  onValueChange: (value: number) => void
}

function format(n: number): string {
  if (!n) return ''
  return n.toLocaleString('es-PY')
}

function parse(s: string): number {
  const digits = s.replace(/\D/g, '')
  return digits ? parseInt(digits, 10) : 0
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onValueChange, ...props },
  ref
) {
  return (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      value={format(value)}
      onChange={(e) => onValueChange(parse(e.target.value))}
      {...props}
    />
  )
})
