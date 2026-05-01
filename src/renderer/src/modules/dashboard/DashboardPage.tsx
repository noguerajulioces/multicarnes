import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ShoppingCart, Wallet, Receipt, AlertTriangle, Package } from 'lucide-react'
import { formatGs } from '../../lib/utils'
import { Card, CardBody, CardHeader, KpiCard } from '../../components/ui'
import { useAuthStore } from '../../store/auth.store'
import type { Product, Sale } from '@shared/types'
import { SalesBarChart, type SalesBarPoint } from './components/SalesBarChart'
import { TopProductsDonut, type TopProductSlice } from './components/TopProductsDonut'
import { RecentSalesTable } from './components/RecentSalesTable'
import { StockSummaryCard } from './components/StockSummaryCard'
import { PeriodSelector, type PeriodOption } from './components/PeriodSelector'

type ChartPeriod = '7d' | '30d' | '6m'
type DonutPeriod = '7d' | '30d' | '6m'

const chartPeriods: PeriodOption<ChartPeriod>[] = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '6m', label: '6 meses' }
]

const donutPeriods: PeriodOption<DonutPeriod>[] = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '6m', label: '6 meses' }
]

interface PendingCreditRow {
  id: number
  name: string
  balance: number
}

interface TopProductRow {
  product_name: string
  total_quantity: number
  total_revenue: number
}

interface SalesSummaryByDay {
  day: string
  sales_count: number
  total: number
}

