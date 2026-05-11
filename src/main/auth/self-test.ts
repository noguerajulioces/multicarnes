// Boot-time assertion: every channel registered with the guard must have an
// AUTH_MATRIX entry. Without this, FR-008 (failure-closed default) silently
// hides "I forgot to add a matrix entry" bugs.

import { AUTH_MATRIX } from './matrix'

export function assertMatrixCoverage(registeredChannels: string[]): void {
  const missing = registeredChannels.filter((c) => !(c in AUTH_MATRIX))
  if (missing.length === 0) return
  const lines = ['Authorization matrix is missing entries for:', ...missing.map((m) => `  - ${m}`)]
  lines.push('')
  lines.push('Add an entry to src/main/auth/matrix.ts. Channels not in the matrix')
  lines.push('default to deny-all (FR-008) and would silently break their callers.')
  throw new Error(lines.join('\n'))
}
