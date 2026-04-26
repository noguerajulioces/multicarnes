import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'
import { formatGs, formatDateTime } from '../../lib/utils'
import type { Customer, Sale, CustomerPayment } from '@shared/types'

export default function ClienteFichaPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [payments, setPayments] = useState<CustomerPayment[]>([])
  const [showPayment, setShowPayment] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')

  useEffect(() => { loadData() }, [id])

  const loadData = async () => {
    const cid = Number(id)
    const [c, s, p] = await Promise.all([
      window.api.customers.getById(cid),
      window.api.customers.getSales(cid),
      window.api.customers.getPayments(cid)
    ])
    setCustomer(c)
    setSales(s)
    setPayments(p)
  }

  const handlePayment = async () => {
    if (!user || !id || !payAmount) return
    await window.api.customers.addPayment(Number(id), user.id, parseInt(payAmount), payNote || undefined)
    setShowPayment(false)
    setPayAmount('')
    setPayNote('')
    loadData()
  }

  if (!customer) return <p className="text-text-muted">Cargando...</p>

  return (
    <div>
      <button onClick={() => navigate('/clientes')} className="text-sm text-brand hover:underline mb-4">← Volver a Clientes</button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-6 shadow-sm md:col-span-2">
          <h1 className="text-2xl font-bold mb-2">{customer.name}</h1>
          <p className="text-text-muted text-sm">{customer.phone || 'Sin teléfono'} | {customer.address || 'Sin dirección'}</p>
          {customer.is_employee && <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Empleado</span>}
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <p className="text-sm text-text-muted">Saldo</p>
          <p className={`text-3xl font-bold ${customer.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatGs(customer.balance)}
          </p>
          <button onClick={() => setShowPayment(true)}
            className="mt-3 w-full bg-brand text-white py-2 rounded-lg text-sm hover:bg-brand-hover">
            Registrar Pago
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold mb-4">Historial de Compras</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-text-muted text-left">
              <th className="pb-2">Fecha</th><th className="pb-2 text-right">Total</th><th className="pb-2">Método</th>
            </tr></thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-b"><td className="py-2">{formatDateTime(s.created_at)}</td>
                  <td className="py-2 text-right font-medium">{formatGs(s.total)}</td>
                  <td className="py-2 capitalize">{s.payment_method}</td></tr>
              ))}
              {sales.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-text-muted">Sin compras</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="font-semibold mb-4">Historial de Pagos</h2>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-text-muted text-left">
              <th className="pb-2">Fecha</th><th className="pb-2 text-right">Monto</th><th className="pb-2">Nota</th>
            </tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b"><td className="py-2">{formatDateTime(p.created_at)}</td>
                  <td className="py-2 text-right font-medium text-green-600">{formatGs(p.amount)}</td>
                  <td className="py-2 text-text-muted">{p.note || '-'}</td></tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-text-muted">Sin pagos</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold mb-4">Registrar Pago</h3>
            <div className="space-y-3">
              <div><label className="block text-sm text-text-muted mb-1">Monto (Gs.)</label>
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full border rounded-lg p-2 text-right focus:outline-none focus:ring-2 focus:ring-brand" autoFocus /></div>
              <div><label className="block text-sm text-text-muted mb-1">Nota (opcional)</label>
                <input value={payNote} onChange={(e) => setPayNote(e.target.value)}
                  className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand" /></div>
              <div className="flex gap-3">
                <button onClick={() => setShowPayment(false)} className="flex-1 border rounded-lg py-2 hover:bg-gray-50">Cancelar</button>
                <button onClick={handlePayment} disabled={!payAmount}
                  className="flex-1 bg-brand text-white py-2 rounded-lg hover:bg-brand-hover disabled:opacity-50">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
