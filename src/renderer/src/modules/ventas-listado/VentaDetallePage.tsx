import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, FileText, Printer } from 'lucide-react'
import type { PaymentMethod, Sale } from '@shared/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  TableSkeleton
} from '../../components/ui'
import TicketPreviewModal from '../ventas/TicketPreviewModal'
import MixedCancellationModal from './MixedCancellationModal'
import { formatDateTime, formatGs } from '../../lib/utils'
import { useAuthStore } from '../../store/auth.store'
import { confirm } from '../../lib/confirm'
import { handleApiError } from '../../lib/api-error'
import { toast } from '../../lib/toast'
import { PROCESSOR_LABEL as processorLabels } from '../../lib/processors'

const methodLabels: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  credit: 'Fiado',
  transfer: 'Transferencia',
  mixed: 'Mixto'
}

const methodTone: Record<PaymentMethod, 'success' | 'warning' | 'info' | 'neutral'> = {
  cash: 'success',
  card: 'info',
  credit: 'warning',
  transfer: 'info',
  mixed: 'neutral'
}

function methodLabelWithProcessor(method: string, processor: string | null | undefined): string {
  const base = methodLabels[method] || method
  if (method === 'card' && processor) {
    return `${base} (${processorLabels[processor] || processor})`
  }
  return base
}

