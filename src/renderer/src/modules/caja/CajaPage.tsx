import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'
import { useCashStore } from '../../store/cash.store'
import { formatGs, formatDateTime } from '../../lib/utils'
import type { CashMovement, CashMovementType } from '@shared/types'
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
  Table,
  TBody,
  Td,
  Th,
  THead,
  TourButton,
  Tr
} from '../../components/ui'
import { usePageTour } from '../../lib/use-page-tour'
import { cajaTourSteps, cajaManagerTourSteps } from '../../lib/tour-steps'
import { handleApiError } from '../../lib/api-error'

const TYPE_META: Record<
  CashMovementType,
  { label: string; tone: 'success' | 'danger' | 'info' | 'neutral' }
> = {
  income: { label: 'Ingreso', tone: 'success' },
  expense: { label: 'Egreso', tone: 'danger' },
  opening: { label: 'Apertura', tone: 'info' },
  closing: { label: 'Cierre', tone: 'info' },
  void: { label: 'Anulación', tone: 'neutral' }
}

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
              <Button data-tour="caja-close" onClick={() => navigate('/caja/cierre')}>
                Cerrar Caja
              </Button>
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
      >
        <CardHeader>
          <h2 className="font-semibold text-text-main">Movimientos del Turno</h2>
          <p className="text-xs text-text-muted">
            {movements.length} movimiento{movements.length === 1 ? '' : 's'} registrado
            {movements.length === 1 ? '' : 's'}
          </p>
        </CardHeader>
        <CardBody>
          <Table>
            <THead>
              <Tr>
                <Th>Hora</Th>
                <Th>Tipo</Th>
                <Th>Descripción</Th>
                <Th className="text-right">Monto</Th>
              </Tr>
            </THead>
            <TBody>
              {movements.length === 0 ? (
                <Tr>
                  <Td colSpan={4} className="py-8 text-center text-text-muted">
                    Sin movimientos en este turno
                  </Td>
                </Tr>
              ) : (
                movements.map((m) => (
                  <Tr key={m.id}>
                    <Td className="text-text-muted tabular-nums">
                      {formatDateTime(m.created_at)}
                    </Td>
                    <Td>
                      <Badge tone={TYPE_META[m.type].tone}>{TYPE_META[m.type].label}</Badge>
                    </Td>
                    <Td>{m.description}</Td>
                    <Td className="text-right font-medium tabular-nums">{formatGs(m.amount)}</Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
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
