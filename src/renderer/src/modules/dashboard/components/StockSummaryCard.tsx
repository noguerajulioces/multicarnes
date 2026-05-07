import { Package, AlertTriangle, XCircle } from 'lucide-react'
import { Skeleton } from '../../../components/ui'
import type { Product } from '@shared/types'
import { formatQty } from '../../../lib/price-types'

interface StockSummaryCardProps {
  lowStock: Product[]
  loading?: boolean
}

export function StockSummaryCard({ lowStock, loading }: StockSummaryCardProps) {
  const outOfStock = lowStock.filter((p) => p.stock <= 0).length
  const belowMin = lowStock.length - outOfStock

  return (
    <div className="space-y-3">
      <Row
        icon={<Package size={16} className="text-info-700" />}
        bg="bg-info-50"
        label="Productos críticos"
        value={loading ? null : String(lowStock.length)}
      />
      <Row
        icon={<AlertTriangle size={16} className="text-warning-700" />}
        bg="bg-warning-50"
        label="Bajo mínimo"
        value={loading ? null : String(belowMin)}
      />
      <Row
        icon={<XCircle size={16} className="text-danger-700" />}
        bg="bg-danger-50"
        label="Sin stock"
        value={loading ? null : String(outOfStock)}
      />

      {!loading && lowStock.length > 0 && (
        <div className="pt-3 border-t border-border">
          <div className="text-xs text-text-muted mb-2">Más urgentes</div>
          <ul className="space-y-1.5 text-sm">
            {lowStock.slice(0, 4).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{p.name}</span>
                <span className="text-danger-700 font-medium tabular-nums shrink-0">
                  {formatQty(p.stock, p.price_type)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Row({
  icon,
  bg,
  label,
  value
}: {
  icon: React.ReactNode
  bg: string
  label: string
  value: string | null
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-muted">{label}</div>
        {value === null ? (
          <Skeleton className="h-5 w-10 mt-0.5" />
        ) : (
          <div className="text-lg font-semibold tabular-nums">{value}</div>
        )}
      </div>
    </div>
  )
}
