import { useConfirmStore } from '../../store/confirm.store'
import { Modal } from './Modal'
import { Button } from './Button'

export function ConfirmHost() {
  const request = useConfirmStore((s) => s.request)
  const close = useConfirmStore((s) => s.close)

  return (
    <Modal
      open={request != null}
      onClose={() => close(false)}
      title={request?.title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => close(false)}>
            {request?.cancelLabel ?? 'Cancelar'}
          </Button>
          <Button
            variant={request?.danger ? 'danger' : 'primary'}
            onClick={() => close(true)}
            autoFocus
          >
            {request?.confirmLabel ?? 'Confirmar'}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-text-muted whitespace-pre-line">{request?.message}</p>
    </Modal>
  )
}
