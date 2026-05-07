import { forwardRef } from 'react'
import type { RenderedTicket } from '../../lib/ticket'

interface TicketProps {
  ticket: RenderedTicket
}

// Approximate rendered widths for paper sizes at typical thermal DPI.
// These match what ESC/POS thermal printers actually output.
const PAPER_PX: Record<number, number> = {
  58: 220,
  80: 320
}

export const Ticket = forwardRef<HTMLDivElement, TicketProps>(function Ticket({ ticket }, ref) {
  const widthPx = PAPER_PX[ticket.width] ?? 320

  return (
    <div
      ref={ref}
      className="ticket-preview bg-white text-black mx-auto shadow-lg border border-border"
      style={{
        width: `${widthPx}px`,
        padding: '16px 12px',
        fontFamily: '"Courier New", "Courier", ui-monospace, monospace',
        fontSize: '12px',
        lineHeight: '1.35',
        whiteSpace: 'pre',
        letterSpacing: '0px'
      }}
    >
      {ticket.lines.map((line, i) => {
        const style: React.CSSProperties = {}
        if (line.bold) style.fontWeight = 700
        if (line.emphasized) {
          style.fontSize = '14px'
          style.padding = '2px 0'
        }
        // Las líneas emphasized con parts left/right se renderizan con flex
        // porque el padding monoespaciado del texto base no alinea al subir
        // el tamaño de fuente.
        if (line.emphasized && line.parts) {
          return (
            <div
              key={i}
              style={{
                ...style,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                whiteSpace: 'nowrap'
              }}
            >
              <span>{line.parts.left}</span>
              <span>{line.parts.right}</span>
            </div>
          )
        }
        return (
          <div key={i} style={style}>
            {line.text || ' '}
          </div>
        )
      })}
    </div>
  )
})
