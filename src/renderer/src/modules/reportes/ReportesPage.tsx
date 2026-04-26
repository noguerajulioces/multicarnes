import { useState } from 'react'
import { formatGs, formatDateTime, todayStr } from '../../lib/utils'
import { exportToExcel, exportToPDF } from '../../lib/export'
import { TableSkeleton, EmptyState } from '../../components/ui'
import type { Sale } from '@shared/types'
import { FileSpreadsheet, FileText } from 'lucide-react'

type Tab = 'ventas' | 'productos' | 'margen' | 'stock' | 'caja'

interface ReportConfig {
  columns: { header: string; key: string; align?: 'left' | 'right' | 'center'; width?: number }[]
  title: string
  filename: string
}

const reportConfigs: Record<Tab, ReportConfig> = {
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
  const methodLabels: Record<string, string> = {
    cash: 'Efectivo', credit: 'Fiado', transfer: 'Transferencia', mixed: 'Mixto'
  }

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

export default function ReportesPage() {
  const [tab, setTab] = useState<Tab>('ventas')
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(todayStr())
  const [data, setData] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      if (tab === 'ventas') {
        setData(await window.api.reports.salesByPeriod(from, to))
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
    const exportData = prepareExportData(tab, data)
    const dateRange = tab !== 'margen' ? ` (${from} a ${to})` : ''
    exportToExcel(exportData, config.columns, `${config.filename}_${from}_${to}`, `${config.title}${dateRange}`)
  }

  const handleExportPDF = () => {
    const config = reportConfigs[tab]
    const exportData = prepareExportData(tab, data)
    const dateRange = tab !== 'margen' ? ` (${from} a ${to})` : ''
    exportToPDF(exportData, config.columns, `${config.filename}_${from}_${to}`, `${config.title}${dateRange}`)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ventas', label: 'Ventas' },
    { key: 'productos', label: 'Más Vendidos' },
    { key: 'margen', label: 'Margen' },
    { key: 'stock', label: 'Mov. Stock' },
    { key: 'caja', label: 'Cierres Caja' }
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reportes</h1>

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setData([]) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t.key ? 'bg-brand text-white' : 'bg-surface border hover:bg-surface-muted'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mb-4 items-end flex-wrap">
        {tab !== 'margen' && (
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

        {data.length > 0 && (
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
                  <td className="p-3 capitalize">{s.payment_method}</td>
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

        {data.length === 0 && !loading && (
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
