/**
 * Local date helpers for the e2e suite.
 *
 * The app stores timestamps with `datetime('now','localtime')` and most
 * date-range filters compare against `date(created_at)`, which extracts the
 * date portion of that LOCAL string. Tests that ran with
 * `new Date().toISOString().slice(0, 10)` were flaky between UTC midnight
 * and local midnight: e.g. at 22:00 in UTC-3, the ISO date is the next day
 * while the row's local date is still today, so the row falls outside the
 * filter window.
 *
 * Use `todayLocal()` / `tomorrowLocal()` everywhere tests build a
 * `[from, to]` range over rows that were just inserted in the same test.
 */

function fmtLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayLocal(): string {
  return fmtLocal(new Date())
}

export function tomorrowLocal(): string {
  return fmtLocal(new Date(Date.now() + 86_400_000))
}
