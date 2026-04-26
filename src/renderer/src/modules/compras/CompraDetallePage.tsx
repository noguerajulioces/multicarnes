import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { formatGs, formatDateTime } from '../../lib/utils'
import type { PurchaseOrder } from '@shared/types'

export default function CompraDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<PurchaseOrder | null>(null)

  useEffect(() => { loadOrder() }, [id])

  const loadOrder = () => {
    window.api.purchases.getById(Number(id)).then(setOrder)
  }

  const handleReceive = async () => {
    await window.api.purchases.receive(Number(id))
    loadOrder()
  }
  const handleCancel = async () => {
    await window.api.purchases.cancel(Number(id))
    loadOrder()
  }

  if (!order) return <p className="text-text-muted">Cargando...</p>

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/compras')} className="text-sm text-brand hover:underline mb-4">← Volver</button>
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-bold">Orden #{order.id}</h1>
            <p className="text-text-muted text-sm">{formatDateTime(order.created_at)}</p>
            <p className="text-sm">Proveedor: <span className="font-medium">{order.supplier_name || '-'}</span></p>
          </div>
          <span className={`px-3 py-1 rounded text-sm font-medium ${
            order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
            order.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {{ pending: 'Pendiente', received: 'Recibida', cancelled: 'Cancelada' }[order.status]}
          </span>
        </div>

        <table className="w-full text-sm mb-6">
          <thead><tr className="border-b text-text-muted text-left">
            <th className="pb-2">Producto</th><th className="pb-2 text-right">Cantidad</th>
            <th className="pb-2 text-right">Costo unit.</th><th className="pb-2 text-right">Subtotal</th>
          </tr></thead>
          <tbody>
            {order.items?.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2">{item.product_name}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{formatGs(item.unit_cost)}</td>
                <td className="py-2 text-right font-medium">{formatGs(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={3} className="pt-3 text-right font-bold">Total:</td>
            <td className="pt-3 text-right text-lg font-bold">{formatGs(order.total)}</td></tr></tfoot>
        </table>

        {order.notes && <p className="text-sm text-text-muted mb-4">Notas: {order.notes}</p>}

        {order.status === 'pending' && (
          <div className="flex gap-3">
            <button onClick={handleCancel} className="flex-1 border border-red-300 text-red-600 py-2 rounded-lg hover:bg-red-50">
              Cancelar Orden
            </button>
            <button onClick={handleReceive} className="flex-1 bg-brand text-white py-2 rounded-lg hover:bg-brand-hover">
              Marcar como Recibida
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
