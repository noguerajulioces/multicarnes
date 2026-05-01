import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Phone,
  MapPin,
  ShoppingBag,
  Wallet
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { formatGs, formatDateTime, cn } from '../../lib/utils'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Modal,
  MoneyInput,
  Skeleton,
  TableSkeleton
} from '../../components/ui'
import type { Customer, Sale, CustomerPayment, PaymentMethod } from '@shared/types'

const methodLabel: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  credit: 'Crédito',
  transfer: 'Transfer.',
  mixed: 'Mixto'
}

const methodTone: Record<PaymentMethod, 'success' | 'warning' | 'info' | 'neutral'> = {
  cash: 'success',
  credit: 'warning',
  transfer: 'info',
  mixed: 'neutral'
}

export default function ClienteFichaPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [payments, setPayments] = useState<CustomerPayment[]>([])
  const [showPayment, setShowPayment] = useState(false)
  const [payAmount, setPayAmount] = useState(0)
  const [payNote, setPayNote] = useState('')

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async (): Promise<void> => {
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

  const closePaymentModal = (): void => {
    setShowPayment(false)
    setPayAmount(0)
    setPayNote('')
  }

  const handlePayment = async (): Promise<void> => {
    if (!user || !id || !payAmount) return
    await window.api.customers.addPayment(Number(id), user.id, payAmount, payNote || undefined)
    closePaymentModal()
    loadData()
  }

  if (!customer) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            className="md:col-span-2 rounded-2xl"
            style={{ boxShadow: 'var(--shadow-card-soft)' }}
          >
            <CardBody className="space-y-3">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardBody>
          </Card>
          <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
            <CardBody className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
            </CardBody>
          </Card>
        </div>
        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
          <CardBody>
            <TableSkeleton rows={5} columns={4} />
          </CardBody>
        </Card>
      </div>
    )
  }

  const owes = customer.balance < 0
  const initials = customer.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate('/clientes')}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-brand transition-colors"
      >
        <ArrowLeft size={14} />
        Volver a Clientes
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          className="lg:col-span-2 rounded-2xl"
          style={{ boxShadow: 'var(--shadow-card-soft)' }}
        >
          <CardBody className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-light text-brand flex items-center justify-center text-lg font-bold shrink-0">
              {initials || customer.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-text-main">{customer.name}</h1>
                {customer.is_employee && <Badge tone="info">Empleado</Badge>}
              </div>
              <div className="mt-2 flex flex-col sm:flex-row sm:gap-4 gap-1 text-sm text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={14} />
                  {customer.phone || (
                    <span className="text-text-disabled">Sin teléfono</span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} />
                  {customer.address || (
                    <span className="text-text-disabled">Sin dirección</span>
                  )}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card
          className={cn(
            'rounded-2xl border',
            owes ? 'border-danger-500/40' : 'border-border'
          )}
          style={{ boxShadow: 'var(--shadow-card-soft)' }}
        >
          <CardBody>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{
                  background: owes
                    ? 'var(--gradient-kpi-purple)'
                    : 'var(--gradient-kpi-green)'
                }}
              >
                {owes ? <CreditCard size={18} /> : <CheckCircle2 size={18} />}
              </div>
              <div>
                <p className="text-xs text-text-muted">Saldo</p>
                <p className="text-xs font-medium">
                  {owes ? (
                    <span className="text-danger-700">Debe</span>
                  ) : customer.balance > 0 ? (
                    <span className="text-success-700">A favor</span>
                  ) : (
                    <span className="text-text-muted">Al día</span>
                  )}
                </p>
              </div>
            </div>
            <p
              className={cn(
                'text-3xl font-bold tabular-nums leading-tight',
                owes ? 'text-danger-700' : 'text-text-main'
              )}
            >
              {formatGs(customer.balance)}
            </p>
            <Button
              className="mt-4 w-full rounded-xl"
              size="md"
              onClick={() => setShowPayment(true)}
            >
              <Wallet size={16} />
              Registrar Pago
            </Button>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShoppingBag size={16} className="text-text-muted" />
              <h2 className="font-semibold text-text-main">Historial de Compras</h2>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {sales.length} compra{sales.length === 1 ? '' : 's'} registrada
              {sales.length === 1 ? '' : 's'}
            </p>
          </CardHeader>
          <CardBody className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted text-left">
                  <th className="pb-2 font-normal pr-3">Fecha</th>
                  <th className="pb-2 font-normal pr-3 text-right">Total</th>
                  <th className="pb-2 font-normal">Método</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-text-muted">
                      Sin compras registradas
                    </td>
                  </tr>
                ) : (
                  sales.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-border last:border-0 hover:bg-surface-muted/40"
                    >
                      <td className="py-2.5 pr-3 text-text-muted tabular-nums">
                        {formatDateTime(s.created_at)}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-medium tabular-nums">
                        {formatGs(s.total)}
                      </td>
                      <td className="py-2.5">
                        <Badge tone={methodTone[s.payment_method]}>
                          {methodLabel[s.payment_method]}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-text-muted" />
              <h2 className="font-semibold text-text-main">Historial de Pagos</h2>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {payments.length} pago{payments.length === 1 ? '' : 's'} recibido
              {payments.length === 1 ? '' : 's'}
            </p>
          </CardHeader>
          <CardBody className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted text-left">
                  <th className="pb-2 font-normal pr-3">Fecha</th>
                  <th className="pb-2 font-normal pr-3 text-right">Monto</th>
                  <th className="pb-2 font-normal">Nota</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-text-muted">
                      Sin pagos recibidos
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border last:border-0 hover:bg-surface-muted/40"
                    >
                      <td className="py-2.5 pr-3 text-text-muted tabular-nums">
                        {formatDateTime(p.created_at)}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-medium text-success-700 tabular-nums">
                        {formatGs(p.amount)}
                      </td>
                      <td className="py-2.5 text-text-muted truncate max-w-[200px]">
                        {p.note || <span className="text-text-disabled">—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={showPayment}
        onClose={closePaymentModal}
        size="sm"
        title="Registrar Pago"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={closePaymentModal}>
              Cancelar
            </Button>
            <Button onClick={handlePayment} disabled={!payAmount}>
              Guardar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-surface-muted rounded-xl px-4 py-3">
            <p className="text-xs text-text-muted">Saldo actual</p>
            <p
              className={cn(
                'text-lg font-semibold tabular-nums',
                owes ? 'text-danger-700' : 'text-text-main'
              )}
            >
              {formatGs(customer.balance)}
            </p>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">Monto del pago (Gs.)</label>
            <MoneyInput
              value={payAmount}
              onValueChange={setPayAmount}
              className="h-12 text-right text-lg tabular-nums"
              placeholder="0"
              autoFocus
            />
            {payAmount > 0 && owes && (
              <p className="text-xs text-text-muted mt-1.5 text-right">
                Saldo después del pago:{' '}
                <span className="font-medium tabular-nums text-text-main">
                  {formatGs(customer.balance + payAmount)}
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">Nota (opcional)</label>
            <Input
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              placeholder="Forma de pago, observaciones..."
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
