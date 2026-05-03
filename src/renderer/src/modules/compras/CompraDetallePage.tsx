import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Package, Truck, FileText } from 'lucide-react'
import { formatGs, formatDateTime } from '../../lib/utils'
import { confirm } from '../../lib/confirm'
import { toast } from '../../lib/toast'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Skeleton,
  TableSkeleton
} from '../../components/ui'
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
    await window.api.purchases.receive(Number(id))
    toast.success('Orden marcada como recibida')
    loadOrder()
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
    await window.api.purchases.cancel(Number(id))
    toast.info('Orden cancelada')
    loadOrder()
    setLoading(false)
  }

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
        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
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
      <button
        onClick={() => navigate('/compras')}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-brand transition-colors"
      >
        <ArrowLeft size={14} />
        Volver a Compras
      </button>

      <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
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

        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted text-left">
                  <th className="pb-2 font-normal pr-3">
                    <div className="inline-flex items-center gap-1.5">
                      <Package size={12} />
                      Producto
                    </div>
                  </th>
                  <th className="pb-2 font-normal pr-3 text-right">Cantidad</th>
                  <th className="pb-2 font-normal pr-3 text-right">Costo unit.</th>
                  <th className="pb-2 font-normal text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{item.product_name}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{item.quantity}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatGs(item.unit_cost)}
                    </td>
                    <td className="py-2.5 text-right font-medium tabular-nums">
                      {formatGs(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td colSpan={3} className="pt-3 text-right font-medium text-text-muted">
                    Total
                  </td>
                  <td className="pt-3 text-right text-xl font-bold text-brand tabular-nums">
                    {formatGs(order.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {order.notes && (
            <div className="mt-4 flex items-start gap-2 px-3 py-2.5 bg-surface-muted rounded-lg">
              <FileText size={14} className="text-text-muted mt-0.5 shrink-0" />
              <p className="text-sm text-text-main">{order.notes}</p>
            </div>
          )}
        </CardBody>

        {order.status === 'pending' && (
          <div className="px-4 py-4 border-t border-border bg-surface-muted/40 flex gap-3">
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
