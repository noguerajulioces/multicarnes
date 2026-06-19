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
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 010: time-only (HH:MM) for exports that split date and time into two columns.
// Forced to a 24-hour clock (00–23) so it never renders AM/PM, whatever the
// runtime locale resolves to.
export function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function todayStr(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function firstDayOfMonthStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isRegisterStale(register: { opened_at: string } | null | undefined): boolean {
  if (!register?.opened_at) return false
  const openedDay = register.opened_at.slice(0, 10)
  return openedDay < localDateStr(new Date())
}

export function daysOpen(register: { opened_at: string } | null | undefined): number {
  if (!register?.opened_at) return 0
  const opened = new Date(register.opened_at.replace(' ', 'T'))
  if (Number.isNaN(opened.getTime())) return 0
  const todayLocal = new Date()
  const a = Date.UTC(opened.getFullYear(), opened.getMonth(), opened.getDate())
  const b = Date.UTC(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate())
  return Math.max(0, Math.round((b - a) / 86_400_000))
}
