import { jsPDF } from 'jspdf'
import type { RenderedTicket } from './ticket'

const MM_PER_INCH = 25.4
const POINTS_PER_INCH = 72
const FONT_SIZE_PT = 9
const LINE_HEIGHT_PT = 11
const TOP_MARGIN_PT = 12
const SIDE_MARGIN_PT = 8

function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * POINTS_PER_INCH
}

export function downloadTicketPdf(ticket: RenderedTicket, fileName = 'ticket.pdf'): void {
  const widthPt = mmToPt(ticket.width) + SIDE_MARGIN_PT * 2
  const heightPt = TOP_MARGIN_PT * 2 + ticket.lines.length * LINE_HEIGHT_PT

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

    doc.text(line.text || ' ', SIDE_MARGIN_PT, y)
    y += LINE_HEIGHT_PT
  }

  doc.save(fileName)
}
