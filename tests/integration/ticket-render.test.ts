import { describe, expect, test } from 'vitest'
import type { Sale } from '../../src/shared/types'
import {
  DEFAULT_THANKS_MESSAGE,
  GENERIC_CUSTOMER,
  renderTicket,
  ticketBusinessFromSettings,
  ticketMessagesFromSettings,
  type RenderedTicket,
  type TicketBusiness
} from '../../src/renderer/src/lib/ticket'

const BUSINESS: TicketBusiness = {
  name: 'Multicarnes S.R.L.',
  address: 'Av. Irrazábal 123',
  city: 'Encarnación',
  ruc: '80012345-6',
  phone: '0985 123 456'
}

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 7,
    created_at: '2026-08-03T14:32:00.000Z',
    user_name: 'Cajero Uno',
    subtotal: 20000,
    total: 20000,
    payment_method: 'cash',
    status: 'completed',
    items: [
      {
        product_id: 1,
        product_name: 'Costilla',
        quantity: 1,
        unit_price: 20000,
        subtotal: 20000
      }
    ],
    ...overrides
  } as Sale
}

function render(opts: Parameters<typeof renderTicket>[0]): string[] {
  return renderTicket(opts).lines.map((l) => l.text.trim())
}

// Re-joins the printed lines so a wrap test can assert the text survived intact
// rather than merely fitting the column width.
function joinVisible(ticket: RenderedTicket): string {
  return ticket.lines
    .map((l) => l.text.trim())
    .filter(Boolean)
    .join(' ')
}

