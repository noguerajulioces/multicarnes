import { useState } from 'react'
import { formatGs, formatDateTime, todayStr } from '../../lib/utils'
import type { Sale } from '@shared/types'

type Tab = 'ventas' | 'productos' | 'margen' | 'stock' | 'caja'

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
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t.key ? 'bg-brand text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'margen' && (
        <div className="flex gap-3 mb-4 items-end">
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
          <button onClick={load} disabled={loading}
            className="bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-hover disabled:opacity-50">
            {loading ? 'Cargando...' : 'Consultar'}
          </button>
        </div>
      )}

      {tab === 'margen' && (
        <button onClick={load} disabled={loading}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-hover disabled:opacity-50 mb-4">
          {loading ? 'Cargando...' : 'Consultar'}
        </button>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {tab === 'ventas' && (
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

        {tab === 'productos' && (
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

        {tab === 'margen' && (
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

        {tab === 'stock' && (
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

        {tab === 'caja' && (
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
          <p className="p-8 text-center text-text-muted">Sin datos. Haga click en "Consultar" para cargar.</p>
        )}
      </div>
    </div>
  )
}
