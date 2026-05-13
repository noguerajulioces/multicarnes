import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Badge, Skeleton } from '../../../components/ui'
import { formatGs } from '../../../lib/utils'
import type { Sale } from '@shared/types'

interface RecentSalesTableProps {
  sales: Sale[]
  loading?: boolean
}

const methodLabel: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  credit: 'Crédito',
  transfer: 'Transfer.',
  mixed: 'Mixto'
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function RecentSalesTable({ sales, loading }: RecentSalesTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-text-muted border-b border-border">
            <th className="pb-2 font-normal pr-3">#Venta</th>
            <th className="pb-2 font-normal pr-3">Cliente</th>
            <th className="pb-2 font-normal pr-3">Fecha</th>
            <th className="pb-2 font-normal pr-3 text-right">Total</th>
            <th className="pb-2 font-normal">Método</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="py-2.5 pr-3">
                  <Skeleton className="h-4 w-16" />
                </td>
                <td className="py-2.5 pr-3">
                  <Skeleton className="h-4 w-32" />
                </td>
                <td className="py-2.5 pr-3">
                  <Skeleton className="h-4 w-16" />
                </td>
                <td className="py-2.5 pr-3">
                  <Skeleton className="h-4 w-20 ml-auto" />
                </td>
                <td className="py-2.5">
                  <Skeleton className="h-4 w-20" />
                </td>
              </tr>
            ))
          ) : sales.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-8 text-center text-sm text-text-muted">
                Sin ventas recientes
              </td>
            </tr>
          ) : (
            sales.map((s) => (
              <tr
                key={s.id}
                className="border-b border-border last:border-0 hover:bg-surface-muted/50"
              >
                <td className="py-2.5 pr-3 font-medium text-text-main">#{s.id}</td>
                <td className="py-2.5 pr-3 truncate max-w-[180px]">
                  {s.customer_name || <span className="text-text-disabled">Consumidor final</span>}
                </td>
                <td className="py-2.5 pr-3 text-text-muted tabular-nums">
                  {formatShortDate(s.created_at)}
                </td>
                <td className="py-2.5 pr-3 text-right font-medium tabular-nums">
                  {formatGs(s.total)}
                </td>
                <td className="py-2.5">
                  {s.status === 'cancelled' ? (
                    <Badge tone="danger">Anulada</Badge>
                  ) : (
                    <Badge
                      tone={
                        s.payment_method === 'cash'
                          ? 'success'
                          : s.payment_method === 'credit'
                            ? 'warning'
                            : 'info'
                      }
                    >
                      {methodLabel[s.payment_method] ?? s.payment_method}
                    </Badge>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {!loading && sales.length > 0 && (
        <div className="pt-3 mt-1 flex justify-end">
          <Link
            to="/reportes"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-hover"
          >
            Ver todas
            <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </div>
  )
}
