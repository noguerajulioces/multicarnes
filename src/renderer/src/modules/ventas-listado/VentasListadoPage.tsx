import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  formatGs,
  formatDate,
  formatDateTime,
  formatTime,
  todayStr,
  firstDayOfMonthStr
} from '../../lib/utils'
import { exportToExcel, exportToPDF } from '../../lib/export'
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  TableSkeleton
} from '../../components/ui'
import type { PaymentMethod, Sale } from '@shared/types'

// 010: a caja movement itemized into the export (mirrors CashMovementExportRow in
// preload). Each apertura/cierre/ingreso/egreso becomes its own row.
type CashMov = {
  created_at: string
  type: 'opening' | 'closing' | 'income' | 'expense'
  amount: number
  description: string | null
  user_name: string | null
}
import { Eye, FileSpreadsheet, FileText, Plus, Printer, Search } from 'lucide-react'
import TicketPreviewModal from '../ventas/TicketPreviewModal'
import { PROCESSOR_LABEL as processorLabels } from '../../lib/processors'

const methodLabels: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  credit: 'Fiado',
  transfer: 'Transferencia',
  mixed: 'Mixto'
}

const methodTone: Record<PaymentMethod, 'success' | 'warning' | 'info' | 'neutral'> = {
  cash: 'success',
  card: 'info',
  credit: 'warning',
  transfer: 'info',
  mixed: 'neutral'
}

// 009: per-sale amount attributable to a payment method. A single-method sale
// puts its whole total in that method; a mixed sale splits by its sale_payments.
// Cancelled sales contribute nothing (consistent with the footer total).
function portionOf(s: Sale, method: PaymentMethod): number {
  if (s.status === 'cancelled') return 0
  if (s.payment_method === method) return s.total
  if (s.payment_method === 'mixed') {
    return (s.payments ?? []).reduce((a, p) => a + (p.method === method ? p.amount : 0), 0)
  }
  return 0
}

const exportColumns = [
  { header: 'Fecha', key: '_fecha', width: 12 },
  { header: 'Hora', key: '_hora', width: 8 },
  { header: 'N°', key: '_num', width: 8 },
  { header: 'Tipo', key: '_tipo', width: 10 },
  { header: 'Cliente', key: 'customer_name', width: 22 },
  { header: 'Concepto', key: '_concepto', width: 22 },
  { header: 'Total', key: '_total', align: 'right' as const, width: 14, numeric: true },
  { header: 'Fiado', key: '_fiado', align: 'right' as const, width: 13, numeric: true },
  { header: 'Método', key: '_method', width: 16 },
  { header: 'Cajero', key: 'user_name', width: 18 },
  { header: 'Apertura', key: '_apertura', align: 'right' as const, width: 14, numeric: true },
  { header: 'Cierre', key: '_cierre', align: 'right' as const, width: 14, numeric: true },
  { header: 'Ingresos', key: '_ingresos', align: 'right' as const, width: 13, numeric: true },
  { header: 'Egresos', key: '_egresos', align: 'right' as const, width: 13, numeric: true }
]

const tableHeadCls = 'bg-surface-muted/60 text-left text-text-muted'
const thCls = 'px-4 py-3 font-medium'
const trCls = 'border-t border-border hover:bg-surface-muted/40 transition-colors cursor-pointer'
const tdCls = 'px-4 py-3'

const PER_PAGE = 50