describe('renderTicket header', () => {
  test('prints city and RUC between the address and the phone', () => {
    const lines = render({ sale: makeSale(), business: BUSINESS, width: 80 })
    const order = ['Av. Irrazábal 123', 'Encarnación', 'RUC: 80012345-6', 'Tel: 0985 123 456']
    const positions = order.map((t) => lines.indexOf(t))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  test('omits blank fields instead of printing empty labels', () => {
    const lines = render({
      sale: makeSale(),
      business: { ...BUSINESS, city: '', ruc: '' },
      width: 80
    })
    expect(lines.some((l) => l.startsWith('RUC:'))).toBe(false)
    expect(lines).not.toContain('Encarnación')
    expect(lines).toContain('Tel: 0985 123 456')
  })
})

describe('renderTicket customer line', () => {
  test('falls back to a generic customer when the sale has none', () => {
    const lines = render({ sale: makeSale(), business: BUSINESS, width: 80 })
    expect(lines).toContain(`Cliente: ${GENERIC_CUSTOMER}`)
  })

  test('uses the real customer when one is attached', () => {
    const lines = render({
      sale: makeSale({ customer_name: 'María Álvarez' }),
      business: BUSINESS,
      width: 80
    })
    expect(lines).toContain('Cliente: María Álvarez')
    expect(lines).not.toContain(`Cliente: ${GENERIC_CUSTOMER}`)
  })

  test('treats an empty customer name as no customer', () => {
    const lines = render({
      sale: makeSale({ customer_name: '' }),
      business: BUSINESS,
      width: 80
    })
    expect(lines).toContain(`Cliente: ${GENERIC_CUSTOMER}`)
  })
})

describe('renderTicket footer messages', () => {
  test('defaults the greeting when messages are absent', () => {
    const lines = render({ sale: makeSale(), business: BUSINESS, width: 80 })
    expect(lines).toContain(DEFAULT_THANKS_MESSAGE)
  })

  // The `??` fallback is what lets installs that predate the setting keep their
  // greeting, while still honouring a greeting the owner deliberately cleared.
  test('keeps the default when the greeting key is absent', () => {
    const lines = render({
      sale: makeSale(),
      business: BUSINESS,
      width: 80,
      messages: { extra: 'Cambios dentro de 24hs' }
    })
    expect(lines).toContain(DEFAULT_THANKS_MESSAGE)
  })

  test('drops the greeting line when explicitly cleared', () => {
    const lines = render({
      sale: makeSale(),
      business: BUSINESS,
      width: 80,
      messages: { thanks: '' }
    })
    expect(lines).not.toContain(DEFAULT_THANKS_MESSAGE)
  })

  test('prints the extra message above the greeting', () => {
    const lines = render({
      sale: makeSale(),
      business: BUSINESS,
      width: 80,
      messages: { extra: 'Cambios dentro de 24hs', thanks: 'Gracias!' }
    })
    expect(lines.indexOf('Cambios dentro de 24hs')).toBeLessThan(lines.indexOf('Gracias!'))
  })

  test('omits the extra message when blank', () => {
    const withOut = render({
      sale: makeSale(),
      business: BUSINESS,
      width: 80,
      messages: { extra: '', thanks: 'Gracias!' }
    })
    expect(withOut.filter((l) => l === '')).toHaveLength(2)
  })

  test('wraps a long message to the paper width instead of truncating it', () => {
    const long =
      'Presentá este comprobante para cambios o devoluciones dentro de las 24 horas siguientes'
    const rendered = renderTicket({
      sale: makeSale(),
      business: BUSINESS,
      width: 80,
      messages: { extra: long, thanks: '' }
    })
    expect(rendered.lines.every((l) => l.text.length <= rendered.cols)).toBe(true)
    const joined = rendered.lines
      .map((l) => l.text.trim())
      .filter(Boolean)
      .join(' ')
    expect(joined).toContain(long)
  })

  // `center()` truncates any over-length line with slice(0, cols), so asserting
  // only "no line exceeds cols" would pass even with wrapping entirely broken.
  // Every wrap test must also assert the content survived.
  test('wraps against the narrower 58 mm width without losing content', () => {
    const long = 'Consultá nuestras promociones semanales en el mostrador'
    const rendered = renderTicket({
      sale: makeSale(),
      business: BUSINESS,
      width: 58,
      messages: { extra: long, thanks: '' }
    })
    expect(rendered.cols).toBe(32)
    expect(rendered.lines.every((l) => l.text.length <= 32)).toBe(true)
    expect(joinVisible(rendered)).toContain(long)
  })

  test('breaks a single word wider than the paper instead of truncating it', () => {
    // A URL has no spaces to wrap on. The old wrapWords sliced the head and
    // dropped the tail, so the shop's own web address printed half-missing.
    const url = 'www.multicarnes-encarnacion.com.py/promociones'
    const rendered = renderTicket({
      sale: makeSale(),
      business: BUSINESS,
      width: 58,
      messages: { extra: url, thanks: '' }
    })
    expect(rendered.lines.every((l) => l.text.length <= 32)).toBe(true)
    expect(joinVisible(rendered).replace(/\s+/g, '')).toContain(url)
  })

  test('treats a whitespace-only message as empty', () => {
    const rendered = renderTicket({
      sale: makeSale(),
      business: BUSINESS,
      width: 80,
      messages: { extra: '   ', thanks: '  ' }
    })
    // Only the two structural blank lines that bracket the footer remain; a
    // whitespace message must not survive as a third all-spaces line.
    const blank = rendered.lines.filter((l) => l.text.trim() === '')
    expect(blank).toHaveLength(2)
  })
})

describe('settings mapping', () => {
  test('falls back to the default greeting when the key is absent', () => {
    expect(ticketMessagesFromSettings(new Map()).thanks).toBe(DEFAULT_THANKS_MESSAGE)
  })

  test('respects a greeting the owner deliberately cleared', () => {
    const settings = new Map([['receipt_thanks_message', '']])
    expect(ticketMessagesFromSettings(settings).thanks).toBe('')
  })

  test('reads the business fields, defaulting the missing ones to blank', () => {
    const settings = new Map([
      ['business_name', 'Carnicería Central'],
      ['business_ruc', '80099999-1']
    ])
    expect(ticketBusinessFromSettings(settings)).toEqual({
      name: 'Carnicería Central',
      address: '',
      city: '',
      ruc: '80099999-1',
      phone: ''
    })
  })
})
