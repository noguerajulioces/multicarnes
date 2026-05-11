import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'
import { useCashStore } from '../../store/cash.store'
import { formatGs, formatDateTime } from '../../lib/utils'
import type { CashMovement } from '@shared/types'
import { Plus, Minus, Wallet, Banknote, ArrowUpDown, Coins } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  KpiCard,
  Modal,
  MoneyInput,
  PageHeader,
  TourButton
} from '../../components/ui'
import { usePageTour } from '../../lib/use-page-tour'
import { cajaTourSteps, cajaManagerTourSteps } from '../../lib/tour-steps'
import { handleApiError } from '../../lib/api-error'

export default function CajaPage() {
  const user = useAuthStore((s) => s.user)
  const register = useCashStore((s) => s.register)
  const navigate = useNavigate()
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [summary, setSummary] = useState<{
    cashSales: number
    incomes: number
    expenses: number
  } | null>(null)
  const [modal, setModal] = useState<{ type: 'income' | 'expense' } | null>(null)
  const [movAmount, setMovAmount] = useState(0)
  const [movDesc, setMovDesc] = useState('')

  useEffect(() => {
    if (!register) {
      navigate('/caja/apertura')
      return
    }
    loadData()
  }, [register])

  const loadData = async (): Promise<void> => {
    if (!register) return
    const [movs, sum] = await Promise.all([
      window.api.cash.getMovements(register.id),
      window.api.cash.getSummary(register.id)
    ])
    setMovements(movs)
    setSummary(sum as typeof summary)
  }

  const handleAddMovement = async (): Promise<void> => {
    if (!register || !user || !modal || !movAmount || !movDesc) return
    try {
      await window.api.cash.addMovement(register.id, user.id, modal.type, movAmount, movDesc)
    } catch (err) {
      handleApiError(err)
      return
    }
    setModal(null)
    setMovAmount(0)
    setMovDesc('')
    loadData()
  }

  const closeModal = (): void => {
    setModal(null)
    setMovAmount(0)
    setMovDesc('')
  }

  const expectedCash = register
    ? register.opening_amount +
      (summary?.cashSales || 0) +
      (summary?.incomes || 0) -
      (summary?.expenses || 0)
    : 0

  const canClose = user?.role === 'admin' || user?.role === 'supervisor'

  const tourSteps = canClose ? cajaManagerTourSteps : cajaTourSteps
  const { startTour } = usePageTour({
    key: canClose ? 'caja-manager' : 'caja',
    steps: tourSteps,
    ready: !!summary
  })

  if (!register) return null

  return (
    <div className="space-y-5">
      <PageHeader
        title="Caja Actual"
        subtitle="Movimientos del turno en curso"
        actions={
          <>
            <TourButton onClick={startTour} />
            {canClose && (
              <button
                data-tour="caja-close"
                onClick={() => navigate('/caja/cierre')}
                className="bg-brand text-white px-4 py-2.5 rounded-xl font-medium hover:bg-brand-hover flex items-center gap-2 shadow-sm transition-colors"
              >
                Cerrar Caja
              </button>
            )}
          </>
        }
      />

      <div data-tour="caja-kpis" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          gradient="blue"
          icon={<Wallet size={20} />}
          label="Apertura"
          value={formatGs(register.opening_amount)}
          hint="monto inicial"
        />
        <KpiCard
          gradient="green"
          icon={<Banknote size={20} />}
          label="Ventas Efectivo"
          value={formatGs(summary?.cashSales || 0)}
          hint="ingresadas en caja"
        />
        <KpiCard
          gradient="purple"
          icon={<ArrowUpDown size={20} />}
          label="Ingresos / Egresos"
          value={`+${formatGs(summary?.incomes || 0)}`}
          hint={`-${formatGs(summary?.expenses || 0)}`}
        />
        <KpiCard
          gradient="teal"
          icon={<Coins size={20} />}
          label="Efectivo Esperado"
          value={formatGs(expectedCash)}
          hint="al cierre"
        />
      </div>

      <div data-tour="caja-movements-actions" className="flex flex-wrap gap-3">
        <Button variant="success" onClick={() => setModal({ type: 'income' })}>
          <Plus size={16} /> Registrar Ingreso
        </Button>
        <Button variant="danger" onClick={() => setModal({ type: 'expense' })}>
          <Minus size={16} /> Registrar Egreso
        </Button>
      </div>

      <Card
        data-tour="caja-movements-list"
        className="rounded-2xl"
        style={{ boxShadow: 'var(--shadow-card-soft)' }}
      >
        <CardHeader>
          <h2 className="font-semibold text-text-main">Movimientos del Turno</h2>
          <p className="text-xs text-text-muted">
            {movements.length} movimiento{movements.length === 1 ? '' : 's'} registrado
            {movements.length === 1 ? '' : 's'}
          </p>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="pb-2 font-normal pr-3">Hora</th>
                  <th className="pb-2 font-normal pr-3">Tipo</th>
                  <th className="pb-2 font-normal pr-3">Descripción</th>
                  <th className="pb-2 font-normal text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-text-muted">
                      Sin movimientos en este turno
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-border last:border-0 hover:bg-surface-muted/50"
                    >
                      <td className="py-2.5 pr-3 text-text-muted tabular-nums">
                        {formatDateTime(m.created_at)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={m.type === 'income' ? 'success' : 'danger'}>
                          {m.type === 'income' ? 'Ingreso' : 'Egreso'}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3">{m.description}</td>
                      <td className="py-2.5 text-right font-medium tabular-nums">
                        {formatGs(m.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={modal !== null}
        onClose={closeModal}
        size="sm"
        title={`Registrar ${modal?.type === 'income' ? 'Ingreso' : 'Egreso'}`}
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              variant={modal?.type === 'income' ? 'success' : 'danger'}
              onClick={handleAddMovement}
              disabled={!movAmount || !movDesc}
            >
              Guardar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-muted mb-1.5">Descripción</label>
            <Input
              value={movDesc}
              onChange={(e) => setMovDesc(e.target.value)}
              placeholder="Motivo del movimiento"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1.5">Monto (Gs.)</label>
            <MoneyInput
              value={movAmount}
              onValueChange={setMovAmount}
              className="text-right"
              placeholder="0"
            />
            {movAmount > 0 && (
              <p className="text-xs text-text-muted mt-1 text-right">{formatGs(movAmount)}</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
