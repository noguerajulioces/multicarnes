import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Skeleton } from '../../../components/ui'
import { formatGs } from '../../../lib/utils'

export interface SalesBarPoint {
  label: string
  ventas: number
}

interface SalesBarChartProps {
  data: SalesBarPoint[]
  loading?: boolean
}

function compactGs(v: number): string {
  if (v >= 1_000_000) return `₲${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `₲${(v / 1_000).toFixed(0)}k`
  return `₲${v}`
}

interface TooltipPayload {
  name: string
  value: number
  color: string
}

function CustomTooltip({
  active,
  payload,
  label
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg shadow-popover px-3 py-2 text-xs">
      <div className="font-medium text-text-main mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-text-muted">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize">{p.name}:</span>
          <span className="font-medium text-text-main tabular-nums">{formatGs(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function SalesBarChart({ data, loading }: SalesBarChartProps) {
  if (loading) {
    return <Skeleton className="h-[280px] w-full" />
  }
  if (!data.length) {
    return (
      <div className="h-[280px] flex items-center justify-center text-sm text-text-muted">
        Sin datos en el período seleccionado
      </div>
    )
  }
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="25%"
        >
          <defs>
            <linearGradient id="barVentas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#CC1C1C" stopOpacity={1} />
              <stop offset="100%" stopColor="#CC1C1C" stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            tickFormatter={compactGs}
            width={56}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'var(--color-surface-muted)', opacity: 0.5 }}
          />
          <Bar dataKey="ventas" name="Ventas" fill="url(#barVentas)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
