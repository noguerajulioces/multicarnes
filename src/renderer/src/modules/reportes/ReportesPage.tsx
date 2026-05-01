import { useState } from 'react'
import { formatGs, formatDate, formatDateTime, todayStr } from '../../lib/utils'
import { exportToExcel, exportToPDF } from '../../lib/export'
import { TableSkeleton, EmptyState } from '../../components/ui'
import type { Sale } from '@shared/types'
import { FileSpreadsheet, FileText, TrendingUp, TrendingDown, Minus } from 'lucide-react'

type Tab = 'ventas' | 'resumen' | 'comparativo' | 'fiados' | 'productos' | 'margen' | 'stock' | 'caja'

interface ReportConfig {
  columns: { header: string; key: string; align?: 'left' | 'right' | 'center'; width?: number }[]
  title: string
  filename: string
}

interface PendingCreditRow {
  id: number
  name: string
  phone: string | null
  is_employee: number
  balance: number
  last_credit_sale_at: string | null
  last_payment_at: string | null
}

interface SalesSummaryResult {
  totals: { sales_count: number; total: number; discount: number; subtotal: number }
  byDay: { day: string; sales_count: number; total: number }[]
  byMethod: { method: string; sales_count: number; total: number }[]
  byUser: { user_id: number; user_name: string; sales_count: number; total: number }[]
}

interface SalesComparisonResult {
  current: { sales_count: number; total: number; discount: number; units: number; avg_ticket: number }
  previous: { sales_count: number; total: number; discount: number; units: number; avg_ticket: number }
  period: {
    current_from: string; current_to: string
    previous_from: string; previous_to: string
    length_days: number
  }
}

const methodLabels: Record<string, string> = {
  cash: 'Efectivo', credit: 'Fiado', transfer: 'Transferencia', mixed: 'Mixto'
}

const reportConfigs: Partial<Record<Tab, ReportConfig>> = {
  ventas: {
    title: 'Reporte de Ventas',
    filename: 'ventas',
    columns: [
      { header: 'Fecha', key: '_fecha', width: 18 },
      { header: 'N°', key: '_num', width: 8 },
      { header: 'Cliente', key: 'customer_name', width: 20 },
      { header: 'Total', key: '_total', align: 'right', width: 15 },
      { header: 'Método', key: '_method', width: 14 },
      { header: 'Cajero', key: 'user_name', width: 18 }
    ]
  },
  fiados: {
    title: 'Fiados Pendientes (CxC)',
    filename: 'fiados_pendientes',
    columns: [
      { header: 'Cliente', key: 'name', width: 25 },
      { header: 'Teléfono', key: '_phone', width: 16 },
      { header: 'Tipo', key: '_tipo', width: 12 },
      { header: 'Saldo deudor', key: '_debt', align: 'right', width: 16 },
      { header: 'Última venta a crédito', key: '_last_sale', width: 22 },
      { header: 'Último pago', key: '_last_pay', width: 22 }
    ]
  },
  productos: {
    title: 'Productos Más Vendidos',
    filename: 'productos_vendidos',
    columns: [
      { header: 'Producto', key: 'product_name', width: 25 },
      { header: 'Categoría', key: 'category_name', width: 15 },
      { header: 'Cant. Vendida', key: 'total_quantity', align: 'right', width: 14 },
      { header: 'Total Recaudado', key: '_revenue', align: 'right', width: 18 }
    ]
  },
  margen: {
    title: 'Margen de Ganancia',
    filename: 'margen_ganancia',
    columns: [
      { header: 'Producto', key: 'product_name', width: 25 },
      { header: 'P. Venta', key: '_sale_price', align: 'right', width: 15 },
      { header: 'Últ. Costo', key: '_last_cost', align: 'right', width: 15 },
      { header: 'Margen (Gs.)', key: '_margin', align: 'right', width: 15 },
      { header: 'Margen %', key: '_pct', align: 'right', width: 12 }
    ]
  },
  stock: {
    title: 'Movimientos de Stock',
    filename: 'mov_stock',
    columns: [
      { header: 'Fecha', key: '_fecha', width: 18 },
      { header: 'Producto', key: 'product_name', width: 22 },
      { header: 'Antes', key: 'quantity_before', align: 'right', width: 10 },
      { header: 'Después', key: 'quantity_after', align: 'right', width: 10 },
      { header: 'Motivo', key: 'reason', width: 22 },
      { header: 'Usuario', key: 'user_name', width: 16 }
    ]
  },
  caja: {
    title: 'Cierres de Caja',
    filename: 'cierres_caja',
    columns: [
      { header: 'Apertura', key: '_opened', width: 18 },
      { header: 'Cierre', key: '_closed', width: 18 },
      { header: 'Cajero', key: 'user_name', width: 18 },
      { header: 'Esperado', key: '_expected', align: 'right', width: 15 },
      { header: 'Contado', key: '_closing', align: 'right', width: 15 },
      { header: 'Diferencia', key: '_diff', align: 'right', width: 15 }
    ]
  }
}

