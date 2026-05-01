import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useCashStore } from '../../store/cash.store'
import { formatGs } from '../../lib/utils'
import { MoneyInput } from '../../components/ui'

export default function AperturaCajaPage() {
  const [amount, setAmount] = useState(0)
  const [loading, setLoading] = useState(false)
  const user = useAuthStore((s) => s.user)
  const setRegister = useCashStore((s) => s.setRegister)
  const navigate = useNavigate()

  const handleOpen = async (): Promise<void> => {
    if (!user) return
    setLoading(true)
    try {
      const register = await window.api.cash.open(user.id, amount)
      setRegister(register)
      navigate('/caja')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al abrir caja')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div
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

        <div className="mb-6">
          <label className="block text-sm text-text-muted mb-2">Monto de apertura (Gs.)</label>
          <MoneyInput
            value={amount}
            onValueChange={setAmount}
            className="h-12 text-right text-lg tabular-nums"
            placeholder="0"
            autoFocus
          />
          {amount > 0 && (
            <p className="text-sm text-text-muted mt-1.5 text-right tabular-nums">
              {formatGs(amount)}
            </p>
          )}
        </div>

        <button
          onClick={handleOpen}
          disabled={loading}
          className="w-full bg-brand text-white py-3 rounded-xl font-medium hover:bg-brand-hover disabled:opacity-50 transition-colors shadow-sm"
        >
          {loading ? 'Abriendo...' : 'Abrir Caja'}
        </button>
      </div>
    </div>
  )
}
