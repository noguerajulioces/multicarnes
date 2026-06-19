import { Fragment, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Phone,
  MapPin,
  ShoppingBag,
  Undo2,
  Wallet
} from 'lucide-react'
import { confirm } from '../../lib/confirm'
import { toast } from '../../lib/toast'
import { useAuthStore } from '../../store/auth.store'
import { useCashStore } from '../../store/cash.store'
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
  Pagination,
  Skeleton,
  Table,
  TableSkeleton,
  TBody,
  Td,
  Th,
  THead,
  TourButton,
  Tr
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

const SALES_PER_PAGE = 25

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
  const openRegister = useCashStore((s) => s.register)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [salesTotal, setSalesTotal] = useState(0)
  const [salesPage, setSalesPage] = useState(1)
  const [payments, setPayments] = useState<CustomerPayment[]>([])
  const [showPayment, setShowPayment] = useState(false)
  const [payAmount, setPayAmount] = useState(0)
  const [payNote, setPayNote] = useState('')
  const [payAffectsCash, setPayAffectsCash] = useState(true)
  const [expandedSale, setExpandedSale] = useState<number | null>(null)

  // Reset the sales pager synchronously when navigating to a different customer,
  // so the single load effect below never fires once with a stale (out-of-range)
  // page. (React's "adjust state during render" pattern — runs before the effect.)
  const [trackedId, setTrackedId] = useState(id)
  if (trackedId !== id) {
    setTrackedId(id)
    setSalesPage(1)
  }

  useEffect(() => {
    loadData()
  }, [id, salesPage])

  const loadData = async (): Promise<void> => {
    const cid = Number(id)
    const [c, s, p] = await Promise.all([
      window.api.customers.getById(cid),
      window.api.customers.getSales(cid, { page: salesPage, perPage: SALES_PER_PAGE }),
      window.api.customers.getPayments(cid)
    ])
    setCustomer(c)
    setSales(s.items)
    setSalesTotal(s.total)
    setPayments(p)
  }

  const closePaymentModal = (): void => {
    setShowPayment(false)
    setPayAmount(0)
    setPayNote('')
    setPayAffectsCash(true)
  }

  const canPayCash = openRegister != null && openRegister.user_id === user?.id

  const handlePayment = async (): Promise<void> => {
    if (!user || !id || !payAmount) return
    if (payAffectsCash && !canPayCash) return
    try {
      await window.api.customers.addPayment(
        Number(id),
        user.id,
        payAmount,
        payNote || undefined,
        payAffectsCash
      )
      toast.success('Pago registrado')
    } catch (err) {
      handleApiError(err)
      return
    }
    closePaymentModal()
    loadData()
  }

  const handleVoidPayment = async (p: CustomerPayment): Promise<void> => {
    const message = p.affects_cash
      ? 'Se restaurará la deuda del cliente y se anulará el ingreso en la caja. Queda registrado en el historial.'
      : 'Se restaurará la deuda del cliente. Queda registrado en el historial.'
    const ok = await confirm({
      title: 'Anular pago',
      message,
      confirmLabel: 'Anular',
      danger: true
    })
    if (!ok) return
    try {
      await window.api.customers.voidPayment(p.id)
    } catch (err) {
      handleApiError(err)
      return
    }
    loadData()
    toast.success('Pago anulado')
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
          <Card className="md:col-span-2">
            <CardBody className="space-y-3">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardBody>
            <TableSkeleton rows={5} columns={4} />
          </CardBody>
        </Card>
      </div>
    )
  }

  const owes = customer.balance < 0
  // Annulment rows (void_of != null) are markers, not payments — exclude them
  // from the "pagos recibidos" count.
  const receivedCount = payments.filter((p) => p.void_of == null).length
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
        <Card data-tour="cliente-ficha-info" className="lg:col-span-2">
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
            {customer.credit_limit_enabled && customer.credit_limit_amount != null && (
              <div className="mt-3 text-xs text-text-muted space-y-0.5">
                <p>
                  Límite de fiado:{' '}
                  <span className="tabular-nums text-text-main">
                    {formatGs(customer.credit_limit_amount)}
                  </span>
                </p>
                <p>
                  Disponible:{' '}
                  <span className="tabular-nums text-text-main">
                    {formatGs(
                      Math.max(0, customer.credit_limit_amount - Math.max(0, -customer.balance))
                    )}
                  </span>
                </p>
              </div>
            )}
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
        <Card data-tour="cliente-ficha-sales">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShoppingBag size={16} className="text-text-muted" />
              <h2 className="font-semibold text-text-main">Historial de Compras</h2>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {salesTotal} compra{salesTotal === 1 ? '' : 's'} registrada
              {salesTotal === 1 ? '' : 's'}
            </p>
          </CardHeader>
          <CardBody className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th className="w-6"></Th>
                  <Th>Fecha</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Método</Th>
                </Tr>
              </THead>
              <TBody>
                {sales.length === 0 ? (
                  <Tr>
                    <Td colSpan={4} className="py-8 text-center text-text-muted">
                      Sin compras registradas
                    </Td>
                  </Tr>
                ) : (
                  sales.map((s) => {
                    const isOpen = expandedSale === s.id
                    const items = s.items ?? []
                    // 009: surface the fiado generated by this sale for both
                    // pure credit (whole total) and the credit portion of a
                    // mixed sale, so the owner sees the origin consistently. This
                    // is the ORIGINAL amount fiado, not the remaining balance
                    // (debt is a fungible pool — no per-sale payment linkage).
                    const creditDue =
                      s.payment_method === 'credit'
                        ? s.total
                        : s.payment_method === 'mixed'
                          ? (s.payments ?? []).reduce(
                              (acc, p) => acc + (p.method === 'credit' ? p.amount : 0),
                              0
                            )
                          : 0
                    return (
                      <Fragment key={s.id}>
                        <Tr
                          onClick={() => setExpandedSale(isOpen ? null : s.id)}
                          className="cursor-pointer"
                        >
                          <Td className="text-text-muted align-top">
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </Td>
                          <Td className="text-text-muted tabular-nums align-top">
                            {formatDateTime(s.created_at)}
                          </Td>
                          <Td className="text-right font-medium tabular-nums align-top">
                            {formatGs(s.total)}
                          </Td>
                          <Td className="align-top">
                            <Badge tone={methodTone[s.payment_method]}>
                              {methodLabel[s.payment_method]}
                            </Badge>
                            {creditDue > 0 && (
                              <div className="text-[11px] text-warning-700 mt-1 tabular-nums">
                                Fiado en esta venta {formatGs(creditDue)}
                              </div>
                            )}
                          </Td>
                        </Tr>
                        {isOpen && (
                          <tr className="bg-surface-muted/30">
                            <td colSpan={4} className="px-4 py-2">
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
              </TBody>
            </Table>
            {salesTotal > SALES_PER_PAGE && (
              <Pagination
                page={salesPage}
                perPage={SALES_PER_PAGE}
                total={salesTotal}
                onPageChange={setSalesPage}
              />
            )}
          </CardBody>
        </Card>

        <Card data-tour="cliente-ficha-payments">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-text-muted" />
              <h2 className="font-semibold text-text-main">Historial de Pagos</h2>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {receivedCount} pago{receivedCount === 1 ? '' : 's'} recibido
              {receivedCount === 1 ? '' : 's'}
            </p>
          </CardHeader>
          <CardBody className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th>Fecha</Th>
                  <Th className="text-right">Monto</Th>
                  <Th>Tipo</Th>
                  <Th>Nota</Th>
                  <Th className="w-12"></Th>
                </Tr>
              </THead>
              <TBody>
                {payments.length === 0 ? (
                  <Tr>
                    <Td colSpan={5} className="py-8 text-center text-text-muted">
                      Sin pagos recibidos
                    </Td>
                  </Tr>
                ) : (
                  payments.map((p) => {
                    const isVoidRow = p.void_of != null
                    return (
                      <Tr key={p.id}>
                        <Td className="text-text-muted tabular-nums">
                          {formatDateTime(p.created_at)}
                        </Td>
                        <Td
                          className={cn(
                            'text-right font-medium tabular-nums',
                            isVoidRow
                              ? 'text-danger-700'
                              : p.is_voided
                                ? 'text-text-disabled line-through'
                                : 'text-success-700'
                          )}
                        >
                          {isVoidRow ? `−${formatGs(p.amount)}` : formatGs(p.amount)}
                        </Td>
                        <Td className="whitespace-nowrap">
                          {isVoidRow ? (
                            <Badge tone="neutral">
                              <span className="inline-flex items-center gap-1">
                                <Undo2 size={12} />
                                Anulación
                              </span>
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Badge tone={p.affects_cash ? 'success' : 'warning'}>
                                {p.affects_cash ? 'Efectivo' : 'Descuento de sueldo'}
                              </Badge>
                              {p.is_voided && <Badge tone="neutral">Anulado</Badge>}
                            </div>
                          )}
                        </Td>
                        <Td
                          className={cn(
                            'text-text-muted truncate max-w-[200px]',
                            p.is_voided && 'line-through'
                          )}
                        >
                          {p.note || <span className="text-text-disabled">—</span>}
                        </Td>
                        <Td className="text-right">
                          {!isVoidRow && !p.is_voided && (
                            <button
                              type="button"
                              onClick={() => handleVoidPayment(p)}
                              className="p-1.5 hover:bg-danger-50 rounded-lg text-text-muted hover:text-danger-700 transition-colors"
                              title="Anular pago"
                            >
                              <Ban size={14} />
                            </button>
                          )}
                        </Td>
                      </Tr>
                    )
                  })
                )}
              </TBody>
            </Table>
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
            <Button
              onClick={handlePayment}
              disabled={!payAmount || (payAffectsCash && !canPayCash)}
            >
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
            <label className="block text-sm text-text-muted mb-1.5">Tipo de pago</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPayAffectsCash(true)}
                className={cn(
                  'px-3 py-2 text-sm rounded-lg border transition-colors text-left',
                  payAffectsCash
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-border bg-surface text-text-muted hover:bg-surface-muted'
                )}
              >
                <span className="block font-medium">Efectivo</span>
                <span className="block text-xs">Afecta caja</span>
              </button>
              <button
                type="button"
                onClick={() => setPayAffectsCash(false)}
                className={cn(
                  'px-3 py-2 text-sm rounded-lg border transition-colors text-left',
                  !payAffectsCash
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-border bg-surface text-text-muted hover:bg-surface-muted'
                )}
              >
                <span className="block font-medium">Descuento de sueldo</span>
                <span className="block text-xs">No afecta caja</span>
              </button>
            </div>
            {payAffectsCash && !canPayCash && (
              <p className="mt-2 text-xs text-warning-700 bg-warning-50 border border-warning-200 rounded-lg px-3 py-2">
                Necesitás abrir caja para registrar pagos en efectivo.
              </p>
            )}
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
