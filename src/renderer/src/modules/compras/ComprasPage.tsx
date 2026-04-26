import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatGs, formatDateTime } from '../../lib/utils'
import type { PurchaseOrder } from '@shared/types'
import { Plus } from 'lucide-react'

export default function ComprasPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    window.api.purchases.getAll(filterStatus || undefined).then(setOrders)
  }, [filterStatus])

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    received: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700'
  }
  const statusLabels: Record<string, string> = {
    pending: 'Pendiente', received: 'Recibida', cancelled: 'Cancelada'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Compras</h1>
        <div className="flex gap-3">
          <button onClick={() => navigate('/compras/proveedores')}
            className="border border-brand text-brand px-4 py-2 rounded-lg hover:bg-brand-light">Proveedores</button>
          <button onClick={() => navigate('/compras/nueva')}
            className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover flex items-center gap-2">
            <Plus size={16} /> Nueva Orden
          </button>
        </div>
      </div>

      <div className="mb-4">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="received">Recibida</option>
          <option value="cancelled">Cancelada</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-bg-secondary text-left text-text-muted">
            <th className="p-3">Fecha</th><th className="p-3">Proveedor</th>
            <th className="p-3 text-right">Total</th><th className="p-3">Estado</th><th className="p-3">Acciones</th>
          </tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{formatDateTime(o.created_at)}</td>
                <td className="p-3">{o.supplier_name || '-'}</td>
                <td className="p-3 text-right font-medium">{formatGs(o.total)}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[o.status]}`}>
                    {statusLabels[o.status]}
                  </span>
                </td>
                <td className="p-3">
                  <button onClick={() => navigate(`/compras/${o.id}`)} className="text-brand text-xs hover:underline">Ver detalle</button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-text-muted">Sin órdenes</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
