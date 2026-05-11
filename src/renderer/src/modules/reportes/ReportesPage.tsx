import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  formatGs,
  formatDate,
  formatDateTime,
  todayStr,
  firstDayOfMonthStr,
  cn
} from '../../lib/utils'
import { exportToExcel, exportToPDF } from '../../lib/export'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  KpiCard,
  PageHeader,
  TableSkeleton,
  TourButton
} from '../../components/ui'
import { usePageTour } from '../../lib/use-page-tour'
import { reportesTourSteps } from '../../lib/tour-steps'
import { handleApiError } from '../../lib/api-error'
import type { PaymentMethod } from '@shared/types'
import {
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Receipt,
  CreditCard,
  Tag,
  DollarSign,
  Search
} from 'lucide-react'

type Tab = 'resumen' | 'comparativo' | 'fiados' | 'productos' | 'margen' | 'stock' | 'caja'

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
  current: {
    sales_count: number
    total: number
    discount: number
    units: number
    avg_ticket: number
  }
  previous: {
    sales_count: number
    total: number
    discount: number
    units: number
    avg_ticket: number
  }
  period: {
    current_from: string
    current_to: string
    previous_from: string
    previous_to: string
    length_days: number
  }
}

const methodLabels: Record<string, string> = {
  cash: 'Efectivo',
  credit: 'Fiado',
  transfer: 'Transferencia',
  mixed: 'Mixto'
}

const methodTone: Record<PaymentMethod, 'success' | 'warning' | 'info' | 'neutral'> = {
  cash: 'success',
  credit: 'warning',
  transfer: 'info',
  mixed: 'neutral'
}