export default function VentaDetallePage(): React.ReactElement {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sale, setSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTicket, setShowTicket] = useState(false)
  const [showMixedModal, setShowMixedModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const role = useAuthStore((s) => s.user?.role)
  const canCancel = role === 'admin' || role === 'supervisor'

  useEffect(() => {
    const saleId = Number(id)
    if (!Number.isFinite(saleId)) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    window.api.sales
      .getById(saleId)
      .then((s) => {
        if (!cancelled) setSale(s)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const back = (): void => {
    navigate('/ventas')
  }

  const finalizeCancel = async (refundMixedCredit?: boolean): Promise<void> => {
    if (!sale) return
    setCancelling(true)
    try {
      const updated = await window.api.sales.cancel(
        sale.id,
        refundMixedCredit !== undefined ? { refundMixedCredit } : undefined
      )
      if (updated) {
        setSale(updated)
        toast.success(`Venta #${sale.id} anulada`)
      }
    } catch (err) {
      handleApiError(err)
    } finally {
      setCancelling(false)
      setShowMixedModal(false)
    }
  }

  const onCancelClick = async (): Promise<void> => {
    if (!sale || sale.status === 'cancelled') return
    if (sale.payment_method === 'mixed') {
      setShowMixedModal(true)
      return
    }
    const ok = await confirm({
      title: 'Anular venta',
      message: `¿Anular la venta #${sale.id}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Anular',
      danger: true
    })
    if (ok) await finalizeCancel()
  }

  const mixedPortions = ((): { cash: number; credit: number } => {
    if (!sale || sale.payment_method !== 'mixed') return { cash: 0, credit: 0 }
    let credit = 0
    let other = 0
    for (const p of sale.payments ?? []) {
      if (p.method === 'credit') credit += p.amount
      else other += p.amount
    }
    return { cash: other, credit }
  })()

  return (
    <div className="space-y-5">
      <PageHeader
        title={sale ? `Venta #${sale.id}` : 'Detalle de venta'}
        subtitle={sale ? formatDateTime(sale.created_at) : undefined}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={back} className="rounded-xl">
              <ArrowLeft size={16} />
              Volver
            </Button>
            {canCancel && sale && sale.status !== 'cancelled' && (
              <Button
                variant="danger"
                onClick={onCancelClick}
                disabled={cancelling}
                className="rounded-xl"
                title="Anular esta venta"
              >
                <Ban size={16} />
                {cancelling ? 'Anulando…' : 'Anular'}
              </Button>
            )}
            <Button
              onClick={() => setShowTicket(true)}
              disabled={!sale}
              className="rounded-xl"
              title="Imprimir ticket o exportar a PDF"
            >
              <Printer size={16} />
              Imprimir
            </Button>
          </div>
        }
      />

      {loading && (
        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
          <CardBody>
            <TableSkeleton rows={5} columns={4} />
          </CardBody>
        </Card>
      )}

      {!loading && !sale && (
        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
          <CardBody>
            <EmptyState
              icon={<FileText size={40} />}
              title="Venta no encontrada"
              description="La venta solicitada no existe o fue eliminada."
              action={
                <Button onClick={back} className="rounded-xl">
                  Volver al listado
                </Button>
              }
            />
          </CardBody>
        </Card>
      )}

      {!loading && sale && <SaleDetailContent sale={sale} />}

      {showTicket && sale && (
        <TicketPreviewModal sale={sale} onClose={() => setShowTicket(false)} closeLabel="Cerrar" />
      )}

      {sale && sale.payment_method === 'mixed' && (
        <MixedCancellationModal
          open={showMixedModal}
          cashPortion={mixedPortions.cash}
          creditPortion={mixedPortions.credit}
          customerName={sale.customer_name || 'el cliente'}
          onCancel={() => setShowMixedModal(false)}
          onConfirm={(refund) => finalizeCancel(refund)}
        />
      )}
    </div>
  )
}

function SaleDetailContent({ sale }: { sale: Sale }): React.ReactElement {
  const cancelled = sale.status === 'cancelled'
  const isCredit = sale.payment_method === 'credit'
  const creditPaid = isCredit && sale.customer_balance != null && sale.customer_balance >= 0

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
        <CardBody>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <DetailField label="Fecha" value={formatDateTime(sale.created_at)} mono />
            <DetailField label="Cajero" value={sale.user_name || '—'} />
            <DetailField label="Cliente" value={sale.customer_name || 'Consumidor final'} />
            <div>
              <p className="text-xs text-text-muted">Estado</p>
              <div className="mt-1">
                {cancelled ? (
                  <Badge tone="danger">Anulada</Badge>
                ) : creditPaid ? (
                  <Badge tone="success">Fiado · Pagado</Badge>
                ) : (
                  <Badge tone={methodTone[sale.payment_method]}>
                    {methodLabelWithProcessor(sale.payment_method, sale.payment_processor)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card
        className="rounded-2xl overflow-hidden"
        style={{ boxShadow: 'var(--shadow-card-soft)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-muted/60 text-left text-text-muted">
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium text-right">Cantidad</th>
                <th className="px-4 py-3 font-medium text-right">P. Unit.</th>
                <th className="px-4 py-3 font-medium text-right">Ahorro</th>
                <th className="px-4 py-3 font-medium text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(sale.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-text-muted">
                    Sin items registrados
                  </td>
                </tr>
              ) : (
                (sale.items ?? []).map((it) => {
                  // 005-promotional-pricing: a line was sold under promo when
                  // the (current) normal price exceeds the persisted unit_price.
                  // See data-model.md §1.3 caveat — historical reprints use the
                  // current product.price as the normal, not a snapshot.
                  const soldUnderPromo = it.normal_price != null && it.normal_price > it.unit_price
                  const lineSavings = soldUnderPromo
                    ? Math.round((it.normal_price! - it.unit_price) * Number(it.quantity))
                    : 0
                  return (
                    <tr key={it.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{it.product_name || `#${it.product_id}`}</span>
                          {soldUnderPromo && <Badge tone="success">PROMO</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {it.quantity.toLocaleString('es-PY', { maximumFractionDigits: 3 })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {soldUnderPromo ? (
                          <div className="leading-tight">
                            <p className="text-xs text-text-muted line-through">
                              {formatGs(it.normal_price!)}
                            </p>
                            <p className="text-success-700 font-medium">
                              {formatGs(it.unit_price)}
                            </p>
                          </div>
                        ) : (
                          formatGs(it.unit_price)
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {soldUnderPromo ? (
                          <span className="text-success-700 font-medium">
                            −{formatGs(lineSavings)}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatGs(it.subtotal)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
          <CardBody>
            <p className="text-xs text-text-muted mb-3">Totales</p>
            <div className="space-y-1.5 text-sm">
              {(() => {
                // 005-promotional-pricing: when at least one line was sold
                // under promo, show "Subtotal" as the list-price total and
                // deduct the saving explicitly so the math reads:
                //   Subtotal − Ahorro − Descuento = Total.
                // Falls back to sale.subtotal (legacy display) for sales with
                // no promo lines so non-promo receipts look unchanged.
                const promoSavings = (sale.items ?? []).reduce((sum, it) => {
                  if (it.normal_price != null && it.normal_price > it.unit_price) {
                    return sum + (it.normal_price - it.unit_price) * Number(it.quantity)
                  }
                  return sum
                }, 0)
                const grossSubtotal =
                  promoSavings > 0 ? sale.subtotal + promoSavings : sale.subtotal
                return (
                  <>
                    <Row label="Subtotal" value={formatGs(grossSubtotal)} />
                    {promoSavings > 0 && (
                      <Row
                        label="Ahorro por promoción"
                        value={`−${formatGs(Math.round(promoSavings))}`}
                        positive
                      />
                    )}
                  </>
                )
              })()}
              {sale.discount > 0 && (
                <Row label="Descuento" value={`−${formatGs(sale.discount)}`} negative />
              )}
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold text-brand tabular-nums">
                  {formatGs(sale.total)}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
          <CardBody>
            <p className="text-xs text-text-muted mb-3">Pagos</p>
            {sale.payments && sale.payments.length > 0 ? (
              <ul className="space-y-1.5">
                {sale.payments.map((p) => (
                  <li key={p.id} className="rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center justify-between">
                      <Badge tone={methodTone[p.method as PaymentMethod] ?? 'neutral'}>
                        {methodLabelWithProcessor(p.method, p.processor)}
                      </Badge>
                      <span className="font-medium tabular-nums">{formatGs(p.amount)}</span>
                    </div>
                    {p.reference && (
                      <p className="mt-1 text-xs text-text-muted tabular-nums">
                        Comp.: {p.reference}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <Badge tone={methodTone[sale.payment_method] ?? 'neutral'}>
                    {methodLabelWithProcessor(sale.payment_method, sale.payment_processor)}
                  </Badge>
                  <span className="font-medium tabular-nums">{formatGs(sale.total)}</span>
                </div>
                {sale.payment_reference && (
                  <p className="mt-1 text-xs text-text-muted tabular-nums">
                    Comp.: {sale.payment_reference}
                  </p>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {sale.notes && (
        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
          <CardBody>
            <p className="text-xs text-text-muted mb-1.5">Notas</p>
            <p className="text-sm whitespace-pre-wrap">{sale.notes}</p>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function DetailField({
  label,
  value,
  mono = false
}: {
  label: string
  value: string
  mono?: boolean
}): React.ReactElement {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-sm font-medium text-text-main mt-1 ${mono ? 'tabular-nums' : ''}`}>
        {value}
      </p>
    </div>
  )
}

function Row({
  label,
  value,
  negative = false,
  positive = false
}: {
  label: string
  value: string
  negative?: boolean
  positive?: boolean
}): React.ReactElement {
  return (
    <div className="flex justify-between">
      <span className="text-text-muted">{label}</span>
      <span
        className={`tabular-nums ${negative ? 'text-danger-700' : positive ? 'text-success-700' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}
