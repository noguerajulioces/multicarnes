import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Skeleton } from '../../../components/ui'
import { formatGs } from '../../../lib/utils'

export interface TopProductSlice {
  name: string
  quantity: number
  revenue: number
}

interface TopProductsDonutProps {
  data: TopProductSlice[]
  loading?: boolean
}

const COLORS = ['#CC1C1C', '#A78BFA', '#60A5FA', '#34D399', '#F59E0B']

interface TooltipPayload {
  name: string
  value: number
  payload: TopProductSlice & { percent: number }
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || !payload.length) return null
  const slice = payload[0].payload
  return (
    <div className="bg-surface border border-border rounded-lg shadow-popover px-3 py-2 text-xs">
      <div className="font-medium text-text-main mb-1">{slice.name}</div>
      <div className="text-text-muted">{slice.quantity.toLocaleString('es-PY')} unidades</div>
      <div className="text-text-muted">{formatGs(slice.revenue)}</div>
    </div>
  )
}

export function TopProductsDonut({ data, loading }: TopProductsDonutProps) {
  if (loading) {
    return <Skeleton className="h-[280px] w-full" />
  }
  if (!data.length) {
    return (
      <div className="h-[280px] flex items-center justify-center text-sm text-text-muted">
        Sin ventas en el período
      </div>
    )
  }

  const total = data.reduce((s, d) => s + d.quantity, 0)
  const enriched = data.map((d) => ({ ...d, percent: total > 0 ? (d.quantity / total) * 100 : 0 }))

  return (
    <div className="flex flex-col">
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={enriched}
              dataKey="quantity"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={80}
              paddingAngle={2}
              stroke="var(--color-surface)"
              strokeWidth={2}
              label={({ percent }) =>
                percent != null && percent > 0.08 ? `${Math.round(percent * 100)}%` : ''
              }
              labelLine={false}
            >
              {enriched.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-1 gap-1.5 mt-3 text-xs">
        {enriched.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="truncate text-text-main flex-1">{d.name}</span>
            <span className="text-text-muted tabular-nums">{d.percent.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