interface ComparisonResult {
  current: { total: number; sales_count: number }
  previous: { total: number; sales_count: number }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoOffsetDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function periodRange(p: ChartPeriod): { from: string; to: string } {
  const to = todayISO()
  if (p === '7d') return { from: isoOffsetDays(-6), to }
  if (p === '30d') return { from: isoOffsetDays(-29), to }
  return { from: isoOffsetDays(-179), to }
}

function deltaPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function buildChartData(byDay: SalesSummaryByDay[], period: ChartPeriod): SalesBarPoint[] {
  if (period === '6m') {
    const buckets = new Map<string, number>()
    for (const row of byDay) {
      const key = row.day.slice(0, 7)
      buckets.set(key, (buckets.get(key) ?? 0) + row.total)
    }
    const months: { key: string; label: string }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('es-PY', { month: 'short' })
      months.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1, 3) })
    }
    const points = months.map((m) => ({
      label: m.label,
      ventas: buckets.get(m.key) ?? 0,
      target: 0
    }))
    const maxVentas = Math.max(...points.map((p) => p.ventas), 0)
    return points.map((p) => ({ ...p, target: Math.round(maxVentas * 1.15) }))
  }

  const days = period === '7d' ? 7 : 30
  const map = new Map<string, number>()
  for (const row of byDay) map.set(row.day, row.total)
  const out: SalesBarPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const label =
      period === '7d'
        ? d.toLocaleDateString('es-PY', { weekday: 'short' }).slice(0, 3)
        : `${d.getDate()}`
    out.push({ label, ventas: map.get(key) ?? 0, target: 0 })
  }
  const maxVentas = Math.max(...out.map((p) => p.ventas), 0)
  return out.map((p) => ({ ...p, target: Math.round(maxVentas * 1.15) }))
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isCajero = user?.role === 'cajero'

  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('6m')
  const [donutPeriod, setDonutPeriod] = useState<DonutPeriod>('30d')

  const [dayTotal, setDayTotal] = useState({ total: 0, count: 0 })
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [lowStock, setLowStock] = useState<Product[]>([])
  const [pendingCredits, setPendingCredits] = useState<PendingCreditRow[]>([])
  const [recentSales, setRecentSales] = useState<Sale[]>([])
  const [byDay, setByDay] = useState<SalesSummaryByDay[]>([])
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([])

  const [headerLoading, setHeaderLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(!isCajero)
  const [donutLoading, setDonutLoading] = useState(!isCajero)

  useEffect(() => {
    const today = todayISO()
    const baseCalls: Promise<unknown>[] = [
      window.api.sales.dayTotal(),
      window.api.products.lowStock()
    ]
    const managerCalls: Promise<unknown>[] = isCajero
      ? []
      : [
          window.api.reports.salesComparison(today, today),
          window.api.reports.pendingCredits(),
          window.api.sales.getRecent(8)
        ]
    Promise.all([...baseCalls, ...managerCalls])
      .then((results) => {
        setDayTotal(results[0] as { total: number; count: number })
        setLowStock(results[1] as Product[])
        if (!isCajero) {
          setComparison(results[2] as ComparisonResult)
          setPendingCredits(results[3] as PendingCreditRow[])
          setRecentSales(results[4] as Sale[])
        }
      })
      .finally(() => setHeaderLoading(false))
  }, [isCajero])

  useEffect(() => {
    if (isCajero) return
    setChartLoading(true)
    const { from, to } = periodRange(chartPeriod)
    window.api.reports
      .salesSummary(from, to)
      .then((res) => {
        const r = res as { byDay: SalesSummaryByDay[] }
        setByDay(r.byDay)
      })
      .finally(() => setChartLoading(false))
  }, [chartPeriod, isCajero])

  useEffect(() => {
    if (isCajero) return
    setDonutLoading(true)
    const { from, to } = periodRange(donutPeriod)
    window.api.reports
      .topProducts(from, to)
      .then((res) => {
        const all = res as TopProductRow[]
        setTopProducts(all.slice(0, 5))
      })
      .finally(() => setDonutLoading(false))
  }, [donutPeriod, isCajero])

  const chartData = useMemo(() => buildChartData(byDay, chartPeriod), [byDay, chartPeriod])

  const donutData: TopProductSlice[] = useMemo(
    () =>
      topProducts.map((p) => ({
        name: p.product_name,
        quantity: p.total_quantity,
        revenue: p.total_revenue
      })),
    [topProducts]
  )

  const totalCreditOwed = pendingCredits.reduce((s, c) => s + Math.abs(c.balance), 0)
  const salesDelta = comparison ? deltaPct(comparison.current.total, comparison.previous.total) : 0
  const ticketsDelta = comparison
    ? deltaPct(comparison.current.sales_count, comparison.previous.sales_count)
    : 0

  if (isCajero) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-main">
              Hola, {user?.name?.split(' ')[0] ?? ''}
            </h1>
            <p className="text-sm text-text-muted mt-0.5">Tu panel de trabajo de hoy</p>
          </div>
          <button
            onClick={() => navigate('/ventas')}
            className="bg-brand text-white px-5 py-3 rounded-xl font-medium hover:bg-brand-hover flex items-center gap-2 shadow-sm transition-colors"
          >
            <Plus size={20} />
            Nueva Venta
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard
            gradient="blue"
            icon={<Receipt size={20} />}
            label="Tickets Hoy"
            value={String(dayTotal.count)}
            hint="ventas registradas"
            loading={headerLoading}
          />
          <KpiCard
            gradient="teal"
            icon={<AlertTriangle size={20} />}
            label="Alertas de Stock"
            value={String(lowStock.length)}
            hint={lowStock.length > 0 ? 'productos críticos' : 'todo en orden'}
            loading={headerLoading}
          />
        </div>

        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-text-muted" />
              <h2 className="font-semibold text-text-main">Resumen de Stock</h2>
            </div>
          </CardHeader>
          <CardBody>
            <StockSummaryCard lowStock={lowStock} loading={headerLoading} />
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Dashboard</h1>
          <p className="text-sm text-text-muted mt-0.5">Resumen general de tu negocio</p>
        </div>
        <button
          onClick={() => navigate('/ventas')}
          className="bg-brand text-white px-4 py-2.5 rounded-xl font-medium hover:bg-brand-hover flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus size={18} />
          Nueva Venta
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          gradient="green"
          icon={<Wallet size={20} />}
          label="Total Vendido Hoy"
          value={formatGs(dayTotal.total)}
          delta={comparison ? { pct: salesDelta, label: 'vs ayer' } : null}
          loading={headerLoading}
        />
        <KpiCard
          gradient="blue"
          icon={<Receipt size={20} />}
          label="Tickets Hoy"
          value={String(dayTotal.count)}
          delta={comparison ? { pct: ticketsDelta, label: 'vs ayer' } : null}
          loading={headerLoading}
        />
        <KpiCard
          gradient="purple"
          icon={<ShoppingCart size={20} />}
          label="Cobros Pendientes"
          value={formatGs(totalCreditOwed)}
          hint={`${pendingCredits.length} cliente${pendingCredits.length === 1 ? '' : 's'}`}
          loading={headerLoading}
        />
        <KpiCard
          gradient="teal"
          icon={<AlertTriangle size={20} />}
          label="Alertas de Stock"
          value={String(lowStock.length)}
          hint={lowStock.length > 0 ? 'productos críticos' : 'todo en orden'}
          loading={headerLoading}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card
          className="xl:col-span-2 rounded-2xl"
          style={{ boxShadow: 'var(--shadow-card-soft)' }}
        >
          <CardHeader className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-text-main">Ventas</h2>
              <p className="text-xs text-text-muted">Comparativa por período</p>
            </div>
            <PeriodSelector value={chartPeriod} options={chartPeriods} onChange={setChartPeriod} />
          </CardHeader>
          <CardBody>
            <SalesBarChart data={chartData} loading={chartLoading} />
            <div className="flex items-center gap-4 text-xs text-text-muted pt-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                Ventas
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: '#A78BFA', opacity: 0.6 }}
                />
                Meta
              </span>
            </div>
          </CardBody>
        </Card>

        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
          <CardHeader className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-text-main">Top Productos</h2>
              <p className="text-xs text-text-muted">Más vendidos del período</p>
            </div>
            <PeriodSelector value={donutPeriod} options={donutPeriods} onChange={setDonutPeriod} />
          </CardHeader>
          <CardBody>
            <TopProductsDonut data={donutData} loading={donutLoading} />
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card
          className="xl:col-span-2 rounded-2xl"
          style={{ boxShadow: 'var(--shadow-card-soft)' }}
        >
          <CardHeader>
            <h2 className="font-semibold text-text-main">Ventas Recientes</h2>
            <p className="text-xs text-text-muted">Últimas 8 transacciones</p>
          </CardHeader>
          <CardBody>
            <RecentSalesTable sales={recentSales} loading={headerLoading} />
          </CardBody>
        </Card>

        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-text-muted" />
              <h2 className="font-semibold text-text-main">Resumen Stock</h2>
            </div>
          </CardHeader>
          <CardBody>
            <StockSummaryCard lowStock={lowStock} loading={headerLoading} />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
