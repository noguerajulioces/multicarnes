import { useEffect, useState } from 'react'
import { Check, Download, Printer } from 'lucide-react'
import type { Sale, AppSetting } from '@shared/types'
import { Button, Modal } from '../../components/ui'
import { renderTicket, type TicketWidth } from '../../lib/ticket'
import { downloadTicketPdf } from '../../lib/ticket-pdf'
import { formatGs } from '../../lib/utils'
import { toast } from '../../lib/toast'
import { Ticket } from './Ticket'

interface Props {
  sale: Sale
  cashReceived?: number
  change?: number
  onClose: () => void
  closeLabel?: string
}

export default function TicketPreviewModal({
  sale,
  cashReceived,
  change,
  onClose,
  closeLabel = 'Nueva Venta'
}: Props) {
  const [business, setBusiness] = useState({ name: '', address: '', phone: '' })
  const [width, setWidth] = useState<TicketWidth>(80)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    window.api.settings.getAll().then((rows: AppSetting[]) => {
      const map = new Map(rows.map((r) => [r.key, r.value]))
      setBusiness({
        name: map.get('business_name') ?? 'Multicarnes',
        address: map.get('business_address') ?? '',
        phone: map.get('business_phone') ?? ''
      })
      const w = map.get('thermal_printer_width')
      setWidth(w === '58' ? 58 : 80)
    })
  }, [])

  const ticket = renderTicket({ sale, business, width, cashReceived, change })

  const handlePrint = async (): Promise<void> => {
    setPrinting(true)
    try {
      await window.api.print.ticket({
        lines: ticket.lines.map((l) => ({
          text: l.text,
          bold: l.bold,
          emphasized: l.emphasized
        })),
        cut: true
      })
      toast.success('Ticket enviado a la impresora')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo imprimir'
      toast.error(msg)
    } finally {
      setPrinting(false)
    }
  }

  const handlePdf = (): void => {
    downloadTicketPdf(ticket, `ticket-${sale.id}.pdf`)
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      closeOnBackdrop={false}
      title={
        <div className="flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-white"
            style={{ background: 'var(--gradient-kpi-green)' }}
          >
            <Check size={16} />
          </span>
          <span>Venta #{sale.id} — {formatGs(sale.total)}</span>
        </div>
      }
      footer={
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="secondary" onClick={handlePdf}>
            <Download size={16} /> PDF
          </Button>
          <Button onClick={handlePrint} disabled={printing}>
            <Printer size={16} /> {printing ? 'Imprimiendo…' : 'Imprimir'}
          </Button>
          <Button variant="primary" onClick={onClose}>
            {closeLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {change != null && change > 0 && (
          <div className="flex items-center justify-between bg-success-50 rounded-xl px-4 py-3">
            <span className="text-sm text-text-muted">Vuelto a entregar</span>
            <span className="text-xl font-bold text-success-700 tabular-nums">
              {formatGs(change)}
            </span>
          </div>
        )}
        <div className="bg-surface-muted/40 rounded-xl p-4 max-h-[60vh] overflow-y-auto">
          <Ticket ticket={ticket} />
        </div>
        <p className="text-xs text-text-muted text-center">
          Vista previa exacta. Al imprimir o exportar el PDF se conserva el formato.
        </p>
      </div>
    </Modal>
  )
}
