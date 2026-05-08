import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Coins, TrendingUp, TrendingDown } from 'lucide-react'
import { useCashStore } from '../../store/cash.store'
import { useAuthStore } from '../../store/auth.store'
import { daysOpen, formatDate, formatGs, isRegisterStale } from '../../lib/utils'
import { toast } from '../../lib/toast'
import { MoneyInput, TourButton } from '../../components/ui'
import { usePageTour } from '../../lib/use-page-tour'
import { cajaCierreTourSteps } from '../../lib/tour-steps'

export default function CierreCajaPage() {
  const { register, setRegister } = useCashStore()
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [counted, setCounted] = useState(0)
  const [touched, setTouched] = useState(false)
  const [notes, setNotes] = useState('')
  const [expected, setExpected] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!register) {
      navigate('/caja/apertura')
      return
    }
    window.api.cash.getSummary(register.id).then((s: unknown) => {
      const sum = s as { cashSales: number; incomes: number; expenses: number }
      setExpected(register.opening_amount + sum.cashSales + sum.incomes - sum.expenses)
    })
  }, [register])

  const difference = counted - expected
  const positiveDiff = difference >= 0

  const stale = isRegisterStale(register)
  const lateDays = daysOpen(register)

  const handleClose = async (): Promise<void> => {
    if (!register) return
    if (stale && notes.trim().length === 0) {
      toast.error('Las notas son obligatorias en un cierre con retraso')
      return
    }
    setLoading(true)
    try {
      await window.api.cash.close(register.id, counted, notes || undefined, user?.id)
      setRegister(null)
      toast.success('Caja cerrada')

      try {
        const all = await window.api.settings.getAll()
        const autoBackup = all.find((s) => s.key === 'auto_backup')?.value === '1'
        if (autoBackup) {
          const path = await window.api.backup.create()
          toast.success('Backup automático creado')
          window.api.notify.show('Backup al cerrar caja', `Se guardó en ${path}`).catch(() => {})
        }
      } catch (err) {
        toast.error(
          err instanceof Error
            ? `Error en backup automático: ${err.message}`
            : 'Error en backup automático'
        )
      }

      try {
        const low = await window.api.products.lowStock()
        if (low.length > 0) {
          await window.api.notify.show(
            'Stock bajo',
            `${low.length} producto${low.length === 1 ? '' : 's'} con stock al mínimo o agotado.`
          )
        }
      } catch {
        /* no-op */
      }

      navigate('/dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al cerrar caja')
    }
    setLoading(false)
  }

  const { startTour } = usePageTour({ key: 'caja-cierre', steps: cajaCierreTourSteps })

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ background: 'var(--gradient-kpi-teal)' }}
          >
            <Coins size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-main leading-tight">
              Cierre de Caja / Arqueo
            </h1>
            <p className="text-xs text-text-muted">
              Contá el efectivo y registrá el cierre del turno
            </p>
          </div>
        </div>
        <TourButton onClick={startTour} size="sm" />
      </div>

      {stale && register && (
        <div className="rounded-xl p-3 mb-3 bg-danger-50 border border-danger-500/40 flex items-start gap-3">
          <AlertTriangle size={18} className="text-danger-700 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-danger-700">Cierre con retraso</p>
            <p className="text-text-main mt-0.5">
              Esta caja se abrió el{' '}
              <span className="font-medium tabular-nums">{formatDate(register.opened_at)}</span>
              {lateDays > 0 && (
                <>
                  , hace{' '}
                  <span className="font-medium tabular-nums">
                    {lateDays} día{lateDays === 1 ? '' : 's'}
                  </span>
                </>
              )}
              . Para continuar usando el sistema necesitás cerrarla. Si no sabés el conteo, ingresá
              0 y dejá una nota explicando.
            </p>
          </div>
        </div>
      )}

      <div
        className="bg-surface rounded-2xl border border-border p-5"
        style={{ boxShadow: 'var(--shadow-card-soft)' }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div
              data-tour="caja-cierre-expected"
              className="rounded-xl p-4 border border-border"
              style={{ boxShadow: 'var(--shadow-card-soft)' }}
            >
              <p className="text-xs text-text-muted mb-1">Efectivo esperado</p>
              <p className="text-2xl font-bold text-text-main tabular-nums">{formatGs(expected)}</p>
            </div>

            <div data-tour="caja-cierre-counted">
              <label className="block text-sm text-text-muted mb-1.5">
                Monto contado físicamente (Gs.)
              </label>
              <MoneyInput
                value={counted}
                onValueChange={(v) => {
                  setCounted(v)
                  setTouched(true)
                }}
                className="h-12 text-right text-lg tabular-nums"
                placeholder="0"
                autoFocus
              />
            </div>

            {touched && (
              <div className={`rounded-xl p-3 ${positiveDiff ? 'bg-success-50' : 'bg-danger-50'}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  {positiveDiff ? (
                    <TrendingUp size={14} className="text-success-700" />
                  ) : (
                    <TrendingDown size={14} className="text-danger-700" />
                  )}
                  <p className="text-xs text-text-muted">Diferencia</p>
                </div>
                <p
                  className={`text-lg font-bold tabular-nums ${
                    positiveDiff ? 'text-success-700' : 'text-danger-700'
                  }`}
                >
                  {positiveDiff ? '+' : ''}
                  {formatGs(difference)}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <label className="block text-sm text-text-muted mb-1.5">
              Notas {stale ? <span className="text-danger-700">(obligatorias)</span> : '(opcional)'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full flex-1 min-h-[140px] rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-main placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors resize-none"
              placeholder={
                stale
                  ? 'Explicá por qué se cerró con retraso (cajero ausente, olvido, etc.)'
                  : 'Observaciones del cierre...'
              }
            />

            <div data-tour="caja-cierre-confirm" className="flex gap-3 mt-4">
              {!stale && (
                <button
                  onClick={() => navigate('/caja')}
                  className="flex-1 border border-border rounded-xl py-2.5 font-medium text-text-main hover:bg-surface-muted transition-colors"
                >
                  Volver
                </button>
              )}
              <button
                onClick={handleClose}
                disabled={loading || !touched || (stale && notes.trim().length === 0)}
                className="flex-1 bg-brand text-white py-2.5 rounded-xl font-medium hover:bg-brand-hover disabled:opacity-50 transition-colors shadow-sm"
              >
                {loading ? 'Cerrando...' : 'Confirmar Cierre'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
