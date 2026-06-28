import type { Sale } from '@shared/types'
import { exportToPDF, type SummaryRow } from './export'
import { formatGs, formatDate, formatTime } from './utils'
import { PROCESSOR_LABEL } from './processors'

// Daily cash-close PDF ("hoja de cierre"). Built from register-scoped data so it
// works for whoever closes the caja (admin/supervisor/cajero), and downloaded
// from the cierre screen right after the close — when the closing amount,
// expected and difference already exist on the register.

type Movement = {
  id?: number
  created_at: string
  type: string // 'opening' | 'closing' | 'income' | 'expense' | 'void'
  amount: number
  description: string | null
  void_of?: number | null
}

export interface CierreReportInput {
  register: {
    id: number
    opening_amount: number
    closing_amount: number | null
    expected_amount: number | null
    difference: number | null
    opened_at: string
    closed_at: string | null
  }
  // From cash.getSummary(registerId): exploded, register-scoped totals.
  summary: {
    cashSales: number // ventas en efectivo (incluye porción cash de mixtas)
    incomes: number
    expenses: number
    otherMethodsTotals: { method: string; total: number; count: number }[]
    salesByMethod: { payment_method: string; total: number; count: number }[]
  }
  sales: Sale[]
  movements: Movement[]
}

const methodLabels: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  credit: 'Fiado',
  transfer: 'Transferencia',
  mixed: 'Mixto'
}

function methodLabel(s: Sale): string {
  const base = methodLabels[s.payment_method] || s.payment_method
  if (s.payment_method === 'card' && s.payment_processor) {
    return `${base} (${PROCESSOR_LABEL[s.payment_processor] || s.payment_processor})`
  }
  return base
}

const movementColumns = [
  { header: 'Fecha', key: '_fecha', width: 14 },
  { header: 'Hora', key: '_hora', width: 9 },
  { header: 'Tipo', key: '_tipo', width: 12 },
  { header: 'Concepto', key: '_concepto', width: 30 },
  { header: 'Monto', key: '_monto', align: 'right' as const, width: 16, numeric: true }
]

const ticketColumns = [
  { header: 'Fecha', key: '_fecha', width: 14 },
  { header: 'Hora', key: '_hora', width: 9 },
  { header: 'Cliente', key: 'customer_name', width: 30 },
  { header: 'Total', key: '_total', align: 'right' as const, width: 20, numeric: true },
  { header: 'Método', key: '_method', width: 22 }
]

export function downloadCierreReport(input: CierreReportInput): void {
  const { register, summary, sales, movements } = input

  const methodTotal = (m: string): number =>
    summary.otherMethodsTotals.find((r) => r.method === m)?.total ?? 0
  const electronico = methodTotal('transfer') + methodTotal('card')
  const fiado = methodTotal('credit')
  const totalVentas = summary.salesByMethod.reduce((a, r) => a + r.total, 0)
  const ventasCount = summary.salesByMethod.reduce((a, r) => a + r.count, 0)
  const mixedCount = summary.salesByMethod.find((r) => r.payment_method === 'mixed')?.count ?? 0

  const apertura = register.opening_amount
  const cashSales = summary.cashSales
  const expected =
    register.expected_amount ?? apertura + cashSales + summary.incomes - summary.expenses
  const counted = register.closing_amount ?? 0
  const diff = register.difference ?? counted - expected

  // "Caja": arqueo en cascada (replica la fórmula del servidor) + veredicto.
  const rows: SummaryRow[] = []
  rows.push({ group: 'Caja (efectivo)' })
  rows.push({ label: 'Apertura', value: formatGs(apertura) })
  rows.push({ label: '+ Ventas en efectivo', value: formatGs(cashSales), indent: true })
  rows.push({ label: '+ Entradas (no ventas)', value: formatGs(summary.incomes), indent: true })
  rows.push({ label: '- Salidas', value: formatGs(summary.expenses), indent: true })
  rows.push({ label: '= Debería haber', value: formatGs(expected), bold: true })
  rows.push({ label: 'Cierre de caja', value: formatGs(counted) })
  if (diff === 0) rows.push({ label: 'Resultado', value: 'CUADRA', tone: 'good', bold: true })
  else if (diff > 0)
    rows.push({ label: 'Resultado', value: `SOBRÓ ${formatGs(diff)}`, tone: 'good', bold: true })
  else rows.push({ label: 'Resultado', value: `FALTÓ ${formatGs(-diff)}`, tone: 'bad', bold: true })

  // "Ventas del día": total + desglose por método (exploded).
  rows.push({ group: 'Ventas del día' })
  rows.push({ label: `Total vendido (${ventasCount})`, value: formatGs(totalVentas), bold: true })
  rows.push({ label: 'Efectivo', value: formatGs(cashSales) })
  rows.push({ label: 'Transf. / QR / Tarjeta', value: formatGs(electronico) })
  rows.push({ label: 'Fiado', value: formatGs(fiado) })
  if (mixedCount > 0) {
    rows.push({
      note: `Incluye ${mixedCount} venta${mixedCount === 1 ? '' : 's'} mixta${mixedCount === 1 ? '' : 's'}, repartida${mixedCount === 1 ? '' : 's'} por método.`
    })
  }
  rows.push({
    note: 'Solo el efectivo entra en caja. Tarjeta, Transferencia/QR y Fiado no son plata física.'
  })

  // Entradas/salidas manuales (excluye anulados y los anulados originales).
  const voidedIds = new Set<number>(
    movements.filter((m) => m.void_of != null).map((m) => m.void_of as number)
  )
  const movRows = movements
    .filter(
      (m) => (m.type === 'income' || m.type === 'expense') && !(m.id != null && voidedIds.has(m.id))
    )
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m) => ({
      _fecha: formatDate(m.created_at),
      _hora: formatTime(m.created_at),
      _tipo: m.type === 'income' ? 'Entrada' : 'Salida',
      _concepto: m.description || '',
      _monto: m.type === 'income' ? m.amount : -m.amount
    }))

  // Detalle de ventas (sin anuladas), ordenado cronológicamente.
  const ticketRows = sales
    .filter((s) => s.status !== 'cancelled')
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((s) => ({
      _fecha: formatDate(s.created_at),
      _hora: formatTime(s.created_at),
      customer_name: s.customer_name || '-',
      _total: s.total,
      _method: methodLabel(s)
    }))

  const stamp = register.closed_at ?? register.opened_at
  const dateLabel = formatDate(stamp)
  const isoDate = stamp.slice(0, 10)

  exportToPDF(
    [], // sin tabla principal: el detalle va como sección
    ticketColumns,
    `cierre-caja-${register.id}-${isoDate}`,
    `Cierre de caja — ${dateLabel}`,
    rows,
    [
      ...(movRows.length > 0
        ? [
            {
              title: 'Entradas y salidas de efectivo (no ventas)',
              columns: movementColumns,
              rows: movRows
            }
          ]
        : []),
      { title: 'Detalle de ventas', columns: ticketColumns, rows: ticketRows }
    ],
    { businessName: 'Multicarnes S.R.L.' }
  )
}
