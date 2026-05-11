import { Modal, Button } from '../../components/ui'
import { formatGs } from '../../lib/utils'

interface MixedCancellationModalProps {
  open: boolean
  cashPortion: number
  creditPortion: number
  customerName: string
  onCancel: () => void
  onConfirm: (refund: boolean) => void
}

export default function MixedCancellationModal({
  open,
  cashPortion,
  creditPortion,
  customerName,
  onCancel,
  onConfirm
}: MixedCancellationModalProps): React.ReactElement {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Anular venta mixta"
      size="md"
      closeOnBackdrop={false}
    >
      <div className="space-y-4 text-sm">
        <p>
          Esta venta se cobró con dos métodos. ¿Querés{' '}
          <strong>devolver la porción de crédito</strong> al saldo del cliente{' '}
          <strong>{customerName}</strong>?
        </p>

        <div className="rounded-lg border border-border divide-y divide-border">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-text-muted">Pagado en efectivo / otros</span>
            <span className="font-medium tabular-nums">{formatGs(cashPortion)}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-surface-muted/50">
            <span className="text-text-muted">Pagado a crédito</span>
            <span className="font-medium tabular-nums">{formatGs(creditPortion)}</span>
          </div>
        </div>

        <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-900">
          <p className="font-medium">¿Qué pasa con cada opción?</p>
          <ul className="mt-1 list-disc list-inside space-y-1">
            <li>
              <strong>Devolver crédito:</strong> el saldo del cliente baja en{' '}
              {formatGs(creditPortion)}.
            </li>
            <li>
              <strong>No devolver:</strong> el cliente mantiene la deuda (la cobranza se gestiona
              aparte).
            </li>
          </ul>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel} className="sm:flex-1">
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => onConfirm(false)} className="sm:flex-1">
            No devolver
          </Button>
          <Button variant="primary" onClick={() => onConfirm(true)} className="sm:flex-1">
            Devolver crédito
          </Button>
        </div>
      </div>
    </Modal>
  )
}
