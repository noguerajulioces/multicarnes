import { useState, useEffect } from 'react'
import { X, User, Banknote, ArrowLeftRight, Clock, Layers } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useCartStore } from '../../store/cart.store'
import { useCashStore } from '../../store/cash.store'
import { formatGs } from '../../lib/utils'
import { Button, Input, Modal, MoneyInput } from '../../components/ui'
import { cn } from '../../lib/utils'
import type { Customer, PaymentMethod, Sale } from '@shared/types'
import TicketPreviewModal from './TicketPreviewModal'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

const methodOptions: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Efectivo', icon: Banknote },
  { value: 'transfer', label: 'Transfer.', icon: ArrowLeftRight },
  { value: 'credit', label: 'Fiado', icon: Clock },
  { value: 'mixed', label: 'Mixto', icon: Layers }
]

export default function CobroModal({ onClose, onSuccess }: Props) {
  const user = useAuthStore((s) => s.user)
  const register = useCashStore((s) => s.register)
  const { items, discount, subtotal, total } = useCartStore()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [cashReceived, setCashReceived] = useState(0)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [mixedCash, setMixedCash] = useState(0)
  const [mixedTransfer, setMixedTransfer] = useState(0)
  const [mixedCredit, setMixedCredit] = useState(0)
  const [loading, setLoading] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)

  useEffect(() => {
    if (customerSearch.length >= 2) {
      window.api.customers.getAll({ search: customerSearch }).then((res) => setCustomers(res.items))
    } else {
      setCustomers([])
    }
  }, [customerSearch])

  const totalAmount = total()
  const change = paymentMethod === 'cash' ? cashReceived - totalAmount : 0
  const mixedTotal = mixedCash + mixedTransfer + mixedCredit

  const canConfirm = (): boolean => {
    if (items.length === 0) return false
    if (paymentMethod === 'cash' && cashReceived < totalAmount) return false
    if (paymentMethod === 'credit' && !selectedCustomer) return false
    if (paymentMethod === 'mixed' && mixedTotal !== totalAmount) return false
    if (paymentMethod === 'mixed' && mixedCredit > 0 && !selectedCustomer) return false
    return true
  }

  const handleConfirm = async (): Promise<void> => {
    if (!user || !register) return
    setLoading(true)

    const saleItems = items.map((i) => ({
      productId: i.product.id,
      quantity: i.quantity,
      // 005-promotional-pricing: the cart store snapshots the effective unit
      // price at add-to-cart (i.unit_price) when the line was sold under an
      // active promo. Persisting i.product.price here would store the normal
      // price as if no promo applied, breaking the receipt's "Ahorrás" math
      // and producing sale_items rows where quantity*unit_price != subtotal.
      unitPrice: i.unit_price ?? i.product.price,
      subtotal: i.subtotal
    }))

    let payments: { method: string; amount: number }[] | undefined
    if (paymentMethod === 'mixed') {
      payments = []
      if (mixedCash > 0) payments.push({ method: 'cash', amount: mixedCash })
      if (mixedTransfer > 0) payments.push({ method: 'transfer', amount: mixedTransfer })
      if (mixedCredit > 0) payments.push({ method: 'credit', amount: mixedCredit })
    }

    try {
      const created = await window.api.sales.create({
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
      // Re-fetch with items + payments populated for the ticket preview
      const fullSale = await window.api.sales.getById(created.id)
      setCompletedSale(fullSale ?? created)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al procesar venta')
    }
    setLoading(false)
  }

  if (completedSale) {
    return (
      <TicketPreviewModal
        sale={completedSale}
        cashReceived={paymentMethod === 'cash' ? cashReceived : undefined}
        change={paymentMethod === 'cash' && change > 0 ? change : undefined}
        onClose={onSuccess}
      />
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-baseline gap-3">
          <span>Cobrar</span>
          <span className="text-2xl font-bold text-brand tabular-nums">
            {formatGs(totalAmount)}
          </span>
        </div>
      }
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1 rounded-xl" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1 rounded-xl"
            size="lg"
            onClick={handleConfirm}
            disabled={loading || !canConfirm()}
          >
            {loading ? 'Procesando...' : 'Confirmar y Cobrar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm text-text-muted mb-1.5">Cliente (opcional)</label>
          {selectedCustomer ? (
            <div className="flex items-center justify-between border border-border rounded-xl p-3 bg-surface-muted/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-brand-light text-brand flex items-center justify-center shrink-0">
                  <User size={16} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate text-text-main">{selectedCustomer.name}</p>
                  <p className="text-xs text-text-muted tabular-nums">
                    Saldo: {formatGs(selectedCustomer.balance)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-danger-500 hover:text-danger-700 p-1 rounded shrink-0"
                aria-label="Quitar cliente"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Buscar cliente..."
              />
              {customers.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 bg-surface border border-border rounded-xl mt-1 z-10 max-h-44 overflow-y-auto"
                  style={{ boxShadow: 'var(--shadow-popover)' }}
                >
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(c)
                        setCustomerSearch('')
                        setCustomers([])
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-surface-muted text-sm flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-text-main">{c.name}</span>
                      <span className="text-xs text-text-muted tabular-nums shrink-0">
                        {formatGs(c.balance)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-2">Método de pago</label>
          <div className="grid grid-cols-4 gap-2">
            {methodOptions.map((m) => {
              const active = paymentMethod === m.value
              const Icon = m.icon
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setPaymentMethod(m.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium border transition-colors',
                    active
                      ? 'border-brand bg-brand text-white'
                      : 'border-border bg-surface text-text-main hover:border-brand hover:text-brand'
                  )}
                >
                  <Icon size={18} />
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {paymentMethod === 'cash' && (
          <div>
            <label className="block text-sm text-text-muted mb-1.5">Efectivo recibido</label>
            <MoneyInput
              value={cashReceived}
              onValueChange={setCashReceived}
              className="h-12 text-right text-lg tabular-nums"
              placeholder="0"
              autoFocus
            />
            {cashReceived >= totalAmount && cashReceived > 0 && (
              <div className="flex items-center justify-between mt-2 px-3 py-2 bg-success-50 rounded-lg">
                <span className="text-xs text-text-muted">Vuelto</span>
                <span className="font-bold text-success-700 tabular-nums">{formatGs(change)}</span>
              </div>
            )}
          </div>
        )}

        {paymentMethod === 'credit' && !selectedCustomer && (
          <div className="px-3 py-2 bg-warning-50 rounded-lg text-sm text-warning-700">
            Seleccioná un cliente para registrar la venta a crédito.
          </div>
        )}

        {paymentMethod === 'mixed' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Efectivo</label>
                <MoneyInput
                  value={mixedCash}
                  onValueChange={setMixedCash}
                  className="text-right tabular-nums"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Transferencia</label>
                <MoneyInput
                  value={mixedTransfer}
                  onValueChange={setMixedTransfer}
                  className="text-right tabular-nums"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Fiado</label>
                <MoneyInput
                  value={mixedCredit}
                  onValueChange={setMixedCredit}
                  className="text-right tabular-nums"
                  placeholder="0"
                />
              </div>
            </div>
            <div
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg text-sm',
                mixedTotal === totalAmount
                  ? 'bg-success-50 text-success-700'
                  : 'bg-danger-50 text-danger-700'
              )}
            >
              <span className="font-medium">
                {mixedTotal === totalAmount ? 'Suma correcta' : 'Debe coincidir con el total'}
              </span>
              <span className="font-bold tabular-nums">
                {formatGs(mixedTotal)} / {formatGs(totalAmount)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
