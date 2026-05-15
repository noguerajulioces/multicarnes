import { jsPDF } from 'jspdf'
import type { RenderedTicket } from './ticket'

const FONT_SIZE_PT = 9
const LINE_HEIGHT_PT = 11
const TOP_MARGIN_PT = 12
const BOTTOM_MARGIN_PT = 18
const SIDE_MARGIN_PT = 8
// Slack on the right edge so anti-aliasing of the last glyph never lands on
// the MediaBox boundary (some PDF viewers clip there). Measured: 4 pt is
// roughly half a Courier 9pt advance.
const RIGHT_SAFETY_PAD_PT = 4

export function downloadTicketPdf(ticket: RenderedTicket, fileName = 'ticket.pdf'): void {
  // Measure the actual glyph advance jsPDF uses for Courier at this size,
  // instead of trusting the theoretical 0.6 ratio. This was wrong in spirit
  // (the ratio IS 0.6 for PostScript Courier) but right in practice — we want
  // the value the library will actually use to lay out the text, so the page
  // width matches what gets drawn.
  const probe = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  probe.setFont('Courier', 'normal')
  probe.setFontSize(FONT_SIZE_PT)
  const charWidth = probe.getTextWidth('M') || FONT_SIZE_PT * 0.6

  const contentWidthPt = ticket.cols * charWidth
  const widthPt = Math.ceil(contentWidthPt + SIDE_MARGIN_PT * 2 + RIGHT_SAFETY_PAD_PT)
  const contentHeightPt = TOP_MARGIN_PT + BOTTOM_MARGIN_PT + ticket.lines.length * LINE_HEIGHT_PT

  // jsPDF swaps [w, h] when the array doesn't match the requested orientation
  // (portrait expects w<=h). For short receipts the natural height is below
  // the width, which previously triggered the swap and clipped the right
  // edge. Forcing landscape made the page render rotated instead. The robust
  // fix is to keep portrait and pad the height so the array is always
  // (w <= h) — the trailing blank space is harmless.
  const heightPt = Math.max(contentHeightPt, widthPt + 1)
  const doc = new jsPDF({
    unit: 'pt',
    format: [widthPt, heightPt],
    orientation: 'portrait'
  })

  doc.setFont('Courier', 'normal')
  doc.setFontSize(FONT_SIZE_PT)

  let y = TOP_MARGIN_PT + LINE_HEIGHT_PT
  for (const line of ticket.lines) {
    if (line.bold) doc.setFont('Courier', 'bold')
    else doc.setFont('Courier', 'normal')
    if (line.emphasized) doc.setFontSize(FONT_SIZE_PT + 1)
    else doc.setFontSize(FONT_SIZE_PT)

    if (line.emphasized && line.parts) {
      // El padding monoespaciado del texto base no alinea cuando subimos el font
      // size. Posicionamos left y right por separado para que el monto no quede
      // fuera del ancho del ticket.
      doc.text(line.parts.left, SIDE_MARGIN_PT, y)
      doc.text(line.parts.right, widthPt - SIDE_MARGIN_PT, y, { align: 'right' })
    } else {
      doc.text(line.text || ' ', SIDE_MARGIN_PT, y)
    }
    y += LINE_HEIGHT_PT
  }

  doc.save(fileName)
}
