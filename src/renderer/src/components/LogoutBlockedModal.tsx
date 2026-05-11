import { AlertTriangle, DollarSign } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import type { LogoutGuardState } from '../hooks/use-logout-guard'

interface LogoutBlockedModalProps {
  state: LogoutGuardState
  onClose: () => void
  onProceed: () => void
  onRetry: () => void
}

function formatOpenedAt(opened: string): string {
  // opened_at is stored as 'YYYY-MM-DD HH:MM:SS' in localtime. Show date + time
  // in es-PY style without forcing a full Date parse (sqlite local strings are
  // not always ISO-compliant).
  return opened.replace('T', ' ').slice(0, 16)
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(amount)
}

export function LogoutBlockedModal({
  state,
  onClose,
  onProceed,
  onRetry
}: LogoutBlockedModalProps) {
  const open = state.kind === 'block' || state.kind === 'error'

  if (state.kind === 'error') {
    return (
      <Modal
        open={open}
        onClose={onClose}
        size="sm"
        closeOnBackdrop={false}
        title={
          <span className="flex items-center gap-2 text-danger-700">
            <AlertTriangle size={18} />
            No se pudo verificar el estado de la caja
          </span>
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={onRetry}>
              Reintentar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-main">
          Volvé a intentarlo. No vamos a cerrar tu sesión hasta confirmar que no quedó una caja
          abierta a tu nombre.
        </p>
        <p className="mt-2 text-xs text-text-muted">{state.message}</p>
      </Modal>
    )
  }

  if (state.kind !== 'block') return null

  const register = state.openRegister

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      closeOnBackdrop={false}
      title={
        <span className="flex items-center gap-2 text-warning-700">
          <AlertTriangle size={18} />
          No podés cerrar sesión con la caja abierta
        </span>
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onProceed}>
            Cerrar caja ahora
          </Button>
        </div>
      }
    >
      <p className="text-sm text-text-main">
        Tenés una caja abierta a tu nombre. Cerrala antes de cerrar sesión para que el corte refleje
        el conteo físico.
      </p>
      <div className="mt-3 rounded-md border border-border bg-surface-muted p-3 text-sm text-text-main">
        <div className="flex items-center gap-2 font-medium">
          <DollarSign size={14} className="text-text-muted" />
          Caja abierta
        </div>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-text-muted">Apertura</dt>
          <dd className="font-medium tabular-nums">{formatOpenedAt(register.opened_at)}</dd>
          <dt className="text-text-muted">Monto inicial</dt>
          <dd className="font-medium tabular-nums">Gs. {formatAmount(register.opening_amount)}</dd>
        </dl>
      </div>
    </Modal>
  )
}
