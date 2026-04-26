import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/auth.store'
import { useCartStore } from '../../store/cart.store'
import { useCashStore } from '../../store/cash.store'
import { formatGs } from '../../lib/utils'
import type { Customer } from '@shared/types'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function CobroModal({ onClose, onSuccess }: Props) {
  const user = useAuthStore((s) => s.user)
  const register = useCashStore((s) => s.register)
  const { items, discount, subtotal, total } = useCartStore()
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'transfer' | 'mixed'>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [mixedCash, setMixedCash] = useState('')
  const [mixedTransfer, setMixedTransfer] = useState('')
  const [mixedCredit, setMixedCredit] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [saleId, setSaleId] = useState<number | null>(null)

  useEffect(() => {
    if (customerSearch.length >= 2) {
      window.api.customers.getAll(customerSearch).then(setCustomers)
    } else {
      setCustomers([])
    }
  }, [customerSearch])

  const totalAmount = total()
  const change = paymentMethod === 'cash' ? (parseInt(cashReceived) || 0) - totalAmount : 0

  const handleConfirm = async () => {
    if (!user || !register) return
    setLoading(true)

    const saleItems = items.map((i) => ({
      productId: i.product.id,
      quantity: i.quantity,
      unitPrice: i.product.price,
      subtotal: i.subtotal
    }))

    let payments: { method: string; amount: number }[] | undefined
    if (paymentMethod === 'mixed') {
      payments = []
      if (parseInt(mixedCash) > 0) payments.push({ method: 'cash', amount: parseInt(mixedCash) })
      if (parseInt(mixedTransfer) > 0) payments.push({ method: 'transfer', amount: parseInt(mixedTransfer) })
      if (parseInt(mixedCredit) > 0) payments.push({ method: 'credit', amount: parseInt(mixedCredit) })
    }

    try {
      const sale = await window.api.sales.create({
        registerId: register.id,
        userId: user.id,
        customerId: selectedCustomer?.id || null,
        items: saleItems,
        subtotal: subtotal(),
        discount: discount,
        total: totalAmount,
        paymentMethod,
        payments
      })
      setSaleId(sale.id)
      setSuccess(true)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al procesar venta')
    }
    setLoading(false)
  }

  const mixedTotal = (parseInt(mixedCash) || 0) + (parseInt(mixedTransfer) || 0) + (parseInt(mixedCredit) || 0)
  const canConfirm = () => {
    if (items.length === 0) return false
    if (paymentMethod === 'cash' && (parseInt(cashReceived) || 0) < totalAmount) return false
    if (paymentMethod === 'credit' && !selectedCustomer) return false
    if (paymentMethod === 'mixed' && mixedTotal !== totalAmount) return false
    if (paymentMethod === 'mixed' && (parseInt(mixedCredit) || 0) > 0 && !selectedCustomer) return false
    return true
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-surface rounded-lg p-8 max-w-sm w-full mx-4 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-green-600 text-3xl">✓</span>
          </div>
          <h3 className="text-xl font-bold mb-2">Venta Exitosa</h3>
          <p className="text-text-muted mb-1">Ticket #{saleId}</p>
          <p className="text-2xl font-bold text-brand mb-6">{formatGs(totalAmount)}</p>
          {paymentMethod === 'cash' && change > 0 && (
            <p className="text-lg mb-4 bg-green-50 p-3 rounded-lg">
              Vuelto: <span className="font-bold text-green-600">{formatGs(change)}</span>
            </p>
          )}
          <button
            onClick={onSuccess}
            className="w-full bg-brand text-white py-3 rounded-lg font-medium hover:bg-brand-hover"
          >
            Nueva Venta
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-2">Cobrar</h3>
        <p className="text-3xl font-bold text-brand mb-6">{formatGs(totalAmount)}</p>

        {/* Customer selection */}
        <div className="mb-4">
          <label className="block text-sm text-text-muted mb-1">Cliente (opcional)</label>
          {selectedCustomer ? (
            <div className="flex items-center justify-between border rounded-lg p-2">
              <div>
                <p className="font-medium">{selectedCustomer.name}</p>
                <p className="text-xs text-text-muted">Saldo: {formatGs(selectedCustomer.balance)}</p>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-sm text-red-500">Quitar</button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="Buscar cliente..."
              />
              {customers.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-surface border rounded-lg mt-1 shadow-lg z-10 max-h-40 overflow-y-auto">
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setCustomers([]) }}
                      className="w-full text-left px-3 py-2 hover:bg-surface-muted text-sm"
                    >
                      {c.name} <span className="text-text-muted">({formatGs(c.balance)})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payment method */}
        <div className="mb-4">
          <label className="block text-sm text-text-muted mb-2">Método de pago</label>
          <div className="grid grid-cols-4 gap-2">
            {(['cash', 'transfer', 'credit', 'mixed'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                  paymentMethod === m ? 'border-brand bg-brand text-white' : 'border-gray-200 hover:border-brand'
                }`}
              >
                {{ cash: 'Efectivo', transfer: 'Transfer.', credit: 'Fiado', mixed: 'Mixto' }[m]}
              </button>
            ))}
          </div>
        </div>

        {paymentMethod === 'cash' && (
          <div className="mb-4">
            <label className="block text-sm text-text-muted mb-1">Efectivo recibido</label>
            <input
              type="number"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              className="w-full border rounded-lg p-3 text-right text-lg focus:outline-none focus:ring-2 focus:ring-brand"
              autoFocus
            />
            {(parseInt(cashReceived) || 0) >= totalAmount && (
              <p className="text-right mt-1 text-green-600 font-medium">
                Vuelto: {formatGs(change)}
              </p>
            )}
          </div>
        )}

        {paymentMethod === 'credit' && !selectedCustomer && (
          <p className="text-red-500 text-sm mb-4">Debe seleccionar un cliente para fiado</p>
        )}

        {paymentMethod === 'mixed' && (
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Efectivo</label>
              <input type="number" value={mixedCash} onChange={(e) => setMixedCash(e.target.value)}
                className="w-full border rounded-lg p-2 text-right focus:outline-none focus:ring-1 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Transferencia</label>
              <input type="number" value={mixedTransfer} onChange={(e) => setMixedTransfer(e.target.value)}
                className="w-full border rounded-lg p-2 text-right focus:outline-none focus:ring-1 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Fiado</label>
              <input type="number" value={mixedCredit} onChange={(e) => setMixedCredit(e.target.value)}
                className="w-full border rounded-lg p-2 text-right focus:outline-none focus:ring-1 focus:ring-brand" />
            </div>
            <p className={`text-sm text-right font-medium ${mixedTotal === totalAmount ? 'text-green-600' : 'text-red-500'}`}>
              Total: {formatGs(mixedTotal)} / {formatGs(totalAmount)}
              {mixedTotal !== totalAmount && ' (debe coincidir)'}
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg py-3 hover:bg-surface-muted">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !canConfirm()}
            className="flex-1 bg-brand text-white py-3 rounded-lg font-medium hover:bg-brand-hover disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Confirmar y Cobrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
