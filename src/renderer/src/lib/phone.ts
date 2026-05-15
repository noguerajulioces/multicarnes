// 007-receipt-share: phone normalization for the WhatsApp share URL.
// Paraguay-first heuristic — accepts already-internationalized numbers as-is
// and assumes +595 when the local form is detected. Returns digits-only (no
// '+'), the format wa.me accepts in its path segment.

const DEFAULT_COUNTRY_CODE = '595'

export type NormalizedPhone =
  | { ok: true; phone: string }
  | { ok: false; reason: 'empty' | 'invalid_chars' | 'too_short' | 'too_long' }

export function normalizePhone(input: string): NormalizedPhone {
  if (input == null) return { ok: false, reason: 'empty' }
  const trimmed = String(input).trim()
  if (trimmed.length === 0) return { ok: false, reason: 'empty' }

  const stripped = trimmed.replace(/[\s\-().]/g, '')
  if (!/^[+\d]+$/.test(stripped)) return { ok: false, reason: 'invalid_chars' }

  let digits: string
  if (stripped.startsWith('+')) {
    digits = stripped.slice(1)
  } else if (stripped.startsWith('00')) {
    digits = stripped.slice(2)
  } else if (stripped.startsWith('0')) {
    digits = DEFAULT_COUNTRY_CODE + stripped.slice(1)
  } else {
    // Bare local number (no country code, no leading 0): prepend Paraguay code.
    digits = DEFAULT_COUNTRY_CODE + stripped
  }

  if (!/^\d+$/.test(digits)) return { ok: false, reason: 'invalid_chars' }
  if (digits.length < 9) return { ok: false, reason: 'too_short' }
  if (digits.length > 15) return { ok: false, reason: 'too_long' }
  return { ok: true, phone: digits }
}
