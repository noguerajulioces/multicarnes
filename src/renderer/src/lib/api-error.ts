// Central handler for IPC rejections. AuthError instances raised by the main
// process surface in the renderer as rejected promises whose .message starts
// with "Error: " followed by our locale-keyed string. We normalize them here
// so every page can `.catch(handleApiError)` and get a uniform toast.

import { toast } from './toast'

interface AuthErrorMarker {
  __authError: true
  outcome: string
  operation: string
  message: string
}

export function isAuthError(err: unknown): err is Error & { authMessage: string } {
  if (!(err instanceof Error)) return false
  const msg = err.message ?? ''
  return (
    /No tenés permiso para realizar esta acción/.test(msg) ||
    /No tenés sesión iniciada/.test(msg) ||
    /Tu usuario está desactivado/.test(msg) ||
    isAuthErrorMarker(unwrap(err))
  )
}

function unwrap(err: unknown): unknown {
  if (err instanceof Error) {
    // Electron tunnels thrown errors via their .message; the marker is best-effort.
    const cause = (err as Error & { cause?: unknown }).cause
    return cause ?? err
  }
  return err
}

function isAuthErrorMarker(value: unknown): value is AuthErrorMarker {
  return (
    typeof value === 'object' && value !== null && (value as AuthErrorMarker).__authError === true
  )
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) {
    // Electron prefixes the renderer-side message with "Error invoking remote
    // method '<channel>': Error: <our message>". Pull out the trailing piece.
    const m = err.message.match(/Error:\s*(.+)$/)
    if (m) return m[1]
    return err.message
  }
  return String(err)
}

export function handleApiError(err: unknown): void {
  if (isAuthError(err)) {
    toast.error(extractMessage(err))
    return
  }
  // Non-auth errors: surface the raw message; pages can override before reaching
  // here if they want richer handling.
  toast.error(extractMessage(err))
}
