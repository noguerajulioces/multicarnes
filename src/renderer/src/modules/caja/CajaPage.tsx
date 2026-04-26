import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'
import { useCashStore } from '../../store/cash.store'
import { formatGs, formatDateTime } from '../../lib/utils'
import type { CashMovement } from '@shared/types'
import { Plus, Minus } from 'lucide-react'

export default function CajaPage() {
  const user = useAuthStore((s) => s.user)
  const register = useCashStore((s) => s.register)
  const navigate = useNavigate()
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [summary, setSummary] = useState<{
    cashSales: number; incomes: number; expenses: number
  } | null>(null)
  const [modal, setModal] = useState<{ type: 'income' | 'expense' } | null>(null)
  const [movAmount, setMovAmount] = useState('')
  const [movDesc, setMovDesc] = useState('')

  useEffect(() => {
    if (!register) {
      navigate('/caja/apertura')
      return
    }
    loadData()
  }, [register])

  const loadData = async () => {
    if (!register) return
    const [movs, sum] = await Promise.all([
      window.api.cash.getMovements(register.id),
      window.api.cash.getSummary(register.id)
    ])
    setMovements(movs)
    setSummary(sum as typeof summary)
  }

  const handleAddMovement = async () => {
    if (!register || !user || !modal || !movAmount || !movDesc) return
    await window.api.cash.addMovement(register.id, user.id, modal.type, parseInt(movAmount) || 0, movDesc)
    setModal(null)
    setMovAmount('')
    setMovDesc('')
    loadData()
  }

  const expectedCash = register
    ? register.opening_amount + (summary?.cashSales || 0) + (summary?.incomes || 0) - (summary?.expenses || 0)
    : 0

  const canClose = user?.role === 'admin' || user?.role === 'supervisor'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Caja Actual</h1>
        {canClose && register && (
          <button
            onClick={() => navigate('/caja/cierre')}
            className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
          >
            Cerrar Caja
          </button>
        )}
      </div>

      {register && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-xs text-text-muted">Apertura</p>
              <p className="text-lg font-bold">{formatGs(register.opening_amount)}</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-xs text-text-muted">Ventas Efectivo</p>
              <p className="text-lg font-bold">{formatGs(summary?.cashSales || 0)}</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-xs text-text-muted">Ingresos / Egresos</p>
              <p className="text-lg font-bold text-green-600">+{formatGs(summary?.incomes || 0)}</p>
              <p className="text-sm text-red-600">-{formatGs(summary?.expenses || 0)}</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-brand">
              <p className="text-xs text-text-muted">Efectivo Esperado</p>
              <p className="text-lg font-bold text-brand">{formatGs(expectedCash)}</p>
            </div>
          </div>

          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setModal({ type: 'income' })}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <Plus size={16} /> Registrar Ingreso
            </button>
            <button
              onClick={() => setModal({ type: 'expense' })}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              <Minus size={16} /> Registrar Egreso
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="font-semibold mb-4">Movimientos del Turno</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-text-muted">
                  <th className="pb-2">Hora</th>
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2">Descripción</th>
                  <th className="pb-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="py-2">{formatDateTime(m.created_at)}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        m.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {m.type === 'income' ? 'Ingreso' : 'Egreso'}
                      </span>
                    </td>
                    <td className="py-2">{m.description}</td>
                    <td className="py-2 text-right font-medium">{formatGs(m.amount)}</td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-text-muted">Sin movimientos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Registrar {modal.type === 'income' ? 'Ingreso' : 'Egreso'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">Descripción</label>
                <input
                  value={movDesc}
                  onChange={(e) => setMovDesc(e.target.value)}
                  className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Monto (Gs.)</label>
                <input
                  type="number"
                  value={movAmount}
                  onChange={(e) => setMovAmount(e.target.value)}
                  className="w-full border rounded-lg p-2 text-right focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  onClick={handleAddMovement}
                  disabled={!movAmount || !movDesc}
                  className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
