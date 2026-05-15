// 007-receipt-share: renders the same RenderedTicket the PDF formatter uses
// into a PNG Blob via Canvas 2D, then triggers a download. Stays in renderer
// (constitution V.b) and uses only native Web APIs — no new dependencies.

import type { RenderedTicket } from './ticket'

const OVERSAMPLE = 2
const BASE_FONT_PX = 13
const LINE_HEIGHT_PX = 16
const TOP_MARGIN_PX = 12
const BOTTOM_MARGIN_PX = 16
const SIDE_MARGIN_PX = 8
const BASE_FONT = `${BASE_FONT_PX}px "Courier New", monospace`

export function downloadTicketImage(ticket: RenderedTicket, fileName: string): void {
  // Width is driven by the *character grid* (cols × measured char width), not
  // by the printer's physical mm. The padded line text needs `cols` glyphs to
  // fit; sizing from mm clipped the right edge (e.g. "10.000" → "10").
  const probe = document.createElement('canvas').getContext('2d')
  if (!probe) return
  probe.font = BASE_FONT
  const charWidth = probe.measureText('M').width || BASE_FONT_PX * 0.6
  const cssWidth = Math.ceil(ticket.cols * charWidth) + SIDE_MARGIN_PX * 2
  const cssHeight = TOP_MARGIN_PX + BOTTOM_MARGIN_PX + ticket.lines.length * LINE_HEIGHT_PX

  const canvas = document.createElement('canvas')
  canvas.width = cssWidth * OVERSAMPLE
  canvas.height = cssHeight * OVERSAMPLE
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(OVERSAMPLE, OVERSAMPLE)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, cssWidth, cssHeight)
  ctx.fillStyle = '#000000'
  ctx.textBaseline = 'top'

  let y = TOP_MARGIN_PX
  for (const line of ticket.lines) {
    const size = line.emphasized ? BASE_FONT_PX + 1 : BASE_FONT_PX
    const weight = line.bold ? 'bold' : 'normal'
    ctx.font = `${weight} ${size}px "Courier New", monospace`

    if (line.emphasized && line.parts) {
      ctx.textAlign = 'left'
      ctx.fillText(line.parts.left, SIDE_MARGIN_PX, y)
      ctx.textAlign = 'right'
      ctx.fillText(line.parts.right, cssWidth - SIDE_MARGIN_PX, y)
    } else {
      ctx.textAlign = 'left'
      ctx.fillText(line.text || ' ', SIDE_MARGIN_PX, y)
    }
    y += LINE_HEIGHT_PX
  }

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, 'image/png')
}