export default function VentasListadoPage() {
  const navigate = useNavigate()
  const [from, setFrom] = useState(firstDayOfMonthStr())
  const [to, setTo] = useState(todayStr())
  const [data, setData] = useState<Sale[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [printSale, setPrintSale] = useState<Sale | null>(null)
  const [printingId, setPrintingId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const [creditOnly, setCreditOnly] = useState(false)

  const load = async (targetPage: number = page, credit: boolean = creditOnly): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.api.sales.getAll({
        from,
        to,
        page: targetPage,
        perPage: PER_PAGE,
        ...(credit ? { creditOnly: true } : {})
      })
      setData(result.items)
      setTotal(result.total)
      setPage(result.page)
    } catch {
      /* ignore */
    }
    setLoading(false)
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPageChange = (next: number): void => {
    void load(next)
  }

  const onConsultar = (): void => {
    // Reset to page 1 whenever the date range changes.
    void load(1)
  }

  const goToDetail = (id: number): void => {
    navigate(`/ventas/${id}`)
  }

  const openPrint = async (id: number): Promise<void> => {
    setPrintingId(id)
    try {
      const sale = await window.api.sales.getById(id)
      if (sale) setPrintSale(sale)
    } finally {
      setPrintingId(null)
    }
  }

  const methodCellLabel = (s: Sale): string => {
    const base = methodLabels[s.payment_method] || s.payment_method
    if (s.payment_method === 'card' && s.payment_processor) {
      return `${base} (${processorLabels[s.payment_processor] || s.payment_processor})`
    }
    return base
  }

  // 010: one export row per sale. Total and Fiado are raw numbers (sumable in
  // Excel); Fiado is 0 when the sale has no credit portion. Per-method columns
  // were dropped — the Método column already names the payment method. A
  // cancelled sale exports total 0 so it doesn't inflate sums.
  const saleToRow = (s: Sale): Record<string, unknown> => {
    const cancelled = s.status === 'cancelled'
    return {
      ...s,
      _fecha: formatDate(s.created_at),
      _hora: formatTime(s.created_at),
      _num: `#${s.id}`,
      _tipo: cancelled ? 'Anulada' : 'Venta',
      customer_name: s.customer_name || '-',
      _concepto: '',
      _total: cancelled ? 0 : s.total,
      _fiado: portionOf(s, 'credit'),
      _method: methodCellLabel(s)
    }
  }

  // 010: a caja movement as its own row (Tipo Apertura/Cierre/Ingreso/Egreso), with
  // its amount in the matching column. For ingresos/egresos the description goes in
  // the Cliente column; Hora/Cajero reflect when and who registered it.
  const movementRow = (m: CashMov): Record<string, unknown> => {
    const tipo =
      m.type === 'opening'
        ? 'Apertura'
        : m.type === 'closing'
          ? 'Cierre'
          : m.type === 'income'
            ? 'Ingreso'
            : 'Egreso'
    return {
      _fecha: formatDate(m.created_at),
      _hora: formatTime(m.created_at),
      _num: '',
      _tipo: tipo,
      // 010: Cliente queda vacío en movimientos (filtro de Cliente limpio); el
      // detalle del movimiento va en la columna Concepto.
      customer_name: '',
      _concepto: m.description || '',
      _total: undefined,
      _fiado: undefined,
      _method: '',
      user_name: m.user_name || '',
      _apertura: m.type === 'opening' ? m.amount : undefined,
      _cierre: m.type === 'closing' ? m.amount : undefined,
      _ingresos: m.type === 'income' ? m.amount : undefined,
      _egresos: m.type === 'expense' ? -m.amount : undefined
    }
  }

  // 010: build the export as a single chronological log — sales and caja movements
  // interleaved by created_at. Apertura (opening) lands first in its day and Cierre
  // (closing) last; each ingreso/egreso is its own row, like a sale. A still-open
  // caja simply has no Cierre row yet.
  const buildExportRows = (sales: Sale[], movements: CashMov[]): Record<string, unknown>[] => {
    const events: { at: string; row: Record<string, unknown> }[] = [
      ...sales.map((s) => ({ at: s.created_at, row: saleToRow(s) })),
      ...movements.map((m) => ({ at: m.created_at, row: movementRow(m) }))
    ]
    events.sort((a, b) => a.at.localeCompare(b.at))
    return events.map((e) => e.row)
  }

  // Export fetches the full period (no pagination) so the file always
  // reflects the whole date range the user is looking at, not just the
  // current page.
  const fetchAllForExport = async (): Promise<Sale[]> => {
    const result = await window.api.sales.getAll({ from, to })
    return result.items
  }

  // 010: best-effort — reports:cashMovementsForExport is admin/supervisor only, so
  // a cashier export simply omits the caja movement rows.
  const fetchCashMovements = async (): Promise<CashMov[]> => {
    try {
      return await window.api.reports.cashMovementsForExport(from, to)
    } catch {
      return []
    }
  }

  // The XLSX/jsPDF generation is synchronous and blocks the renderer thread.
  // Flip `exporting` and yield a frame first so the button can paint its
  // disabled/"Generando..." state before the UI freezes during generation.
  const runExport = async (
    generate: (rows: Record<string, unknown>[]) => void
  ): Promise<void> => {
    if (exporting) return
    setExporting(true)
    try {
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      const [all, movements] = await Promise.all([fetchAllForExport(), fetchCashMovements()])
      generate(buildExportRows(all, movements))
    } finally {
      setExporting(false)
    }
  }

  const handleExportExcel = (): Promise<void> =>
    runExport((rows) =>
      exportToExcel(rows, exportColumns, `ventas_${from}_${to}`, `Ventas (${from} a ${to})`)
    )

  const handleExportPDF = (): Promise<void> =>
    runExport((rows) =>
      exportToPDF(rows, exportColumns, `ventas_${from}_${to}`, `Ventas (${from} a ${to})`)
    )

  const hasData = data.length > 0
  const showEmpty = !loading && !hasData

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ventas"
        subtitle="Listado de ventas registradas en el período"
        actions={
          <Button onClick={() => navigate('/pos')} className="rounded-xl">
            <Plus size={16} />
            Nueva venta
          </Button>
        }
      />

      <Card>
        <CardBody className="space-y-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs text-text-muted mb-1">Desde</label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-44"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Hasta</label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-44"
              />
            </div>
            <Button onClick={onConsultar} disabled={loading} className="rounded-xl">
              <Search size={16} />
              {loading ? 'Cargando...' : 'Consultar'}
            </Button>
            <label className="flex items-center gap-2 text-sm text-text-muted select-none cursor-pointer">
              <input
                type="checkbox"
                checked={creditOnly}
                onChange={(e) => {
                  setCreditOnly(e.target.checked)
                  void load(1, e.target.checked)
                }}
                className="rounded border-border accent-brand"
              />
              Solo ventas con fiado
            </label>

            {hasData && (
              <div className="ml-auto flex gap-2">
                <Button
                  variant="secondary"
                  onClick={handleExportExcel}
                  disabled={exporting}
                  className="rounded-xl"
                >
                  <FileSpreadsheet size={16} className="text-success-700" />
                  {exporting ? 'Generando...' : 'Excel'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleExportPDF}
                  disabled={exporting}
                  className="rounded-xl"
                >
                  <FileText size={16} className="text-danger-700" />
                  {exporting ? 'Generando...' : 'PDF'}
                </Button>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {loading && (
        <Card>
          <CardBody>
            <TableSkeleton rows={6} columns={7} />
          </CardBody>
        </Card>
      )}

      {!loading && hasData && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeadCls}>
                  <th className={thCls}>Fecha</th>
                  <th className={thCls}>N°</th>
                  <th className={thCls}>Cliente</th>
                  <th className={`${thCls} text-right`}>Total</th>
                  <th className={thCls}>Método</th>
                  <th className={thCls}>Cajero</th>
                  <th className={`${thCls} text-right w-28`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => {
                  const cancelled = s.status === 'cancelled'
                  const isPrinting = printingId === s.id
                  const creditPortion = s.credit_portion ?? 0
                  return (
                    <tr
                      key={s.id}
                      className={`${trCls} ${cancelled ? 'opacity-60' : ''}`}
                      onClick={() => goToDetail(s.id)}
                    >
                      <td className={`${tdCls} text-text-muted tabular-nums`}>
                        {formatDateTime(s.created_at)}
                      </td>
                      <td className={`${tdCls} font-medium`}>#{s.id}</td>
                      <td className={tdCls}>
                        {s.customer_name || (
                          <span className="text-text-disabled">Consumidor final</span>
                        )}
                      </td>
                      <td
                        className={`${tdCls} text-right font-medium tabular-nums ${cancelled ? 'line-through' : ''}`}
                      >
                        {formatGs(s.total)}
                      </td>
                      <td className={tdCls}>
                        {cancelled ? (
                          <Badge tone="danger">Anulada</Badge>
                        ) : (
                          <Badge tone={methodTone[s.payment_method]}>{methodCellLabel(s)}</Badge>
                        )}
                        {!cancelled && s.payment_method === 'mixed' && creditPortion > 0 && (
                          <div className="text-[11px] text-warning-700 mt-1 tabular-nums">
                            Fiado {formatGs(creditPortion)}
                          </div>
                        )}
                      </td>
                      <td className={`${tdCls} text-text-muted`}>{s.user_name}</td>
                      <td className={`${tdCls} text-right`}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              goToDetail(s.id)
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-brand hover:bg-brand-light transition-colors"
                            title="Ver detalle"
                            aria-label={`Ver detalle de venta #${s.id}`}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openPrint(s.id)
                            }}
                            disabled={isPrinting}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-brand hover:bg-brand-light transition-colors disabled:opacity-40 disabled:cursor-wait"
                            title="Imprimir ticket"
                            aria-label={`Imprimir ticket de venta #${s.id}`}
                          >
                            <Printer size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-muted/40">
                  <td colSpan={3} className="px-4 py-3 font-medium text-text-muted">
                    Página actual: {data.length} de {total} ventas
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-brand tabular-nums">
                    {formatGs(
                      data.filter((v) => v.status !== 'cancelled').reduce((s, v) => s + v.total, 0)
                    )}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={onPageChange} />
        </Card>
      )}

      {showEmpty && (
        <Card>
          <CardBody>
            <EmptyState
              icon={<FileText size={40} />}
              title="Sin ventas en el período"
              description='Ajustá el rango de fechas y hacé click en "Consultar".'
            />
          </CardBody>
        </Card>
      )}

      {printSale && (
        <TicketPreviewModal
          sale={printSale}
          onClose={() => setPrintSale(null)}
          closeLabel="Cerrar"
        />
      )}
    </div>
  )
}
