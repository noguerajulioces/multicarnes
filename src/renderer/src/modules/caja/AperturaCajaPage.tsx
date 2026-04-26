import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'
import { useCashStore } from '../../store/cash.store'
import { formatGs } from '../../lib/utils'

export default function AperturaCajaPage() {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const user = useAuthStore((s) => s.user)
  const setRegister = useCashStore((s) => s.setRegister)
  const navigate = useNavigate()

  const handleOpen = async () => {
    if (!user) return
    setLoading(true)
    try {
      const register = await window.api.cash.open(user.id, parseInt(amount) || 0)
      setRegister(register)
      navigate('/caja')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al abrir caja')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-surface rounded-lg shadow-sm p-8">
        <h1 className="text-xl font-bold mb-6 text-center">Apertura de Caja</h1>

        <div className="mb-6">
          <label className="block text-sm text-text-muted mb-2">Monto de apertura (Gs.)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border rounded-lg p-3 text-lg text-right focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="0"
            autoFocus
          />
          {amount && (
            <p className="text-sm text-text-muted mt-1 text-right">{formatGs(parseInt(amount) || 0)}</p>
          )}
        </div>

        <button
          onClick={handleOpen}
          disabled={loading}
          className="w-full bg-brand text-white py-3 rounded-lg font-medium hover:bg-brand-hover disabled:opacity-50"
        >
          {loading ? 'Abriendo...' : 'Abrir Caja'}
        </button>
      </div>
    </div>
  )
}
