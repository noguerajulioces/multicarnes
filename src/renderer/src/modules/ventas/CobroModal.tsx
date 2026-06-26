import { useState, useCallback } from 'react'
import { Banknote, CreditCard, ArrowLeftRight, Clock, Layers, Plus, Trash2 } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useCartStore } from '../../store/cart.store'
import { useCashStore } from '../../store/cash.store'
import { formatGs } from '../../lib/utils'
import { Button, Input, Modal, MoneyInput } from '../../components/ui'
import { cn } from '../../lib/utils'
import { handleApiError } from '../../lib/api-error'
import { useInFlightGuard } from '../../hooks/use-in-flight-guard'
import CustomerPicker from './CustomerPicker'
import { PROCESSORS } from '../../lib/processors'
import type { Customer, PaymentMethod, PaymentProcessor, Sale } from '@shared/types'
import TicketPreviewModal from './TicketPreviewModal'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

// 006-card-payments: Tarjeta is a new top-level method covering POS terminals
// (Bancard, Dinelco, Ueno) and QR — all settle outside the cash register and
// emit a voucher number the cashier types in for later reconciliation.
const methodOptions: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Efectivo', icon: Banknote },
  { value: 'card', label: 'Tarjeta', icon: CreditCard },
  { value: 'transfer', label: 'Transfer.', icon: ArrowLeftRight },
  { value: 'credit', label: 'Fiado', icon: Clock },
  { value: 'mixed', label: 'Mixto', icon: Layers }
]

type MixedMethod = 'cash' | 'card' | 'transfer' | 'credit'

interface MixedLine {
  id: number
  method: MixedMethod
  amount: number
  processor: PaymentProcessor | null
  reference: string
}

const MIXED_METHOD_OPTIONS: { value: MixedMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'credit', label: 'Fiado' }
]

let mixedLineSeq = 0
const newMixedLine = (method: MixedMethod = 'cash'): MixedLine => ({
  id: ++mixedLineSeq,
  method,
  amount: 0,
  processor: null,
  reference: ''
})

