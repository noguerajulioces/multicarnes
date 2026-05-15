// 007-receipt-share: WhatsApp text-share formatter. Builds the receipt as a
// single string from the same RenderedTicket model the PDF and image use, so
// the three channels stay byte-aligned. Opening the URL goes through
// window.open() → caught by setWindowOpenHandler in main → shell.openExternal.
// We never compose a Node import here.

import type { RenderedTicket } from './ticket'

const WHATSAPP_URL_LIMIT = 1900

export type ShareResult = { ok: true } | { ok: false; reason: 'too_long' | 'invalid_phone' }

export function buildWhatsAppMessage(ticket: RenderedTicket): string {
  return ticket.lines.map((l) => l.text).join('\n')
}

export function buildWhatsAppUrl(
  ticket: RenderedTicket,
  phone: string
): { ok: true; url: string } | { ok: false; reason: 'too_long' | 'invalid_phone' } {
  if (!/^\d{9,15}$/.test(phone)) return { ok: false, reason: 'invalid_phone' }
  const message = buildWhatsAppMessage(ticket)
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
  if (url.length > WHATSAPP_URL_LIMIT) return { ok: false, reason: 'too_long' }
  return { ok: true, url }
}

export function shareOnWhatsApp(ticket: RenderedTicket, phone: string): ShareResult {
  const result = buildWhatsAppUrl(ticket, phone)
  if (!result.ok) return result
  // window.open is intercepted by setWindowOpenHandler in src/main/index.ts and
  // routed through shell.openExternal. The returned BrowserWindow is denied so
  // no second Electron window is created.
  window.open(result.url, '_blank')
  return { ok: true }
}
