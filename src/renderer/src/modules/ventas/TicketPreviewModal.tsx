import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Download, ImageDown, MessageCircle, Printer, Settings } from 'lucide-react'
import type { Sale, AppSetting } from '@shared/types'
import { Button, Modal } from '../../components/ui'
import { renderTicket, type RenderedTicket, type TicketWidth } from '../../lib/ticket'
import { downloadTicketPdf } from '../../lib/ticket-pdf'
import { downloadTicketImage } from '../../lib/ticket-image'
import { shareOnWhatsApp } from '../../lib/whatsapp-share'
import { normalizePhone } from '../../lib/phone'
import { formatGs } from '../../lib/utils'
import { toast } from '../../lib/toast'
import { Ticket } from './Ticket'
import PhoneInputModal from './PhoneInputModal'

interface Props {
  sale: Sale
  cashReceived?: number
  change?: number
  onClose: () => void
  closeLabel?: string
}

// 007-receipt-share: pre-pend a centered "ANULADA" marker so the void state is
// visible across all three share channels (text, image, PDF). Doing it on top
// of the already-rendered ticket keeps renderTicket itself unaware of share
// concerns — see plan.md §"Phase 6".
function withVoidMarker(ticket: RenderedTicket, isVoided: boolean): RenderedTicket {
  if (!isVoided) return ticket
  const marker = '*** ANULADA ***'
  const padLeft = Math.max(0, Math.floor((ticket.cols - marker.length) / 2))
  const centered = ' '.repeat(padLeft) + marker
  return {
    ...ticket,
    lines: [{ text: centered, bold: true }, { text: '' }, ...ticket.lines]
  }
}

export default function TicketPreviewModal({
  sale,
  cashReceived,
  change,
  onClose,
  closeLabel = 'Registrar Nueva Venta'
}: Props) {
  const navigate = useNavigate()
  const [business, setBusiness] = useState({ name: '', address: '', phone: '' })
  const [width, setWidth] = useState<TicketWidth>(80)
  const [printing, setPrinting] = useState(false)
  const [printerReady, setPrinterReady] = useState<boolean | null>(null)
  const [askingPhone, setAskingPhone] = useState(false)

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
    window.api.print.hasConfig().then(setPrinterReady)
  }, [])

  const goToPrinterSettings = (): void => {
    onClose()
    navigate('/configuracion')
  }

  const ticket = useMemo(
    () =>
      withVoidMarker(
        renderTicket({ sale, business, width, cashReceived, change }),
        sale.status === 'cancelled'
      ),
    [sale, business, width, cashReceived, change]
  )

  const handlePrint = async (): Promise<void> => {
    setPrinting(true)
    try {
      const result = await window.api.print.ticket({
        lines: ticket.lines.map((l) => ({
          text: l.text,
          bold: l.bold,
          emphasized: l.emphasized
        })),
        cut: true
      })
      if (result.ok) {
        toast.success('Ticket enviado a la impresora')
      } else {
        toast.error(result.error)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo imprimir el ticket.')
    } finally {
      setPrinting(false)
    }
  }

  const handlePdf = (): void => {
    downloadTicketPdf(ticket, `comprobante-${sale.id}.pdf`)
    window.api.sales.logShare({ saleId: sale.id, channel: 'pdf' }).catch(console.error)
  }

  const handleImage = (): void => {
    downloadTicketImage(ticket, `comprobante-${sale.id}.png`)
    window.api.sales.logShare({ saleId: sale.id, channel: 'image' }).catch(console.error)
  }

  const dispatchWhatsApp = (phone: string): void => {
    const result = shareOnWhatsApp(ticket, phone)
    if (!result.ok) {
      if (result.reason === 'too_long') {
        toast.error(
          'El comprobante es muy largo para WhatsApp. Descargá el PDF o la imagen y compartilo manualmente.'
        )
      } else {
        toast.error('Número de WhatsApp inválido.')
      }
      return
    }
    window.api.sales
      .logShare({ saleId: sale.id, channel: 'whatsapp', target: phone })
      .catch(console.error)
  }

  const handleWhatsApp = (): void => {
    const fromCustomer = normalizePhone(sale.customer_phone ?? '')
    if (fromCustomer.ok) {
      dispatchWhatsApp(fromCustomer.phone)
      return
    }
    setAskingPhone(true)
  }

  return (
    <>
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
            <span>
              Venta #{sale.id} — {formatGs(sale.total)}
            </span>
          </div>
        }
        footer={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="secondary" onClick={handleWhatsApp}>
              <MessageCircle size={16} /> WhatsApp
            </Button>
            <Button variant="secondary" onClick={handleImage}>
              <ImageDown size={16} /> Imagen
            </Button>
            <Button variant="secondary" onClick={handlePdf}>
              <Download size={16} /> PDF
            </Button>
            {printerReady === false ? (
              <Button variant="secondary" onClick={goToPrinterSettings}>
                <Settings size={16} /> Configurar impresora
              </Button>
            ) : (
              <Button
                onClick={handlePrint}
                disabled={printing || printerReady === null}
                title={printerReady === null ? 'Verificando impresora…' : undefined}
              >
                <Printer size={16} /> {printing ? 'Imprimiendo…' : 'Imprimir'}
              </Button>
            )}
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
          {printerReady === false && (
            <div className="flex items-start gap-3 bg-warning-50 text-warning-700 rounded-xl px-4 py-3">
              <Printer size={18} className="shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <p className="font-medium">No hay impresora térmica configurada</p>
                <p className="text-xs opacity-90 mt-0.5">
                  Podés enviar el comprobante por WhatsApp o guardarlo como PDF o imagen.
                </p>
              </div>
            </div>
          )}
          <div className="bg-surface-muted/40 rounded-xl p-4 max-h-[60vh] overflow-y-auto">
            <Ticket ticket={ticket} />
          </div>
          <p className="text-xs text-text-muted text-center">
            Vista previa exacta. Al imprimir, exportar o compartir se conserva el formato.
          </p>
        </div>
      </Modal>
      {askingPhone && (
        <PhoneInputModal
          onConfirm={(phone) => {
            setAskingPhone(false)
            dispatchWhatsApp(phone)
          }}
          onClose={() => setAskingPhone(false)}
        />
      )}
    </>
  )
}
