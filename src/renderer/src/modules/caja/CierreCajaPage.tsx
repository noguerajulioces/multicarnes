import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Coins, TrendingUp, TrendingDown } from 'lucide-react'
import { useCashStore } from '../../store/cash.store'
import { formatGs } from '../../lib/utils'
import { toast } from '../../lib/toast'
import { MoneyInput } from '../../components/ui'

export default function CierreCajaPage() {
  const { register, setRegister } = useCashStore()
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

  const handleClose = async (): Promise<void> => {
    if (!register) return
    setLoading(true)
    try {
      await window.api.cash.close(register.id, counted, notes || undefined)
      setRegister(null)
      toast.success('Caja cerrada')

      try {
        const all = await window.api.settings.getAll()
        const autoBackup = all.find((s) => s.key === 'auto_backup')?.value === '1'
        if (autoBackup) {
          const path = await window.api.backup.create()
          toast.success('Backup automático creado')
          window.api.notify
            .show('Backup al cerrar caja', `Se guardó en ${path}`)
            .catch(() => {})
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? `Error en backup automático: ${err.message}` : 'Error en backup automático'
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

  return (
    <div className="max-w-lg mx-auto mt-8">
      <div
        className="bg-surface rounded-2xl border border-border p-8"
        style={{ boxShadow: 'var(--shadow-card-soft)' }}
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-4"
            style={{ background: 'var(--gradient-kpi-teal)' }}
          >
            <Coins size={26} />
          </div>
          <h1 className="text-xl font-bold text-text-main">Cierre de Caja / Arqueo</h1>
          <p className="text-sm text-text-muted mt-1">
            Contá el efectivo y registrá el cierre del turno
          </p>
        </div>

        <div
          className="rounded-xl p-4 mb-5 border border-border"
          style={{ boxShadow: 'var(--shadow-card-soft)' }}
        >
          <p className="text-xs text-text-muted mb-1">Efectivo esperado</p>
          <p className="text-2xl font-bold text-text-main tabular-nums">{formatGs(expected)}</p>
        </div>

        <div className="mb-4">
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
          <div
            className={`rounded-xl p-4 mb-5 ${
              positiveDiff ? 'bg-success-50' : 'bg-danger-50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {positiveDiff ? (
                <TrendingUp size={14} className="text-success-700" />
              ) : (
                <TrendingDown size={14} className="text-danger-700" />
              )}
              <p className="text-xs text-text-muted">Diferencia</p>
            </div>
            <p
              className={`text-xl font-bold tabular-nums ${
                positiveDiff ? 'text-success-700' : 'text-danger-700'
              }`}
            >
              {positiveDiff ? '+' : ''}
              {formatGs(difference)}
            </p>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm text-text-muted mb-1.5">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-main placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
            rows={3}
            placeholder="Observaciones del cierre..."
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/caja')}
            className="flex-1 border border-border rounded-xl py-3 font-medium text-text-main hover:bg-surface-muted transition-colors"
          >
            Volver
          </button>
          <button
            onClick={handleClose}
            disabled={loading || !touched}
            className="flex-1 bg-brand text-white py-3 rounded-xl font-medium hover:bg-brand-hover disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? 'Cerrando...' : 'Confirmar Cierre'}
          </button>
        </div>
      </div>
    </div>
  )
}