export default function CobroModal({ onClose, onSuccess }: Props) {
  const user = useAuthStore((s) => s.user)
  const register = useCashStore((s) => s.register)
  const items = useCartStore((s) => s.items)
  const discount = useCartStore((s) => s.discount)
  const subtotal = useCartStore((s) => s.subtotal)
  const total = useCartStore((s) => s.total)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [cashReceived, setCashReceived] = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const handleSelectCustomer = useCallback((c: Customer) => setSelectedCustomer(c), [])
  const handleClearCustomer = useCallback(() => setSelectedCustomer(null), [])
  const [cardProcessor, setCardProcessor] = useState<PaymentProcessor | null>(null)
  const [cardReference, setCardReference] = useState('')
  const [transferReference, setTransferReference] = useState('')
  const [mixedLines, setMixedLines] = useState<MixedLine[]>(() => [
    newMixedLine('cash'),
    newMixedLine('card')
  ])
  const [loading, setLoading] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  // 011-double-submit-guard: lock síncrono inmune al timing de re-render de React,
  // para que un doble-click/doble-tap no dispare sales.create dos veces.
  const runExclusive = useInFlightGuard()

  const totalAmount = total()
  const change = paymentMethod === 'cash' ? cashReceived - totalAmount : 0
  const mixedTotal = mixedLines.reduce((sum, l) => sum + (l.amount || 0), 0)
  const mixedRemaining = totalAmount - mixedTotal
  const mixedHasCredit = mixedLines.some((l) => l.method === 'credit' && l.amount > 0)
  const mixedActiveLines = mixedLines.filter((l) => l.amount > 0)

  // Credit portion of THIS sale (mirror of the server-side formula in
  // createSale). Used to pre-check the customer's límite de fiado so the
  // cashier sees the block before submitting; the server throw is authoritative.
  const creditPortion =
    paymentMethod === 'credit'
      ? totalAmount
      : paymentMethod === 'mixed'
        ? mixedLines.filter((l) => l.method === 'credit').reduce((s, l) => s + (l.amount || 0), 0)
        : 0

  const creditLimitError = ((): string | null => {
    if (!selectedCustomer || creditPortion <= 0) return null
    if (!selectedCustomer.credit_limit_enabled || selectedCustomer.credit_limit_amount == null)
      return null
    const currentDebt = Math.max(0, -selectedCustomer.balance)
    if (currentDebt + creditPortion <= selectedCustomer.credit_limit_amount) return null
    const available = Math.max(0, selectedCustomer.credit_limit_amount - currentDebt)
    return `Supera el límite de fiado (${formatGs(selectedCustomer.credit_limit_amount)}). Disponible: ${formatGs(available)}.`
  })()

  const mixedLinesValid = (): boolean => {
    if (mixedActiveLines.length < 2) return false
    if (mixedTotal !== totalAmount) return false
    for (const l of mixedActiveLines) {
      if (l.method === 'card' && (!l.processor || !l.reference.trim())) return false
      if (l.method === 'transfer' && !l.reference.trim()) return false
    }
    return true
  }

  const canConfirm = (): boolean => {
    if (items.length === 0) return false
    if (paymentMethod === 'cash' && cashReceived < totalAmount) return false
    if (paymentMethod === 'card' && (!cardProcessor || !cardReference.trim())) return false
    if (paymentMethod === 'transfer' && !transferReference.trim()) return false
    if (paymentMethod === 'credit' && !selectedCustomer) return false
    if (paymentMethod === 'mixed') {
      if (!mixedLinesValid()) return false
      if (mixedHasCredit && !selectedCustomer) return false
    }
    if (creditLimitError) return false
    return true
  }

  const handleConfirm = async (): Promise<void> => {
    if (!user || !register) return

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

    let payments:
      | {
          method: string
          amount: number
          processor?: PaymentProcessor | null
          reference?: string | null
        }[]
      | undefined
    let paymentProcessor: PaymentProcessor | null = null
    let paymentReference: string | null = null

    if (paymentMethod === 'mixed') {
      payments = mixedActiveLines.map((l) => ({
        method: l.method,
        amount: l.amount,
        processor: l.method === 'card' ? l.processor : null,
        reference:
          l.method === 'card' || l.method === 'transfer' ? l.reference.trim() || null : null
      }))
    } else if (paymentMethod === 'card') {
      paymentProcessor = cardProcessor
      paymentReference = cardReference.trim() || null
    } else if (paymentMethod === 'transfer') {
      paymentReference = transferReference.trim() || null
    }

    await runExclusive(async () => {
      setLoading(true)
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
          paymentProcessor,
          paymentReference,
          payments
        })
        // createSale ya devuelve la venta completa (items + payments) vía
        // getSaleById, así que no hace falta un segundo round-trip para el ticket.
        setCompletedSale(created)
      } catch (err: unknown) {
        handleApiError(err)
      } finally {
        setLoading(false)
      }
    })
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

  const updateMixedLine = (id: number, patch: Partial<MixedLine>): void => {
    setMixedLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }
  const removeMixedLine = (id: number): void => {
    setMixedLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)))
  }
  const addMixedLine = (): void => {
    setMixedLines((prev) => [...prev, newMixedLine('cash')])
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
          <CustomerPicker
            selected={selectedCustomer}
            onSelect={handleSelectCustomer}
            onClear={handleClearCustomer}
          />
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-2">Método de pago</label>
          <div className="grid grid-cols-3 gap-2">
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
                      : 'border-border bg-surface text-text-main hover:border-brand hover:text-brand',
                    m.value === 'mixed' && 'col-span-2'
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

        {paymentMethod === 'card' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-text-muted mb-1.5">Procesador *</label>
              <div className="grid grid-cols-3 gap-2">
                {PROCESSORS.map((p) => {
                  const active = cardProcessor === p.value
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setCardProcessor(p.value)}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-xs font-medium border transition-colors min-h-[64px]',
                        active
                          ? 'border-brand bg-brand text-white'
                          : 'border-border bg-surface text-text-main hover:border-brand hover:text-brand'
                      )}
                    >
                      {p.logo && (
                        <img
                          src={p.logo}
                          alt=""
                          className="h-6 max-w-[80px] object-contain"
                          onError={(e) => {
                            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      )}
                      <span>{p.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1.5">N° de comprobante *</label>
              <Input
                value={cardReference}
                onChange={(e) => setCardReference(e.target.value)}
                placeholder="Ej: 000123456"
                autoFocus
              />
            </div>
          </div>
        )}

        {paymentMethod === 'transfer' && (
          <div>
            <label className="block text-sm text-text-muted mb-1.5">N° de comprobante *</label>
            <Input
              value={transferReference}
              onChange={(e) => setTransferReference(e.target.value)}
              placeholder="Ej: 000123456"
              autoFocus
            />
          </div>
        )}

        {paymentMethod === 'credit' && !selectedCustomer && (
          <div className="px-3 py-2 bg-warning-50 rounded-lg text-sm text-warning-700">
            Seleccioná un cliente para registrar la venta a crédito.
          </div>
        )}

        {paymentMethod === 'credit' && selectedCustomer && creditLimitError && (
          <div className="px-3 py-2 bg-danger-50 rounded-lg text-sm text-danger-700">
            {creditLimitError}
          </div>
        )}

        {paymentMethod === 'mixed' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Desglose</span>
              <span
                className={cn(
                  'font-medium tabular-nums',
                  mixedRemaining === 0
                    ? 'text-success-700'
                    : mixedRemaining < 0
                      ? 'text-danger-700'
                      : 'text-text-muted'
                )}
              >
                {mixedRemaining === 0
                  ? 'Suma correcta'
                  : mixedRemaining > 0
                    ? `Restante: ${formatGs(mixedRemaining)}`
                    : `Excede por: ${formatGs(-mixedRemaining)}`}
              </span>
            </div>

            {mixedLines.map((line) => (
              <div key={line.id} className="border border-border rounded-xl p-3 space-y-2">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-text-muted mb-1">Método</label>
                    <select
                      value={line.method}
                      onChange={(e) =>
                        updateMixedLine(line.id, {
                          method: e.target.value as MixedMethod,
                          processor: null,
                          reference: ''
                        })
                      }
                      className="w-full h-10 px-3 rounded-xl border border-border bg-surface text-sm text-text-main"
                    >
                      {MIXED_METHOD_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-text-muted mb-1">Monto</label>
                    <MoneyInput
                      value={line.amount}
                      onValueChange={(v) => updateMixedLine(line.id, { amount: v })}
                      className="text-right tabular-nums"
                      placeholder="0"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMixedLine(line.id)}
                    disabled={mixedLines.length <= 1}
                    className="h-10 w-10 flex items-center justify-center rounded-xl border border-border text-danger-500 hover:bg-danger-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Quitar pago"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {line.method === 'card' && (
                  <>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Procesador *</label>
                      <div className="grid grid-cols-3 gap-2">
                        {PROCESSORS.map((p) => {
                          const active = line.processor === p.value
                          return (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => updateMixedLine(line.id, { processor: p.value })}
                              className={cn(
                                'flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg text-xs font-medium border transition-colors min-h-[52px]',
                                active
                                  ? 'border-brand bg-brand text-white'
                                  : 'border-border bg-surface text-text-main hover:border-brand hover:text-brand'
                              )}
                            >
                              {p.logo && (
                                <img
                                  src={p.logo}
                                  alt=""
                                  className="h-5 max-w-[70px] object-contain"
                                  onError={(e) => {
                                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                              )}
                              <span>{p.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">
                        N° de comprobante *
                      </label>
                      <Input
                        value={line.reference}
                        onChange={(e) => updateMixedLine(line.id, { reference: e.target.value })}
                        placeholder="Ej: 000123456"
                      />
                    </div>
                  </>
                )}

                {line.method === 'transfer' && (
                  <div>
                    <label className="block text-xs text-text-muted mb-1">
                      N° de comprobante *
                    </label>
                    <Input
                      value={line.reference}
                      onChange={(e) => updateMixedLine(line.id, { reference: e.target.value })}
                      placeholder="Ej: 000123456"
                    />
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addMixedLine}
              className="w-full py-2.5 rounded-xl border border-dashed border-border text-sm text-text-muted hover:border-brand hover:text-brand flex items-center justify-center gap-1.5"
            >
              <Plus size={14} /> Agregar pago
            </button>

            {mixedHasCredit && !selectedCustomer && (
              <div className="px-3 py-2 bg-warning-50 rounded-lg text-sm text-warning-700">
                Seleccioná un cliente para registrar la porción Fiado.
              </div>
            )}

            {selectedCustomer && creditLimitError && (
              <div className="px-3 py-2 bg-danger-50 rounded-lg text-sm text-danger-700">
                {creditLimitError}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
