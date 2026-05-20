import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Package, Truck, FileText } from 'lucide-react'
import { formatGs, formatDateTime } from '../../lib/utils'
import { formatQty } from '../../lib/price-types'
import { confirm } from '../../lib/confirm'
import { toast } from '../../lib/toast'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Skeleton,
  Table,
  TableSkeleton,
  TBody,
  Td,
  Th,
  THead,
  TourButton,
  Tr
} from '../../components/ui'
import { usePageTour } from '../../lib/use-page-tour'
import { compraDetalleTourSteps, compraDetallePendingTourSteps } from '../../lib/tour-steps'
import { handleApiError } from '../../lib/api-error'
import type { OrderStatus, PurchaseOrder } from '@shared/types'

const statusTone: Record<OrderStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  received: 'success',
  cancelled: 'danger'
}

const statusLabel: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  received: 'Recibida',
  cancelled: 'Cancelada'
}

export default function CompraDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadOrder()
  }, [id])

  const loadOrder = (): void => {
    window.api.purchases.getById(Number(id)).then(setOrder)
  }

  const handleReceive = async (): Promise<void> => {
    setLoading(true)
    try {
      await window.api.purchases.receive(Number(id))
      toast.success('Orden marcada como recibida')
      loadOrder()
    } catch (err) {
      handleApiError(err)
    }
    setLoading(false)
  }

  const handleCancel = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Cancelar orden de compra',
      message: `¿Cancelar la orden #${id}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Cancelar orden',
      cancelLabel: 'Volver',
      danger: true
    })
    if (!ok) return
    setLoading(true)
    try {
      await window.api.purchases.cancel(Number(id))
      toast.info('Orden cancelada')
      loadOrder()
    } catch (err) {
      handleApiError(err)
    }
    setLoading(false)
  }

  const tourSteps =
    order?.status === 'pending' ? compraDetallePendingTourSteps : compraDetalleTourSteps
  const { startTour } = usePageTour({
    key: order?.status === 'pending' ? 'compra-detalle-pending' : 'compra-detalle',
    steps: tourSteps,
    ready: !!order
  })

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <button
          onClick={() => navigate('/compras')}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-brand"
        >
          <ArrowLeft size={14} />
          Volver a Compras
        </button>
        <Card>
          <CardHeader className="flex justify-between items-start">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-7 w-24 rounded-full" />
          </CardHeader>
          <CardBody>
            <TableSkeleton rows={4} columns={4} />
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate('/compras')}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-brand transition-colors"
        >
          <ArrowLeft size={14} />
          Volver a Compras
        </button>
        <TourButton onClick={startTour} size="sm" />
      </div>

      <Card
        data-tour="compra-detalle-header"
      >
        <CardHeader className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: 'var(--gradient-kpi-purple)' }}
            >
              <Truck size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-text-main">Orden #{order.id}</h1>
              <p className="text-xs text-text-muted tabular-nums mt-0.5">
                {formatDateTime(order.created_at)}
              </p>
              <p className="text-sm text-text-main mt-1">
                Proveedor:{' '}
                <span className="font-medium">
                  {order.supplier_name || <span className="text-text-disabled">Sin proveedor</span>}
                </span>
              </p>
            </div>
          </div>
          <Badge tone={statusTone[order.status]}>{statusLabel[order.status]}</Badge>
        </CardHeader>

        <CardBody data-tour="compra-detalle-items">
          <Table>
            <THead>
              <Tr>
                <Th>
                  <div className="inline-flex items-center gap-1.5">
                    <Package size={12} />
                    Producto
                  </div>
                </Th>
                <Th className="text-right">Cantidad</Th>
                <Th className="text-right">Costo unit.</Th>
                <Th className="text-right">Subtotal</Th>
              </Tr>
            </THead>
            <TBody>
              {order.items?.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium">{item.product_name}</Td>
                  <Td className="text-right tabular-nums">
                    {formatQty(item.quantity, item.price_type ?? 'unit')}
                  </Td>
                  <Td className="text-right tabular-nums">{formatGs(item.unit_cost)}</Td>
                  <Td className="text-right font-medium tabular-nums">{formatGs(item.subtotal)}</Td>
                </Tr>
              ))}
            </TBody>
            <tfoot>
              <tr className="border-t-2 border-border">
                <Td colSpan={3} className="text-right font-medium text-text-muted">
                  Total
                </Td>
                <Td className="text-right text-xl font-bold text-brand tabular-nums">
                  {formatGs(order.total)}
                </Td>
              </tr>
            </tfoot>
          </Table>

          {order.notes && (
            <div className="mt-4 flex items-start gap-2 px-3 py-2.5 bg-surface-muted rounded-lg">
              <FileText size={14} className="text-text-muted mt-0.5 shrink-0" />
              <p className="text-sm text-text-main">{order.notes}</p>
            </div>
          )}
        </CardBody>

        {order.status === 'pending' && (
          <div
            data-tour="compra-detalle-actions"
            className="px-4 py-4 border-t border-border bg-surface-muted/40 flex gap-3"
          >
            <Button
              variant="danger"
              className="flex-1 rounded-xl"
              size="lg"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancelar Orden
            </Button>
            <Button
              className="flex-1 rounded-xl"
              size="lg"
              onClick={handleReceive}
              disabled={loading}
            >
              Marcar como Recibida
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
