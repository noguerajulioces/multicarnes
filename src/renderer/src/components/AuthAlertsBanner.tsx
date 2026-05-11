import { useEffect, type ReactElement } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useAuthEventsStore } from '../store/auth-events.store'
import { formatDateTime } from '../lib/utils'

// Renders one banner per open repeated-failure alert. Hidden when there
// are no open alerts. Mounted by the dashboard for admins only (FR-018).
export default function AuthAlertsBanner(): ReactElement | null {
  const alerts = useAuthEventsStore((s) => s.alerts)
  const fetchAlerts = useAuthEventsStore((s) => s.fetchAlerts)
  const acknowledge = useAuthEventsStore((s) => s.acknowledge)

  useEffect(() => {
    void fetchAlerts()
  }, [fetchAlerts])

  if (alerts.length === 0) return null

  return (
    <div className="space-y-3">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-3 rounded-2xl border border-warning-200 bg-warning-50 p-4"
        >
          <div className="shrink-0 mt-0.5 text-warning-700">
            <ShieldAlert size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-warning-900">
              Intentos de acceso bloqueados — {a.userName}
            </p>
            <p className="text-xs text-warning-800 mt-1">
              {a.failureCount} acción
              {a.failureCount === 1 ? '' : 'es'} rechazada
              {a.failureCount === 1 ? '' : 's'} desde las {formatDateTime(a.windowStart)}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => acknowledge(a.id)}
            className="shrink-0 rounded-lg bg-warning-100 hover:bg-warning-200 text-warning-900 text-xs font-medium px-3 py-1.5 transition-colors"
          >
            Marcar visto
          </button>
        </div>
      ))}
    </div>
  )
}
