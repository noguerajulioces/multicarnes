import { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Skeleton } from './Skeleton'
import { cn } from '../../lib/utils'

export type KpiGradient = 'purple' | 'blue' | 'teal' | 'green'

const gradientVar: Record<KpiGradient, string> = {
  purple: 'var(--gradient-kpi-purple)',
  blue: 'var(--gradient-kpi-blue)',
  teal: 'var(--gradient-kpi-teal)',
  green: 'var(--gradient-kpi-green)'
}

interface KpiCardProps {
  icon: ReactNode
  gradient: KpiGradient
  label: string
  value: string
  delta?: { pct: number; label: string } | null
  hint?: string
  loading?: boolean
}

export function KpiCard({ icon, gradient, label, value, delta, hint, loading }: KpiCardProps) {
  const positive = (delta?.pct ?? 0) >= 0
  return (
    <div
      className="bg-surface rounded-2xl p-5 border border-border"
      style={{ boxShadow: 'var(--shadow-card-soft)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{ background: gradientVar[gradient] }}
        >
          {icon}
        </div>
      </div>
      <div className="text-sm text-text-muted mb-1">{label}</div>
      {loading ? (
        <Skeleton className="h-8 w-32" />
      ) : (
        <div className="text-2xl font-bold text-text-main tabular-nums leading-tight">{value}</div>
      )}
      <div className="mt-2 flex items-center gap-1.5 text-xs">
        {delta ? (
          <>
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium',
                positive ? 'text-success-700' : 'text-danger-700'
              )}
            >
              {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(delta.pct).toFixed(0)}%
            </span>
            <span className="text-text-muted">{delta.label}</span>
          </>
        ) : hint ? (
          <span className="text-text-muted">{hint}</span>
        ) : (
          <span className="text-text-disabled">&nbsp;</span>
        )}
      </div>
    </div>
  )
}
