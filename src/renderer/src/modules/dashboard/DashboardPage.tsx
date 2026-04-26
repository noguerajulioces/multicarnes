import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatGs } from '../../lib/utils'
import { ShoppingCart, AlertTriangle, TrendingUp } from 'lucide-react'
import type { Product } from '@shared/types'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [dayTotal, setDayTotal] = useState({ total: 0, count: 0 })
  const [lowStock, setLowStock] = useState<Product[]>([])

  useEffect(() => {
    window.api.sales.dayTotal().then(setDayTotal)
    window.api.products.lowStock().then(setLowStock)
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={() => navigate('/ventas')}
          className="bg-brand text-white px-6 py-3 rounded-lg font-medium hover:bg-brand-hover flex items-center gap-2 text-lg"
        >
          <ShoppingCart size={20} />
          Nueva Venta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp size={20} className="text-green-600" />
            </div>
            <span className="text-text-muted text-sm">Total Vendido Hoy</span>
          </div>
          <p className="text-2xl font-bold">{formatGs(dayTotal.total)}</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ShoppingCart size={20} className="text-blue-600" />
            </div>
            <span className="text-text-muted text-sm">Ventas del Día</span>
          </div>
          <p className="text-2xl font-bold">{dayTotal.count}</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle size={20} className="text-orange-600" />
            </div>
            <span className="text-text-muted text-sm">Alertas de Stock</span>
          </div>
          <p className="text-2xl font-bold">{lowStock.length}</p>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-500" />
            Productos con Stock Bajo
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-text-muted">
                  <th className="pb-2">Producto</th>
                  <th className="pb-2">Stock Actual</th>
                  <th className="pb-2">Stock Mínimo</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.slice(0, 10).map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="py-2 text-red-600 font-medium">
                      {p.stock} {p.price_type === 'kg' ? 'kg' : 'u.'}
                    </td>
                    <td className="py-2">{p.min_stock} {p.price_type === 'kg' ? 'kg' : 'u.'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
