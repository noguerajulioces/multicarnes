import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Badge, Skeleton, Table, THead, TBody, Tr, Th, Td } from '../../../components/ui'
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
      <Table>
        <THead>
          <Tr>
            <Th>#Venta</Th>
            <Th>Cliente</Th>
            <Th>Fecha</Th>
            <Th className="text-right">Total</Th>
            <Th>Método</Th>
          </Tr>
        </THead>
        <TBody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Tr key={i}>
                <Td>
                  <Skeleton className="h-4 w-16" />
                </Td>
                <Td>
                  <Skeleton className="h-4 w-32" />
                </Td>
                <Td>
                  <Skeleton className="h-4 w-16" />
                </Td>
                <Td>
                  <Skeleton className="h-4 w-20 ml-auto" />
                </Td>
                <Td>
                  <Skeleton className="h-4 w-20" />
                </Td>
              </Tr>
            ))
          ) : sales.length === 0 ? (
            <Tr>
              <Td colSpan={5} className="py-8 text-center text-text-muted">
                Sin ventas recientes
              </Td>
            </Tr>
          ) : (
            sales.map((s) => (
              <Tr key={s.id}>
                <Td className="font-medium text-text-main">#{s.id}</Td>
                <Td className="truncate max-w-[180px]">
                  {s.customer_name || <span className="text-text-disabled">Consumidor final</span>}
                </Td>
                <Td className="text-text-muted tabular-nums">{formatShortDate(s.created_at)}</Td>
                <Td className="text-right font-medium tabular-nums">{formatGs(s.total)}</Td>
                <Td>
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
                </Td>
              </Tr>
            ))
          )}
        </TBody>
      </Table>
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
