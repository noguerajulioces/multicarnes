import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCashStore } from '../../store/cash.store'
import { formatGs } from '../../lib/utils'

export default function CierreCajaPage() {
  const { register, setRegister } = useCashStore()
  const navigate = useNavigate()
  const [closingAmount, setClosingAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [expected, setExpected] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!register) { navigate('/caja/apertura'); return }
    window.api.cash.getSummary(register.id).then((s: unknown) => {
      const sum = s as { cashSales: number; incomes: number; expenses: number }
      setExpected(register.opening_amount + sum.cashSales + sum.incomes - sum.expenses)
    })
  }, [register])

  const counted = parseInt(closingAmount) || 0
  const difference = counted - expected

  const handleClose = async () => {
    if (!register) return
    setLoading(true)
    try {
      await window.api.cash.close(register.id, counted, notes || undefined)
      setRegister(null)
      navigate('/dashboard')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al cerrar caja')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto mt-8">
      <div className="bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-xl font-bold mb-6 text-center">Cierre de Caja / Arqueo</h1>

        <div className="bg-bg-secondary rounded-lg p-4 mb-6">
          <p className="text-sm text-text-muted">Efectivo esperado</p>
          <p className="text-2xl font-bold">{formatGs(expected)}</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-text-muted mb-1">Monto contado físicamente (Gs.)</label>
          <input
            type="number"
            value={closingAmount}
            onChange={(e) => setClosingAmount(e.target.value)}
            className="w-full border rounded-lg p-3 text-lg text-right focus:outline-none focus:ring-2 focus:ring-brand"
            autoFocus
          />
        </div>

        {closingAmount && (
          <div className={`rounded-lg p-4 mb-4 ${difference >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="text-sm text-text-muted">Diferencia</p>
            <p className={`text-xl font-bold ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {difference >= 0 ? '+' : ''}{formatGs(difference)}
            </p>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm text-text-muted mb-1">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-brand"
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <button onClick={() => navigate('/caja')} className="flex-1 border rounded-lg py-3 hover:bg-gray-50">
            Volver
          </button>
          <button
            onClick={handleClose}
            disabled={loading || !closingAmount}
            className="flex-1 bg-brand text-white py-3 rounded-lg font-medium hover:bg-brand-hover disabled:opacity-50"
          >
            {loading ? 'Cerrando...' : 'Confirmar Cierre'}
          </button>
        </div>
      </div>
    </div>
  )
}
