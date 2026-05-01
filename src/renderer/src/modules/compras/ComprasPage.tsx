import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatGs, formatDateTime, cn } from '../../lib/utils'
import type { PurchaseOrder, OrderStatus } from '@shared/types'
import { Plus, Truck, Users, ChevronRight } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader
} from '../../components/ui'

type StatusFilter = '' | OrderStatus

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'received', label: 'Recibidas' },
  { value: 'cancelled', label: 'Canceladas' }
]

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

export default function ComprasPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('')

  useEffect(() => {
    window.api.purchases.getAll(filterStatus || undefined).then(setOrders)
  }, [filterStatus])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Compras"
        subtitle={`${orders.length} orden${orders.length === 1 ? '' : 'es'} en el listado`}
        actions={
          <>
            <Button
              variant="secondary"
              className="rounded-xl"
              onClick={() => navigate('/compras/proveedores')}
            >
              <Users size={16} />
              Proveedores
            </Button>
            <button
              onClick={() => navigate('/compras/nueva')}
              className="bg-brand text-white px-4 py-2.5 rounded-xl font-medium hover:bg-brand-hover flex items-center gap-2 shadow-sm transition-colors"
            >
              <Plus size={18} />
              Nueva Orden
            </button>
          </>
        }
      />

      <div className="flex gap-2 flex-wrap">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilterStatus(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              filterStatus === opt.value
                ? 'bg-brand text-white border-brand'
                : 'bg-surface text-text-main border-border hover:bg-surface-muted'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Card className="rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-muted/60 text-left text-text-muted">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Proveedor</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => navigate(`/compras/${o.id}`)}
                  className="border-t border-border hover:bg-surface-muted/40 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-text-muted tabular-nums">
                    {formatDateTime(o.created_at)}
                  </td>
                  <td className="px-4 py-3 font-medium text-text-main">
                    {o.supplier_name || <span className="text-text-disabled">Sin proveedor</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatGs(o.total)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone[o.status]}>{statusLabel[o.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight size={16} className="text-text-disabled" />
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={<Truck size={40} />}
                      title={filterStatus ? 'Sin órdenes con ese estado' : 'Aún no hay órdenes de compra'}
                      description={
                        filterStatus
                          ? 'Cambiá el filtro o creá una nueva orden.'
                          : 'Registrá compras a proveedores para mantener el stock al día.'
                      }
                      action={
                        <Button onClick={() => navigate('/compras/nueva')}>
                          <Plus size={16} /> Nueva Orden
                        </Button>
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