function prepareExportData(tab: Tab, data: unknown[]): Record<string, unknown>[] {
  switch (tab) {
    case 'ventas':
      return (data as Sale[]).map((s) => ({
        ...s,
        _fecha: formatDateTime(s.created_at),
        _num: `#${s.id}`,
        customer_name: s.customer_name || '-',
        _total: formatGs(s.total),
        _method: methodLabels[s.payment_method] || s.payment_method
      }))
    case 'fiados':
      return (data as PendingCreditRow[]).map((r) => ({
        ...r,
        _phone: r.phone || '-',
        _tipo: r.is_employee ? 'Empleado' : 'Cliente',
        _debt: formatGs(Math.abs(r.balance)),
        _last_sale: r.last_credit_sale_at ? formatDateTime(r.last_credit_sale_at) : '-',
        _last_pay: r.last_payment_at ? formatDateTime(r.last_payment_at) : '-'
      }))
    case 'productos':
      return (data as { product_name: string; category_name: string; total_quantity: number; total_revenue: number }[]).map((r) => ({
        ...r,
        category_name: r.category_name || '-',
        _revenue: formatGs(r.total_revenue)
      }))
    case 'margen':
      return (data as { product_name: string; sale_price: number; last_cost: number | null }[]).map((r) => {
        const margin = r.last_cost ? r.sale_price - r.last_cost : null
        const pct = margin && r.last_cost ? ((margin / r.last_cost) * 100).toFixed(1) + '%' : '-'
        return {
          ...r,
          _sale_price: formatGs(r.sale_price),
          _last_cost: r.last_cost ? formatGs(r.last_cost) : '-',
          _margin: margin ? formatGs(margin) : '-',
          _pct: pct
        }
      })
    case 'stock':
      return (data as { created_at: string; product_name: string; quantity_before: number; quantity_after: number; reason: string; user_name: string }[]).map((r) => ({
        ...r,
        _fecha: formatDateTime(r.created_at)
      }))
    case 'caja':
      return (data as { opened_at: string; closed_at: string; user_name: string; expected_amount: number; closing_amount: number; difference: number }[]).map((r) => ({
        ...r,
        _opened: formatDateTime(r.opened_at),
        _closed: formatDateTime(r.closed_at),
        _expected: formatGs(r.expected_amount),
        _closing: formatGs(r.closing_amount),
        _diff: `${r.difference >= 0 ? '+' : ''}${formatGs(r.difference)}`
      }))
    default:
      return data as Record<string, unknown>[]
  }
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

function VariationBadge({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-text-muted">
        <Minus size={12} /> N/A
      </span>
    )
  }
  const isUp = pct > 0
  const isFlat = pct === 0
  const positive = invert ? !isUp : isUp
  const color = isFlat ? 'text-text-muted' : positive ? 'text-green-600' : 'text-red-600'
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon size={12} />
      {isUp ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

export default function ReportesPage() {
  const [tab, setTab] = useState<Tab>('ventas')
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(todayStr())
  const [data, setData] = useState<unknown[]>([])
  const [summary, setSummary] = useState<SalesSummaryResult | null>(null)
  const [comparison, setComparison] = useState<SalesComparisonResult | null>(null)
  const [loading, setLoading] = useState(false)

  const needsDateRange = tab !== 'margen' && tab !== 'caja' && tab !== 'fiados'

  const load = async () => {
    setLoading(true)
    try {
      if (tab === 'ventas') {
        setData(await window.api.reports.salesByPeriod(from, to))
      } else if (tab === 'resumen') {
        setSummary(await window.api.reports.salesSummary(from, to))
      } else if (tab === 'comparativo') {
        setComparison(await window.api.reports.salesComparison(from, to))
      } else if (tab === 'fiados') {
        setData(await window.api.reports.pendingCredits())
      } else if (tab === 'productos') {
        setData(await window.api.reports.topProducts(from, to))
      } else if (tab === 'margen') {
        setData(await window.api.reports.profitMargin())
      } else if (tab === 'stock') {
        setData(await window.api.reports.stockMovements(from, to))
      } else if (tab === 'caja') {
        setData(await window.api.reports.cashRegisters())
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  const handleExportExcel = () => {
    const config = reportConfigs[tab]
    if (!config) return
    const exportData = prepareExportData(tab, data)
    const dateRange = needsDateRange ? ` (${from} a ${to})` : ''
    exportToExcel(exportData, config.columns, `${config.filename}_${from}_${to}`, `${config.title}${dateRange}`)
  }

  const handleExportPDF = () => {
    const config = reportConfigs[tab]
    if (!config) return
    const exportData = prepareExportData(tab, data)
    const dateRange = needsDateRange ? ` (${from} a ${to})` : ''
    exportToPDF(exportData, config.columns, `${config.filename}_${from}_${to}`, `${config.title}${dateRange}`)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ventas', label: 'Ventas' },
    { key: 'resumen', label: 'Resumen' },
    { key: 'comparativo', label: 'Comparativo' },
    { key: 'fiados', label: 'Fiados pendientes' },
    { key: 'productos', label: 'Más Vendidos' },
    { key: 'margen', label: 'Margen' },
    { key: 'stock', label: 'Mov. Stock' },
    { key: 'caja', label: 'Cierres Caja' }
  ]

  const exportableTabHasData = reportConfigs[tab] && data.length > 0
  const isObjectTab = tab === 'resumen' || tab === 'comparativo'
  const objectTabHasData = (tab === 'resumen' && summary) || (tab === 'comparativo' && comparison)
  const showEmpty = !loading && !isObjectTab && data.length === 0

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reportes</h1>

      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setData([]); setSummary(null); setComparison(null) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t.key ? 'bg-brand text-white' : 'bg-surface border hover:bg-surface-muted'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mb-4 items-end flex-wrap">
        {needsDateRange && (
          <>
            <div>
              <label className="block text-xs text-text-muted mb-1">Desde</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Hasta</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm" />
            </div>
          </>
        )}
        <button onClick={load} disabled={loading}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-hover disabled:opacity-50">
          {loading ? 'Cargando...' : 'Consultar'}
        </button>

        {exportableTabHasData && (
          <>
            <button onClick={handleExportExcel}
              className="flex items-center gap-1.5 border border-green-600 text-green-700 px-4 py-2 rounded-lg text-sm hover:bg-green-50">
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button onClick={handleExportPDF}
              className="flex items-center gap-1.5 border border-red-600 text-red-700 px-4 py-2 rounded-lg text-sm hover:bg-red-50">
              <FileText size={16} /> PDF
            </button>
          </>
        )}
      </div>

      <div className="bg-surface rounded-lg shadow-sm overflow-hidden">
        {loading && (
          <div className="p-3">
            <TableSkeleton rows={6} columns={6} />
          </div>
        )}

        {!loading && tab === 'ventas' && (
          <table className="w-full text-sm">
            <thead><tr className="bg-bg-secondary text-left text-text-muted">
              <th className="p-3">Fecha</th><th className="p-3">N°</th><th className="p-3">Cliente</th>
              <th className="p-3 text-right">Total</th><th className="p-3">Método</th><th className="p-3">Cajero</th>
            </tr></thead>
            <tbody>
              {(data as Sale[]).map((s) => (
                <tr key={s.id} className="border-b"><td className="p-3">{formatDateTime(s.created_at)}</td>
                  <td className="p-3">#{s.id}</td><td className="p-3">{s.customer_name || '-'}</td>
                  <td className="p-3 text-right font-medium">{formatGs(s.total)}</td>
                  <td className="p-3 capitalize">{methodLabels[s.payment_method] || s.payment_method}</td>
                  <td className="p-3">{s.user_name}</td></tr>
              ))}
            </tbody>
            {data.length > 0 && (
              <tfoot><tr className="font-bold"><td colSpan={3} className="p-3">Total: {data.length} ventas</td>
                <td className="p-3 text-right">{formatGs((data as Sale[]).reduce((s, v) => s + v.total, 0))}</td>
                <td colSpan={2}></td></tr></tfoot>
            )}
          </table>
        )}

        {!loading && tab === 'resumen' && summary && (
          <div className="p-4 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border rounded-lg p-3">
                <div className="text-xs text-text-muted">Tickets</div>
                <div className="text-xl font-bold mt-1">{summary.totals.sales_count}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-text-muted">Subtotal</div>
                <div className="text-xl font-bold mt-1">{formatGs(summary.totals.subtotal)}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-text-muted">Descuentos</div>
                <div className="text-xl font-bold mt-1">{formatGs(summary.totals.discount)}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-text-muted">Total</div>
                <div className="text-xl font-bold mt-1 text-brand">{formatGs(summary.totals.total)}</div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Por día</h3>
              <table className="w-full text-sm border rounded-lg overflow-hidden">
                <thead><tr className="bg-bg-secondary text-left text-text-muted">
                  <th className="p-3">Fecha</th>
                  <th className="p-3 text-right">Tickets</th>
                  <th className="p-3 text-right">Total</th>
                </tr></thead>
                <tbody>
                  {summary.byDay.map((r) => (
                    <tr key={r.day} className="border-b">
                      <td className="p-3">{formatDate(r.day)}</td>
                      <td className="p-3 text-right">{r.sales_count}</td>
                      <td className="p-3 text-right font-medium">{formatGs(r.total)}</td>
                    </tr>
                  ))}
                  {summary.byDay.length === 0 && (
                    <tr><td colSpan={3} className="p-3 text-center text-text-muted">Sin ventas en el período</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold mb-2">Por método de pago</h3>
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead><tr className="bg-bg-secondary text-left text-text-muted">
                    <th className="p-3">Método</th>
                    <th className="p-3 text-right">Tickets</th>
                    <th className="p-3 text-right">Total</th>
                  </tr></thead>
                  <tbody>
                    {summary.byMethod.map((r) => (
                      <tr key={r.method} className="border-b">
                        <td className="p-3">{methodLabels[r.method] || r.method}</td>
                        <td className="p-3 text-right">{r.sales_count}</td>
                        <td className="p-3 text-right font-medium">{formatGs(r.total)}</td>
                      </tr>
                    ))}
                    {summary.byMethod.length === 0 && (
                      <tr><td colSpan={3} className="p-3 text-center text-text-muted">Sin datos</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Por cajero</h3>
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead><tr className="bg-bg-secondary text-left text-text-muted">
                    <th className="p-3">Cajero</th>
                    <th className="p-3 text-right">Tickets</th>
                    <th className="p-3 text-right">Total</th>
                  </tr></thead>
                  <tbody>
                    {summary.byUser.map((r) => (
                      <tr key={r.user_id} className="border-b">
                        <td className="p-3">{r.user_name || '-'}</td>
                        <td className="p-3 text-right">{r.sales_count}</td>
                        <td className="p-3 text-right font-medium">{formatGs(r.total)}</td>
                      </tr>
                    ))}
                    {summary.byUser.length === 0 && (
                      <tr><td colSpan={3} className="p-3 text-center text-text-muted">Sin datos</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!loading && tab === 'comparativo' && comparison && (
          <div className="p-4 space-y-4">
            <div className="text-xs text-text-muted">
              Período actual: <span className="font-medium text-text">{formatDate(comparison.period.current_from)} – {formatDate(comparison.period.current_to)}</span>
              {' · '}
              Período anterior: <span className="font-medium text-text">{formatDate(comparison.period.previous_from)} – {formatDate(comparison.period.previous_to)}</span>
              {' · '}
              <span>{comparison.period.length_days} días</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: 'Ventas totales', cur: comparison.current.total, prev: comparison.previous.total, money: true },
                { label: 'Tickets', cur: comparison.current.sales_count, prev: comparison.previous.sales_count, money: false },
                { label: 'Ticket promedio', cur: comparison.current.avg_ticket, prev: comparison.previous.avg_ticket, money: true },
                { label: 'Unidades vendidas', cur: comparison.current.units, prev: comparison.previous.units, money: false },
                { label: 'Descuentos', cur: comparison.current.discount, prev: comparison.previous.discount, money: true, invert: true }
              ].map((m) => (
                <div key={m.label} className="border rounded-lg p-3">
                  <div className="text-xs text-text-muted">{m.label}</div>
                  <div className="text-lg font-bold mt-1">
                    {m.money ? formatGs(m.cur) : m.cur.toLocaleString('es-PY')}
                  </div>
                  <div className="text-xs text-text-muted mt-1">
                    Anterior: {m.money ? formatGs(m.prev) : m.prev.toLocaleString('es-PY')}
                  </div>
                  <div className="mt-1.5">
                    <VariationBadge pct={pctChange(m.cur, m.prev)} invert={m.invert} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && tab === 'fiados' && (
          <table className="w-full text-sm">
            <thead><tr className="bg-bg-secondary text-left text-text-muted">
              <th className="p-3">Cliente</th>
              <th className="p-3">Teléfono</th>
              <th className="p-3">Tipo</th>
              <th className="p-3 text-right">Saldo deudor</th>
              <th className="p-3">Última venta a crédito</th>
              <th className="p-3">Último pago</th>
            </tr></thead>
            <tbody>
              {(data as PendingCreditRow[]).map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 text-text-muted">{r.phone || '-'}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${r.is_employee ? 'bg-blue-100 text-blue-700' : 'bg-surface-muted text-text-muted'}`}>
                      {r.is_employee ? 'Empleado' : 'Cliente'}
                    </span>
                  </td>
                  <td className="p-3 text-right font-medium text-red-600">{formatGs(Math.abs(r.balance))}</td>
                  <td className="p-3">{r.last_credit_sale_at ? formatDateTime(r.last_credit_sale_at) : '-'}</td>
                  <td className="p-3">{r.last_payment_at ? formatDateTime(r.last_payment_at) : '-'}</td>
                </tr>
              ))}
            </tbody>
            {data.length > 0 && (
              <tfoot><tr className="font-bold">
                <td colSpan={3} className="p-3">Total: {data.length} clientes con saldo</td>
                <td className="p-3 text-right text-red-600">
                  {formatGs((data as PendingCreditRow[]).reduce((s, v) => s + Math.abs(v.balance), 0))}
                </td>
                <td colSpan={2}></td>
              </tr></tfoot>
            )}
          </table>
        )}

        {!loading && tab === 'productos' && (
          <table className="w-full text-sm">
            <thead><tr className="bg-bg-secondary text-left text-text-muted">
              <th className="p-3">Producto</th><th className="p-3">Categoría</th>
              <th className="p-3 text-right">Cant. Vendida</th><th className="p-3 text-right">Total</th>
            </tr></thead>
            <tbody>
              {(data as { product_name: string; category_name: string; total_quantity: number; total_revenue: number }[]).map((r, i) => (
                <tr key={i} className="border-b"><td className="p-3 font-medium">{r.product_name}</td>
                  <td className="p-3 text-text-muted">{r.category_name || '-'}</td>
                  <td className="p-3 text-right">{r.total_quantity}</td>
                  <td className="p-3 text-right">{formatGs(r.total_revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && tab === 'margen' && (
          <table className="w-full text-sm">
            <thead><tr className="bg-bg-secondary text-left text-text-muted">
              <th className="p-3">Producto</th><th className="p-3 text-right">P. Venta</th>
              <th className="p-3 text-right">Últ. Costo</th><th className="p-3 text-right">Margen</th><th className="p-3 text-right">%</th>
            </tr></thead>
            <tbody>
              {(data as { product_name: string; sale_price: number; last_cost: number | null }[]).map((r, i) => {
                const margin = r.last_cost ? r.sale_price - r.last_cost : null
                const pct = margin && r.last_cost ? ((margin / r.last_cost) * 100).toFixed(1) : '-'
                return (
                  <tr key={i} className="border-b"><td className="p-3 font-medium">{r.product_name}</td>
                    <td className="p-3 text-right">{formatGs(r.sale_price)}</td>
                    <td className="p-3 text-right">{r.last_cost ? formatGs(r.last_cost) : '-'}</td>
                    <td className="p-3 text-right">{margin ? formatGs(margin) : '-'}</td>
                    <td className="p-3 text-right">{pct}%</td></tr>
                )
              })}
            </tbody>
          </table>
        )}

        {!loading && tab === 'stock' && (
          <table className="w-full text-sm">
            <thead><tr className="bg-bg-secondary text-left text-text-muted">
              <th className="p-3">Fecha</th><th className="p-3">Producto</th><th className="p-3 text-right">Antes</th>
              <th className="p-3 text-right">Después</th><th className="p-3">Motivo</th><th className="p-3">Usuario</th>
            </tr></thead>
            <tbody>
              {(data as { created_at: string; product_name: string; quantity_before: number; quantity_after: number; reason: string; user_name: string }[]).map((r, i) => (
                <tr key={i} className="border-b"><td className="p-3">{formatDateTime(r.created_at)}</td>
                  <td className="p-3">{r.product_name}</td><td className="p-3 text-right">{r.quantity_before}</td>
                  <td className="p-3 text-right">{r.quantity_after}</td><td className="p-3">{r.reason}</td>
                  <td className="p-3">{r.user_name}</td></tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && tab === 'caja' && (
          <table className="w-full text-sm">
            <thead><tr className="bg-bg-secondary text-left text-text-muted">
              <th className="p-3">Apertura</th><th className="p-3">Cierre</th><th className="p-3">Cajero</th>
              <th className="p-3 text-right">Esperado</th><th className="p-3 text-right">Contado</th><th className="p-3 text-right">Diferencia</th>
            </tr></thead>
            <tbody>
              {(data as { opened_at: string; closed_at: string; user_name: string; expected_amount: number; closing_amount: number; difference: number }[]).map((r, i) => (
                <tr key={i} className="border-b"><td className="p-3">{formatDateTime(r.opened_at)}</td>
                  <td className="p-3">{formatDateTime(r.closed_at)}</td><td className="p-3">{r.user_name}</td>
                  <td className="p-3 text-right">{formatGs(r.expected_amount)}</td>
                  <td className="p-3 text-right">{formatGs(r.closing_amount)}</td>
                  <td className={`p-3 text-right font-medium ${r.difference < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {r.difference >= 0 ? '+' : ''}{formatGs(r.difference)}
                  </td></tr>
              ))}
            </tbody>
          </table>
        )}

        {showEmpty && (
          <EmptyState
            icon={<FileText size={40} />}
            title="Sin datos"
            description={tab === 'fiados'
              ? 'No hay clientes con saldo deudor. Hacé click en "Consultar".'
              : 'Seleccione un rango de fechas y haga click en "Consultar" para ver el reporte.'}
          />
        )}

        {!loading && isObjectTab && !objectTabHasData && (
          <EmptyState
            icon={<FileText size={40} />}
            title="Sin datos"
            description='Seleccione un rango de fechas y haga click en "Consultar" para ver el reporte.'
          />
        )}
      </div>
    </div>
  )
}
