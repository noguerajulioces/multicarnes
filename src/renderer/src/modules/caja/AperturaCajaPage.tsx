import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useCashStore } from '../../store/cash.store'
import { formatDateTime, formatGs } from '../../lib/utils'
import type { AppSetting } from '@shared/types'
import { confirm } from '../../lib/confirm'
import { handleApiError } from '../../lib/api-error'
import { getCashFloatDefault } from '../../lib/cash-float'
import { Button, MoneyInput, TourButton } from '../../components/ui'
import { usePageTour } from '../../lib/use-page-tour'
import { cajaAperturaTourSteps } from '../../lib/tour-steps'

export default function AperturaCajaPage() {
  const [amount, setAmount] = useState(0)
  const [loading, setLoading] = useState(false)
  const user = useAuthStore((s) => s.user)
  const setRegister = useCashStore((s) => s.setRegister)
  const navigate = useNavigate()

  // 010-cash-float-close: proponer como apertura el efectivo que quedó en el
  // último cierre (fondo). Si ese cierre no lo registró (anterior a la
  // feature) cae al fondo por defecto de Configuración; si tampoco hay, 0.
  // Sólo precarga si el usuario todavía no tipeó nada: lo editado manda.
  const [prefill, setPrefill] = useState<{
    source: 'last' | 'default'
    closedAt?: string
    amount: number
  } | null>(null)
  const editedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      window.api.cash.getLastClosed().catch(() => null),
      window.api.settings.getAll().catch((): AppSetting[] => [])
    ]).then(([last, all]) => {
      if (cancelled) return
      const def = getCashFloatDefault(all)
      let next: typeof prefill = null
      if (last && last.kept_amount != null) {
        next = { source: 'last', closedAt: last.closed_at, amount: last.kept_amount }
      } else if (def != null) {
        next = { source: 'default', amount: def }
      }
      setPrefill(next)
      if (next && !editedRef.current) setAmount(next.amount)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleOpen = async (): Promise<void> => {
    if (!user || loading) return

    if (amount === 0) {
      const ok = await confirm({
        title: 'Abrir caja sin efectivo',
        message:
          'Vas a abrir la caja con saldo inicial en ₲ 0. Podés registrarlo así si todavía no tenés efectivo en el cajón. ¿Continuar?',
        confirmLabel: 'Sí, abrir en 0',
        cancelLabel: 'Cancelar'
      })
      if (!ok) return
    }

    setLoading(true)
    try {
      const register = await window.api.cash.open(user.id, amount)
      setRegister(register)
      navigate('/caja')
    } catch (err: unknown) {
      handleApiError(err)
    }
    setLoading(false)
  }

  const { startTour } = usePageTour({ key: 'caja-apertura', steps: cajaAperturaTourSteps })

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="flex justify-end mb-2">
        <TourButton onClick={startTour} size="sm" />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleOpen()
        }}
        className="bg-surface rounded-2xl border border-border p-8"
        style={{ boxShadow: 'var(--shadow-card-soft)' }}
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-4"
            style={{ background: 'var(--gradient-kpi-blue)' }}
          >
            <Wallet size={26} />
          </div>
          <h1 className="text-xl font-bold text-text-main">Apertura de Caja</h1>
          <p className="text-sm text-text-muted mt-1">
            Indicá el efectivo con el que iniciás el turno
          </p>
        </div>

        <div data-tour="caja-apertura-amount" className="mb-6">
          <label className="block text-sm text-text-muted mb-2">Monto de apertura (Gs.)</label>
          <MoneyInput
            value={amount}
            onValueChange={(v) => {
              editedRef.current = true
              setAmount(v)
            }}
            className="h-12 text-right text-lg tabular-nums"
            placeholder="0"
            autoFocus
          />
          <p className="text-sm text-text-muted mt-1.5 text-right tabular-nums">
            {amount > 0 ? formatGs(amount) : 'Sin efectivo inicial — podés abrir en ₲ 0'}
          </p>
          {prefill && (
            <p className="text-xs text-text-muted mt-1 text-right">
              {prefill.source === 'last'
                ? `Quedó del cierre anterior${
                    prefill.closedAt ? ` (${formatDateTime(prefill.closedAt)})` : ''
                  }: ${formatGs(prefill.amount)}`
                : `Fondo de caja por defecto: ${formatGs(prefill.amount)}`}
              {amount !== prefill.amount ? ' · editado' : ''}
            </p>
          )}
        </div>

        <Button
          data-tour="caja-apertura-submit"
          type="submit"
          size="lg"
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Abriendo...' : 'Abrir Caja'}
        </Button>
      </form>
    </div>
  )
}
