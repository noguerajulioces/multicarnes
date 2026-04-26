import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function formatGs(amount: number): string {
  return `Gs. ${amount.toLocaleString('es-PY')}`
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-PY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function todayStr(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}
