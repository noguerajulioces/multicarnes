import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatGs } from '../../lib/utils'
import { ShoppingCart, AlertTriangle, TrendingUp } from 'lucide-react'
import { Skeleton, TableSkeleton } from '../../components/ui'
import type { Product } from '@shared/types'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [dayTotal, setDayTotal] = useState({ total: 0, count: 0 })
  const [lowStock, setLowStock] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([window.api.sales.dayTotal(), window.api.products.lowStock()])
      .then(([dt, ls]) => {
        setDayTotal(dt)
        setLowStock(ls)
      })
      .finally(() => setLoading(false))
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
        <StatCard
          icon={<TrendingUp size={20} className="text-success-700" />}
          iconBg="bg-success-50"
          label="Total Vendido Hoy"
          value={formatGs(dayTotal.total)}
          loading={loading}
        />
        <StatCard
          icon={<ShoppingCart size={20} className="text-info-700" />}
          iconBg="bg-info-50"
          label="Ventas del Día"
          value={String(dayTotal.count)}
          loading={loading}
        />
        <StatCard
          icon={<AlertTriangle size={20} className="text-warning-700" />}
          iconBg="bg-warning-50"
          label="Alertas de Stock"
          value={String(lowStock.length)}
          loading={loading}
        />
      </div>

      {loading ? (
        <div className="bg-surface rounded-lg shadow-sm p-6">
          <Skeleton className="h-5 w-56 mb-4" />
          <TableSkeleton rows={5} columns={3} />
        </div>
      ) : lowStock.length > 0 ? (
        <div className="bg-surface rounded-lg shadow-sm p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning-500" />
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
                    <td className="py-2 text-danger-700 font-medium">
                      {p.stock} {p.price_type === 'kg' ? 'kg' : 'u.'}
                    </td>
                    <td className="py-2">
                      {p.min_stock} {p.price_type === 'kg' ? 'kg' : 'u.'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  iconBg: string
  label: string
  value: string
  loading?: boolean
}

function StatCard({ icon, iconBg, label, value, loading }: StatCardProps) {
  return (
    <div className="bg-surface rounded-lg p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
        <span className="text-text-muted text-sm">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-32" />
      ) : (
        <p className="text-2xl font-bold">{value}</p>
      )}
    </div>
  )
}