const reportConfigs: Partial<Record<Tab, ReportConfig>> = {
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
      return (
        data as {
          product_name: string
          category_name: string
          total_quantity: number
          total_revenue: number
        }[]
      ).map((r) => ({
        ...r,
        category_name: r.category_name || '-',
        _revenue: formatGs(r.total_revenue)
      }))
    case 'margen':
      return (data as { product_name: string; sale_price: number; last_cost: number | null }[]).map(
        (r) => {
          const margin = r.last_cost ? r.sale_price - r.last_cost : null
          const pct = margin && r.last_cost ? ((margin / r.last_cost) * 100).toFixed(1) + '%' : '-'
          return {
            ...r,
            _sale_price: formatGs(r.sale_price),
            _last_cost: r.last_cost ? formatGs(r.last_cost) : '-',
            _margin: margin ? formatGs(margin) : '-',
            _pct: pct
          }
        }
      )
    case 'stock':
      return (
        data as {
          created_at: string
          product_name: string
          quantity_before: number
          quantity_after: number
          reason: string
          user_name: string
        }[]
      ).map((r) => ({
        ...r,
        _fecha: formatDateTime(r.created_at)
      }))
    case 'caja':
      return (
        data as {
          opened_at: string
          closed_at: string
          user_name: string
          expected_amount: number
          closing_amount: number
          difference: number
        }[]
      ).map((r) => ({
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

function VariationBadge({
  pct,
  invert = false
}: {
  pct: number | null
  invert?: boolean
}): React.ReactElement {
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
  const color = isFlat ? 'text-text-muted' : positive ? 'text-success-700' : 'text-danger-700'
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon size={12} />
      {isUp ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  )
}

const tableHeadCls = 'bg-surface-muted/60 text-left text-text-muted'
const thCls = 'px-4 py-3 font-medium'
const trCls = 'border-t border-border hover:bg-surface-muted/40 transition-colors'
const tdCls = 'px-4 py-3'

const VALID_TABS: readonly Tab[] = [
  'resumen',
  'comparativo',
  'fiados',
  'productos',
  'margen',
  'stock',
  'caja'
]

function parseTabParam(raw: string | null): Tab | null {
  if (!raw) return null
  // 003-cash-movements-history US4 (T032): accept 'cierres' as an alias of
  // 'caja' for callers that don't know the internal tab key.
  if (raw === 'cierres') return 'caja'
  return (VALID_TABS as readonly string[]).includes(raw) ? (raw as Tab) : null
}

export default function ReportesPage() {
  const [searchParams] = useSearchParams()
  const initialTab = parseTabParam(searchParams.get('tab')) ?? 'resumen'
  const [tab, setTab] = useState<Tab>(initialTab)
  // US4 (T032): when arriving from /movimientos-caja, scroll to the matching
  // register row after the data loads. Stored once and consumed on first match.
  const [highlightRegisterId, setHighlightRegisterId] = useState<number | null>(() => {
    const raw = searchParams.get('registerId')
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  })
  const [from, setFrom] = useState(firstDayOfMonthStr())
  const [to, setTo] = useState(todayStr())
  const [data, setData] = useState<unknown[]>([])
  const [summary, setSummary] = useState<SalesSummaryResult | null>(null)
  const [comparison, setComparison] = useState<SalesComparisonResult | null>(null)
  const [loading, setLoading] = useState(false)

  // US4 (T032): when arriving with ?registerId=X, scroll to the matching
  // row in the Cierres Caja tab once data loads, then clear the highlight
  // sentinel after a moment so subsequent navigations don't re-trigger.
  useEffect(() => {
    if (highlightRegisterId == null || tab !== 'caja' || loading) return
    const el = document.getElementById(`register-row-${highlightRegisterId}`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const t = window.setTimeout(() => setHighlightRegisterId(null), 4000)
    return () => window.clearTimeout(t)
  }, [highlightRegisterId, tab, loading, data])

  const needsDateRange = tab !== 'margen' && tab !== 'caja' && tab !== 'fiados'

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      if (tab === 'resumen') {
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
    } catch (err) {
      handleApiError(err)
    }
    setLoading(false)
  }

  // Auto-cargar al cambiar de tab (y al montar). Las fechas siguen requiriendo
  // click manual en "Consultar" para evitar fetches dobles cuando se ajustan ambas.
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const handleExportExcel = (): void => {
    const config = reportConfigs[tab]
    if (!config) return
    const exportData = prepareExportData(tab, data)
    const dateRange = needsDateRange ? ` (${from} a ${to})` : ''
    exportToExcel(
      exportData,
      config.columns,
      `${config.filename}_${from}_${to}`,
      `${config.title}${dateRange}`
    )
  }

  const handleExportPDF = (): void => {
    const config = reportConfigs[tab]
    if (!config) return
    const exportData = prepareExportData(tab, data)
    const dateRange = needsDateRange ? ` (${from} a ${to})` : ''
    exportToPDF(
      exportData,
      config.columns,
      `${config.filename}_${from}_${to}`,
      `${config.title}${dateRange}`
    )
  }

  const tabs: { key: Tab; label: string }[] = [
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

  const { startTour } = usePageTour({ key: 'reportes', steps: reportesTourSteps })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reportes"
        subtitle="Analizá métricas, créditos, márgenes y movimientos del negocio"
        actions={<TourButton onClick={startTour} />}
      />

      <div data-tour="reportes-tabs" className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key)
              setData([])
              setSummary(null)
              setComparison(null)
            }}
            className={cn(
              'px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors',
              tab === t.key
                ? 'bg-brand text-white border-brand shadow-sm'
                : 'bg-surface text-text-main border-border hover:bg-surface-muted'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card
        data-tour="reportes-filters"
        className="rounded-2xl"
        style={{ boxShadow: 'var(--shadow-card-soft)' }}
      >
        <CardBody className="space-y-4">
          <div className="flex gap-3 items-end flex-wrap">
            {needsDateRange && (
              <>
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
              </>
            )}
            <Button onClick={load} disabled={loading} className="rounded-xl">
              <Search size={16} />
              {loading ? 'Cargando...' : 'Consultar'}
            </Button>

            {exportableTabHasData && (
              <div className="ml-auto flex gap-2">
                <Button variant="secondary" onClick={handleExportExcel} className="rounded-xl">
                  <FileSpreadsheet size={16} className="text-success-700" />
                  Excel
                </Button>
                <Button variant="secondary" onClick={handleExportPDF} className="rounded-xl">
                  <FileText size={16} className="text-danger-700" />
                  PDF
                </Button>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {loading && (
        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
          <CardBody>
            <TableSkeleton rows={6} columns={6} />
          </CardBody>
        </Card>
      )}

      {!loading && tab === 'resumen' && summary && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              gradient="blue"
              icon={<Receipt size={20} />}
              label="Tickets"
              value={summary.totals.sales_count.toLocaleString('es-PY')}
              hint="ventas en el período"
            />
            <KpiCard
              gradient="teal"
              icon={<CreditCard size={20} />}
              label="Subtotal"
              value={formatGs(summary.totals.subtotal)}
              hint="antes de descuentos"
            />
            <KpiCard
              gradient="purple"
              icon={<Tag size={20} />}
              label="Descuentos"
              value={formatGs(summary.totals.discount)}
              hint="aplicados"
            />
            <KpiCard
              gradient="green"
              icon={<DollarSign size={20} />}
              label="Total"
              value={formatGs(summary.totals.total)}
              hint="recaudado"
            />
          </div>

          <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
            <CardHeader>
              <h2 className="font-semibold text-text-main">Por día</h2>
            </CardHeader>
            <CardBody className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-muted">
                    <th className="pb-2 font-normal pr-3">Fecha</th>
                    <th className="pb-2 font-normal pr-3 text-right">Tickets</th>
                    <th className="pb-2 font-normal text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byDay.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-text-muted">
                        Sin ventas en el período
                      </td>
                    </tr>
                  ) : (
                    summary.byDay.map((r) => (
                      <tr key={r.day} className="border-b border-border last:border-0">
                        <td className="py-2.5 pr-3 text-text-muted tabular-nums">
                          {formatDate(r.day)}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{r.sales_count}</td>
                        <td className="py-2.5 text-right font-medium tabular-nums">
                          {formatGs(r.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
              <CardHeader>
                <h2 className="font-semibold text-text-main">Por método de pago</h2>
              </CardHeader>
              <CardBody className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-text-muted">
                      <th className="pb-2 font-normal pr-3">Método</th>
                      <th className="pb-2 font-normal pr-3 text-right">Tickets</th>
                      <th className="pb-2 font-normal text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byMethod.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-text-muted">
                          Sin datos
                        </td>
                      </tr>
                    ) : (
                      summary.byMethod.map((r) => (
                        <tr key={r.method} className="border-b border-border last:border-0">
                          <td className="py-2.5 pr-3">
                            <Badge tone={methodTone[r.method as PaymentMethod] ?? 'neutral'}>
                              {methodLabels[r.method] || r.method}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">{r.sales_count}</td>
                          <td className="py-2.5 text-right font-medium tabular-nums">
                            {formatGs(r.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardBody>
            </Card>

            <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
              <CardHeader>
                <h2 className="font-semibold text-text-main">Por cajero</h2>
              </CardHeader>
              <CardBody className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-text-muted">
                      <th className="pb-2 font-normal pr-3">Cajero</th>
                      <th className="pb-2 font-normal pr-3 text-right">Tickets</th>
                      <th className="pb-2 font-normal text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byUser.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-text-muted">
                          Sin datos
                        </td>
                      </tr>
                    ) : (
                      summary.byUser.map((r) => (
                        <tr key={r.user_id} className="border-b border-border last:border-0">
                          <td className="py-2.5 pr-3 font-medium">{r.user_name || '—'}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">{r.sales_count}</td>
                          <td className="py-2.5 text-right font-medium tabular-nums">
                            {formatGs(r.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {!loading && tab === 'comparativo' && comparison && (
        <div className="space-y-4">
          <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
            <CardBody className="text-xs text-text-muted">
              <span>
                Período actual:{' '}
                <span className="font-medium text-text-main tabular-nums">
                  {formatDate(comparison.period.current_from)} –{' '}
                  {formatDate(comparison.period.current_to)}
                </span>
              </span>
              <span className="mx-2">·</span>
              <span>
                Anterior:{' '}
                <span className="font-medium text-text-main tabular-nums">
                  {formatDate(comparison.period.previous_from)} –{' '}
                  {formatDate(comparison.period.previous_to)}
                </span>
              </span>
              <span className="mx-2">·</span>
              <span className="font-medium text-text-main">
                {comparison.period.length_days} días
              </span>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {[
              {
                label: 'Ventas totales',
                cur: comparison.current.total,
                prev: comparison.previous.total,
                money: true
              },
              {
                label: 'Tickets',
                cur: comparison.current.sales_count,
                prev: comparison.previous.sales_count,
                money: false
              },
              {
                label: 'Ticket promedio',
                cur: comparison.current.avg_ticket,
                prev: comparison.previous.avg_ticket,
                money: true
              },
              {
                label: 'Unidades vendidas',
                cur: comparison.current.units,
                prev: comparison.previous.units,
                money: false
              },
              {
                label: 'Descuentos',
                cur: comparison.current.discount,
                prev: comparison.previous.discount,
                money: true,
                invert: true
              }
            ].map((m) => (
              <div
                key={m.label}
                className="bg-surface rounded-2xl border border-border p-4"
                style={{ boxShadow: 'var(--shadow-card-soft)' }}
              >
                <div className="text-xs text-text-muted">{m.label}</div>
                <div className="text-xl font-bold mt-1 tabular-nums text-text-main">
                  {m.money ? formatGs(m.cur) : m.cur.toLocaleString('es-PY')}
                </div>
                <div className="text-xs text-text-muted mt-1.5 tabular-nums">
                  Anterior:{' '}
                  <span className="text-text-main">
                    {m.money ? formatGs(m.prev) : m.prev.toLocaleString('es-PY')}
                  </span>
                </div>
                <div className="mt-2">
                  <VariationBadge pct={pctChange(m.cur, m.prev)} invert={m.invert} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && tab === 'fiados' && (
        <Card
          className="rounded-2xl overflow-hidden"
          style={{ boxShadow: 'var(--shadow-card-soft)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeadCls}>
                  <th className={thCls}>Cliente</th>
                  <th className={thCls}>Teléfono</th>
                  <th className={thCls}>Tipo</th>
                  <th className={`${thCls} text-right`}>Saldo deudor</th>
                  <th className={thCls}>Última venta a crédito</th>
                  <th className={thCls}>Último pago</th>
                </tr>
              </thead>
              <tbody>
                {(data as PendingCreditRow[]).map((r) => (
                  <tr key={r.id} className={trCls}>
                    <td className={`${tdCls} font-medium`}>{r.name}</td>
                    <td className={`${tdCls} text-text-muted`}>
                      {r.phone || <span className="text-text-disabled">—</span>}
                    </td>
                    <td className={tdCls}>
                      {r.is_employee ? <Badge tone="info">Empleado</Badge> : <Badge>Cliente</Badge>}
                    </td>
                    <td className={`${tdCls} text-right font-medium text-danger-700 tabular-nums`}>
                      {formatGs(Math.abs(r.balance))}
                    </td>
                    <td className={`${tdCls} text-text-muted tabular-nums`}>
                      {r.last_credit_sale_at ? (
                        formatDateTime(r.last_credit_sale_at)
                      ) : (
                        <span className="text-text-disabled">—</span>
                      )}
                    </td>
                    <td className={`${tdCls} text-text-muted tabular-nums`}>
                      {r.last_payment_at ? (
                        formatDateTime(r.last_payment_at)
                      ) : (
                        <span className="text-text-disabled">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {data.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-surface-muted/40">
                    <td colSpan={3} className="px-4 py-3 font-medium text-text-muted">
                      Total: {data.length} clientes con saldo
                    </td>
                    <td className="px-4 py-3 text-right text-lg font-bold text-danger-700 tabular-nums">
                      {formatGs(
                        (data as PendingCreditRow[]).reduce((s, v) => s + Math.abs(v.balance), 0)
                      )}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}

      {!loading && tab === 'productos' && (
        <Card
          className="rounded-2xl overflow-hidden"
          style={{ boxShadow: 'var(--shadow-card-soft)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeadCls}>
                  <th className={thCls}>Producto</th>
                  <th className={thCls}>Categoría</th>
                  <th className={`${thCls} text-right`}>Cant. Vendida</th>
                  <th className={`${thCls} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(
                  data as {
                    product_name: string
                    category_name: string
                    total_quantity: number
                    total_revenue: number
                  }[]
                ).map((r, i) => (
                  <tr key={i} className={trCls}>
                    <td className={`${tdCls} font-medium`}>{r.product_name}</td>
                    <td className={`${tdCls} text-text-muted`}>
                      {r.category_name || <span className="text-text-disabled">—</span>}
                    </td>
                    <td className={`${tdCls} text-right tabular-nums`}>{r.total_quantity}</td>
                    <td className={`${tdCls} text-right font-medium tabular-nums`}>
                      {formatGs(r.total_revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && tab === 'margen' && (
        <Card
          className="rounded-2xl overflow-hidden"
          style={{ boxShadow: 'var(--shadow-card-soft)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeadCls}>
                  <th className={thCls}>Producto</th>
                  <th className={`${thCls} text-right`}>P. Venta</th>
                  <th className={`${thCls} text-right`}>Últ. Costo</th>
                  <th className={`${thCls} text-right`}>Margen</th>
                  <th className={`${thCls} text-right`}>%</th>
                </tr>
              </thead>
              <tbody>
                {(
                  data as { product_name: string; sale_price: number; last_cost: number | null }[]
                ).map((r, i) => {
                  const margin = r.last_cost ? r.sale_price - r.last_cost : null
                  const pct =
                    margin && r.last_cost ? ((margin / r.last_cost) * 100).toFixed(1) : null
                  const positive = (margin ?? 0) > 0
                  return (
                    <tr key={i} className={trCls}>
                      <td className={`${tdCls} font-medium`}>{r.product_name}</td>
                      <td className={`${tdCls} text-right tabular-nums`}>
                        {formatGs(r.sale_price)}
                      </td>
                      <td className={`${tdCls} text-right tabular-nums`}>
                        {r.last_cost ? (
                          formatGs(r.last_cost)
                        ) : (
                          <span className="text-text-disabled">—</span>
                        )}
                      </td>
                      <td
                        className={`${tdCls} text-right font-medium tabular-nums ${
                          margin == null ? '' : positive ? 'text-success-700' : 'text-danger-700'
                        }`}
                      >
                        {margin ? formatGs(margin) : <span className="text-text-disabled">—</span>}
                      </td>
                      <td
                        className={`${tdCls} text-right tabular-nums ${
                          pct == null ? '' : positive ? 'text-success-700' : 'text-danger-700'
                        }`}
                      >
                        {pct ? `${pct}%` : <span className="text-text-disabled">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && tab === 'stock' && (
        <Card
          className="rounded-2xl overflow-hidden"
          style={{ boxShadow: 'var(--shadow-card-soft)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeadCls}>
                  <th className={thCls}>Fecha</th>
                  <th className={thCls}>Producto</th>
                  <th className={`${thCls} text-right`}>Antes</th>
                  <th className={`${thCls} text-right`}>Después</th>
                  <th className={thCls}>Motivo</th>
                  <th className={thCls}>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {(
                  data as {
                    created_at: string
                    product_name: string
                    quantity_before: number
                    quantity_after: number
                    reason: string
                    user_name: string
                  }[]
                ).map((r, i) => {
                  const diff = r.quantity_after - r.quantity_before
                  return (
                    <tr key={i} className={trCls}>
                      <td className={`${tdCls} text-text-muted tabular-nums`}>
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className={`${tdCls} font-medium`}>{r.product_name}</td>
                      <td className={`${tdCls} text-right tabular-nums`}>{r.quantity_before}</td>
                      <td
                        className={`${tdCls} text-right tabular-nums font-medium ${
                          diff > 0 ? 'text-success-700' : diff < 0 ? 'text-danger-700' : ''
                        }`}
                      >
                        {r.quantity_after}
                      </td>
                      <td className={`${tdCls} text-text-muted`}>{r.reason}</td>
                      <td className={`${tdCls} text-text-muted`}>{r.user_name}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && tab === 'caja' && (
        <Card
          className="rounded-2xl overflow-hidden"
          style={{ boxShadow: 'var(--shadow-card-soft)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeadCls}>
                  <th className={thCls}>Apertura</th>
                  <th className={thCls}>Cierre</th>
                  <th className={thCls}>Cajero</th>
                  <th className={`${thCls} text-right`}>Esperado</th>
                  <th className={`${thCls} text-right`}>Contado</th>
                  <th className={`${thCls} text-right`}>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {(
                  data as {
                    id?: number
                    opened_at: string
                    closed_at: string
                    user_name: string
                    expected_amount: number
                    closing_amount: number
                    difference: number
                  }[]
                ).map((r, i) => {
                  const isHighlighted =
                    highlightRegisterId != null && r.id === highlightRegisterId
                  return (
                  <tr
                    key={r.id ?? i}
                    id={r.id ? `register-row-${r.id}` : undefined}
                    className={cn(
                      trCls,
                      isHighlighted && 'bg-brand-light/30 ring-2 ring-brand/40'
                    )}
                  >
                    <td className={`${tdCls} text-text-muted tabular-nums`}>
                      {formatDateTime(r.opened_at)}
                    </td>
                    <td className={`${tdCls} text-text-muted tabular-nums`}>
                      {formatDateTime(r.closed_at)}
                    </td>
                    <td className={`${tdCls} font-medium`}>{r.user_name}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>
                      {formatGs(r.expected_amount)}
                    </td>
                    <td className={`${tdCls} text-right tabular-nums`}>
                      {formatGs(r.closing_amount)}
                    </td>
                    <td
                      className={`${tdCls} text-right font-medium tabular-nums ${
                        r.difference < 0
                          ? 'text-danger-700'
                          : r.difference > 0
                            ? 'text-success-700'
                            : ''
                      }`}
                    >
                      {r.difference >= 0 ? '+' : ''}
                      {formatGs(r.difference)}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showEmpty && (
        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
          <CardBody>
            <EmptyState
              icon={<FileText size={40} />}
              title="Sin datos"
              description={
                tab === 'fiados'
                  ? 'No hay clientes con saldo deudor. Hacé click en "Consultar".'
                  : 'Seleccioná un rango de fechas y hacé click en "Consultar" para ver el reporte.'
              }
            />
          </CardBody>
        </Card>
      )}

      {!loading && isObjectTab && !objectTabHasData && (
        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
          <CardBody>
            <EmptyState
              icon={<FileText size={40} />}
              title="Sin datos"
              description='Seleccioná un rango de fechas y hacé click en "Consultar" para ver el reporte.'
            />
          </CardBody>
        </Card>
      )}
    </div>
  )
}
