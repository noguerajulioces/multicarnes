import type { Sale } from '@shared/types'

export type TicketWidth = 58 | 80

const WIDTH_CHARS: Record<TicketWidth, number> = {
  58: 32,
  80: 48
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  credit: 'Fiado',
  mixed: 'Mixto'
}

export interface TicketBusiness {
  name: string
  address: string
  phone: string
}

export interface RenderTicketOpts {
  sale: Sale
  business: TicketBusiness
  width: TicketWidth
  cashReceived?: number
  change?: number
}

interface TicketLine {
  text: string
  bold?: boolean
  align?: 'left' | 'center' | 'right'
  emphasized?: boolean
  // Cuando la línea tiene tamaño aumentado (emphasized), el padding monoespaciado
  // calculado para el tamaño base ya no encaja. `parts` permite re-renderizar la
  // línea con layout flex (preview HTML) o posicionando left/right por separado
  // (PDF) sin depender del ancho de columna.
  parts?: { left: string; right: string }
}

export interface RenderedTicket {
  width: TicketWidth
  cols: number
  lines: TicketLine[]
}

function pad(str: string, len: number, side: 'left' | 'right' = 'left'): string {
  if (str.length >= len) return str.slice(0, len)
  const fill = ' '.repeat(len - str.length)
  return side === 'left' ? str + fill : fill + str
}

function center(str: string, cols: number): string {
  if (str.length >= cols) return str.slice(0, cols)
  const left = Math.floor((cols - str.length) / 2)
  return ' '.repeat(left) + str
}

function divider(cols: number, char = '-'): string {
  return char.repeat(cols)
}

function fmtMoney(n: number): string {
  return n.toLocaleString('es-PY')
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const date = d.toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
  const time = d.toLocaleTimeString('es-PY', {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${date} ${time}`
}

function row(left: string, right: string, cols: number): string {
  const space = cols - left.length - right.length
  if (space <= 1) {
    return left.slice(0, Math.max(1, cols - right.length - 1)) + ' ' + right
  }
  return left + ' '.repeat(space) + right
}

function wrapWords(text: string, cols: number): string[] {
  if (text.length <= cols) return [text]
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    if (!current) {
      current = w.length > cols ? w.slice(0, cols) : w
      continue
    }
    if (current.length + 1 + w.length <= cols) {
      current += ' ' + w
    } else {
      lines.push(current)
      current = w.length > cols ? w.slice(0, cols) : w
    }
  }
  if (current) lines.push(current)
  return lines
}

export function renderTicket({
  sale,
  business,
  width,
  cashReceived,
  change
}: RenderTicketOpts): RenderedTicket {
  const cols = WIDTH_CHARS[width]
  const lines: TicketLine[] = []

  // ---------- Header (business) ----------
  if (business.name) {
    lines.push({ text: business.name.toUpperCase(), align: 'center', bold: true })
  }
  if (business.address) lines.push({ text: business.address, align: 'center' })
  if (business.phone) lines.push({ text: `Tel: ${business.phone}`, align: 'center' })
  lines.push({ text: divider(cols) })

  // ---------- Sale meta ----------
  lines.push({ text: row(`TICKET #${sale.id}`, fmtDateTime(sale.created_at), cols) })
  if (sale.user_name) lines.push({ text: `Cajero: ${sale.user_name}` })
  if (sale.customer_name) lines.push({ text: `Cliente: ${sale.customer_name}` })
  lines.push({ text: divider(cols) })

  // ---------- Items ----------
  // Each item: line 1 = product name, line 2 = "  qty x unitPrice    subtotal"
  const items = sale.items ?? []
  for (const it of items) {
    const name = it.product_name ?? `Producto #${it.product_id}`
    for (const wrapped of wrapWords(name, cols)) {
      lines.push({ text: wrapped })
    }
    const qty = Number(it.quantity)
    const qtyStr = Number.isInteger(qty) ? qty.toString() : qty.toFixed(3).replace(/\.?0+$/, '')
    const left = `  ${qtyStr} x ${fmtMoney(it.unit_price)}`
    const right = fmtMoney(it.subtotal)
    lines.push({ text: row(left, right, cols) })
  }
  lines.push({ text: divider(cols) })

  // ---------- Totals ----------
  if (sale.discount && sale.discount > 0) {
    lines.push({ text: row('Subtotal', fmtMoney(sale.subtotal), cols) })
    lines.push({ text: row('Descuento', `-${fmtMoney(sale.discount)}`, cols) })
  }
  // 005-promotional-pricing: sum savings across promo lines. Each item carries
  // normal_price (current product price, joined at read time). A line is a
  // promo line iff normal_price > unit_price. Suppressed when zero so non-promo
  // receipts print byte-identical to the prior layout.
  const promoSavings = items.reduce((sum, it) => {
    if (it.normal_price != null && it.normal_price > it.unit_price) {
      return sum + (it.normal_price - it.unit_price) * Number(it.quantity)
    }
    return sum
  }, 0)
  if (promoSavings > 0) {
    lines.push({ text: row('Ahorrás Gs.', fmtMoney(Math.round(promoSavings)), cols) })
  }
  lines.push({
    text: row('TOTAL Gs.', fmtMoney(sale.total), cols),
    bold: true,
    emphasized: true,
    parts: { left: 'TOTAL Gs.', right: fmtMoney(sale.total) }
  })
  lines.push({ text: divider(cols) })

  // ---------- Payment ----------
  const methodLabel = PAYMENT_LABEL[sale.payment_method] ?? sale.payment_method
  lines.push({ text: row('Pago:', methodLabel, cols) })
  if (sale.payment_method === 'mixed' && sale.payments) {
    for (const p of sale.payments) {
      const label = PAYMENT_LABEL[p.method] ?? p.method
      lines.push({ text: row(`  ${label}`, fmtMoney(p.amount), cols) })
    }
  }
  if (sale.payment_method === 'cash' && cashReceived != null && cashReceived > 0) {
    lines.push({ text: row('Recibido', fmtMoney(cashReceived), cols) })
    if (change != null && change > 0) {
      lines.push({ text: row('Vuelto', fmtMoney(change), cols), bold: true })
    }
  }

  // ---------- Footer ----------
  lines.push({ text: '' })
  lines.push({ text: '¡Gracias por su compra!', align: 'center' })
  lines.push({ text: '' })

  // Apply alignment to text now (so consumers can render trivially)
  const alignedLines: TicketLine[] = lines.map((l) => {
    if (l.align === 'center') return { ...l, text: center(l.text, cols) }
    if (l.align === 'right') return { ...l, text: pad(l.text, cols, 'right') }
    return l
  })

  return { width, cols, lines: alignedLines }
}
