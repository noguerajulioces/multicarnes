import { Fragment, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Edit2,
  Phone,
  MapPin,
  ShoppingBag,
  Trash2,
  Wallet
} from 'lucide-react'
import { confirm } from '../../lib/confirm'
import { toast } from '../../lib/toast'
import { useAuthStore } from '../../store/auth.store'
import { formatGs, formatDateTime, cn } from '../../lib/utils'
import { formatQty } from '../../lib/price-types'
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
  TableSkeleton,
  TourButton
} from '../../components/ui'
import { usePageTour } from '../../lib/use-page-tour'
import { clienteFichaTourSteps } from '../../lib/tour-steps'
import { handleApiError } from '../../lib/api-error'
import type { Customer, Sale, CustomerPayment, PaymentMethod } from '@shared/types'

const methodLabel: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  credit: 'Crédito',
  transfer: 'Transfer.',
  mixed: 'Mixto'
}

const methodTone: Record<PaymentMethod, 'success' | 'warning' | 'info' | 'neutral'> = {
  cash: 'success',
  card: 'info',
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
  const [expandedSale, setExpandedSale] = useState<number | null>(null)
  const [editPayment, setEditPayment] = useState<CustomerPayment | null>(null)
  const [editAmount, setEditAmount] = useState(0)
  const [editNote, setEditNote] = useState('')

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
    try {
      await window.api.customers.addPayment(Number(id), user.id, payAmount, payNote || undefined)
    } catch (err) {
      handleApiError(err)
      return
    }
    closePaymentModal()
    loadData()
  }

  const openEditPayment = (p: CustomerPayment): void => {
    setEditPayment(p)
    setEditAmount(p.amount)
    setEditNote(p.note || '')
  }

  const closeEditPayment = (): void => {
    setEditPayment(null)
    setEditAmount(0)
    setEditNote('')
  }

  const handleSavePayment = async (): Promise<void> => {
    if (!editPayment || !editAmount) return
    try {
      await window.api.customers.updatePayment(editPayment.id, editAmount, editNote || null)
    } catch (err) {
      handleApiError(err)
      return
    }
    closeEditPayment()
    loadData()
    toast.success('Pago actualizado')
  }

  const handleDeletePayment = async (): Promise<void> => {
    if (!editPayment) return
    const ok = await confirm({
      title: 'Eliminar pago',
      message: 'Se restará del saldo del cliente. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true
    })
    if (!ok) return
    try {
      await window.api.customers.deletePayment(editPayment.id)
    } catch (err) {
      handleApiError(err)
      return
    }
    closeEditPayment()
    loadData()
    toast.success('Pago eliminado')
  }

  const { startTour } = usePageTour({
    key: 'cliente-ficha',
    steps: clienteFichaTourSteps,
    ready: !!customer
  })

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
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate('/clientes')}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-brand transition-colors"
        >
          <ArrowLeft size={14} />
          Volver a Clientes
        </button>
        <TourButton onClick={startTour} size="sm" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          data-tour="cliente-ficha-info"
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
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={14} />
                  {customer.phone || <span className="text-text-disabled">Sin teléfono</span>}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} />
                  {customer.address || <span className="text-text-disabled">Sin dirección</span>}
                </span>
                {customer.document && (
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    {customer.document_type || 'Doc'}: {customer.document}
                  </span>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card
          data-tour="cliente-ficha-balance"
          className={cn('rounded-2xl border', owes ? 'border-danger-500/40' : 'border-border')}
          style={{ boxShadow: 'var(--shadow-card-soft)' }}
        >
          <CardBody>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{
                  background: owes ? 'var(--gradient-kpi-purple)' : 'var(--gradient-kpi-green)'
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
        <Card
          data-tour="cliente-ficha-sales"
          className="rounded-2xl"
          style={{ boxShadow: 'var(--shadow-card-soft)' }}
        >
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
                  <th className="pb-2 font-normal w-6"></th>
                  <th className="pb-2 font-normal pr-3">Fecha</th>
                  <th className="pb-2 font-normal pr-3 text-right">Total</th>
                  <th className="pb-2 font-normal">Método</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-text-muted">
                      Sin compras registradas
                    </td>
                  </tr>
                ) : (
                  sales.map((s) => {
                    const isOpen = expandedSale === s.id
                    const items = s.items ?? []
                    const creditDue =
                      s.payment_method === 'mixed'
                        ? (s.payments ?? []).reduce(
                            (acc, p) => acc + (p.method === 'credit' ? p.amount : 0),
                            0
                          )
                        : 0
                    return (
                      <Fragment key={s.id}>
                        <tr
                          onClick={() => setExpandedSale(isOpen ? null : s.id)}
                          className="border-b border-border last:border-0 hover:bg-surface-muted/40 cursor-pointer"
                        >
                          <td className="py-2.5 pr-1 text-text-muted align-top">
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                          <td className="py-2.5 pr-3 text-text-muted tabular-nums align-top">
                            {formatDateTime(s.created_at)}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-medium tabular-nums align-top">
                            {formatGs(s.total)}
                          </td>
                          <td className="py-2.5 align-top">
                            <Badge tone={methodTone[s.payment_method]}>
                              {methodLabel[s.payment_method]}
                            </Badge>
                            {creditDue > 0 && (
                              <div className="text-[11px] text-warning-700 mt-1 tabular-nums whitespace-nowrap">
                                Fiado {formatGs(creditDue)}
                              </div>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-border last:border-0 bg-surface-muted/30">
                            <td colSpan={4} className="px-3 py-2">
                              {items.length === 0 ? (
                                <p className="text-xs text-text-muted py-2">
                                  Sin ítems registrados
                                </p>
                              ) : (
                                <ul className="divide-y divide-border">
                                  {items.map((it) => (
                                    <li
                                      key={it.id}
                                      className="py-2 flex items-baseline gap-3 text-xs"
                                    >
                                      <span className="font-medium text-text-main flex-1 truncate">
                                        {it.product_name ?? `#${it.product_id}`}
                                      </span>
                                      <span className="text-text-muted tabular-nums whitespace-nowrap">
                                        {formatQty(it.quantity, it.price_type ?? 'unit')}
                                        {' × '}
                                        {formatGs(it.unit_price)}
                                      </span>
                                      <span className="font-medium tabular-nums whitespace-nowrap w-24 text-right">
                                        {formatGs(it.subtotal)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card
          data-tour="cliente-ficha-payments"
          className="rounded-2xl"
          style={{ boxShadow: 'var(--shadow-card-soft)' }}
        >
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
                  <th className="pb-2 font-normal w-12"></th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-text-muted">
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
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => openEditPayment(p)}
                          className="p-1.5 hover:bg-surface-muted rounded-lg text-text-muted hover:text-text-main transition-colors"
                          title="Editar pago"
                        >
                          <Edit2 size={14} />
                        </button>
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

      <Modal
        open={editPayment != null}
        onClose={closeEditPayment}
        size="sm"
        title="Editar pago"
        footer={
          <div className="flex justify-between w-full">
            <Button variant="secondary" onClick={handleDeletePayment}>
              <Trash2 size={14} /> Eliminar
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={closeEditPayment}>
                Cancelar
              </Button>
              <Button onClick={handleSavePayment} disabled={!editAmount}>
                Guardar
              </Button>
            </div>
          </div>
        }
      >
        {editPayment && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              Pago original: {formatGs(editPayment.amount)} ·{' '}
              {formatDateTime(editPayment.created_at)}
            </p>
            <div>
              <label className="block text-sm text-text-muted mb-1.5">Monto (Gs.)</label>
              <MoneyInput
                value={editAmount}
                onValueChange={setEditAmount}
                className="h-12 text-right text-lg tabular-nums"
                placeholder="0"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1.5">Nota</label>
              <Input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Forma de pago, observaciones..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
