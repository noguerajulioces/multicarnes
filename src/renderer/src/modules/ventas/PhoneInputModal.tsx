import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Button, Input, Modal } from '../../components/ui'
import { normalizePhone, type NormalizedPhone } from '../../lib/phone'

interface Props {
  onConfirm: (phone: string) => void
  onClose: () => void
}

const REASON_LABEL: Record<Exclude<NormalizedPhone, { ok: true }>['reason'], string> = {
  empty: 'Ingresá un número de teléfono.',
  invalid_chars: 'El número contiene caracteres no permitidos.',
  too_short: 'El número es demasiado corto.',
  too_long: 'El número es demasiado largo.'
}

export default function PhoneInputModal({ onConfirm, onClose }: Props): React.ReactElement {
  const [raw, setRaw] = useState('')
  const [touched, setTouched] = useState(false)
  const result = normalizePhone(raw)
  const error = touched && !result.ok ? REASON_LABEL[result.reason] : null
  const ready = result.ok

  const handleSubmit = (): void => {
    setTouched(true)
    if (result.ok) onConfirm(result.phone)
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={
        <div className="flex items-center gap-2">
          <MessageCircle size={18} />
          <span>Enviar por WhatsApp</span>
        </div>
      }
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!ready}>
            Continuar
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        <label className="block text-sm text-text-muted">Número de WhatsApp del cliente</label>
        <Input
          autoFocus
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value)
            if (!touched) setTouched(true)
          }}
          placeholder="0981 123 456 o +595 981 123 456"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
        />
        {error ? (
          <p className="text-xs text-danger-700">{error}</p>
        ) : (
          <p className="text-xs text-text-muted">
            Si no incluís código de país, asumimos Paraguay (+595).
          </p>
        )}
      </div>
    </Modal>
  )
}
