import { useEffect, useState } from 'react'
import { KeyRound, ShieldCheck, UserCircle2 } from 'lucide-react'
import type { Role, User } from '@shared/types'
import { Badge, Button, Card, Input, Modal, PageHeader, TourButton } from '../../components/ui'
import { useAuthStore } from '../../store/auth.store'
import { useToastStore } from '../../store/toast.store'
import { usePageTour } from '../../lib/use-page-tour'
import { perfilTourSteps } from '../../lib/tour-steps'

const roleTone: Record<Role, 'brand' | 'info' | 'neutral'> = {
  admin: 'brand',
  supervisor: 'info',
  cajero: 'neutral'
}

const roleLabel: Record<Role, string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  cajero: 'Cajero'
}

const emptyPinForm = { current: '', next: '', confirm: '' }

export default function PerfilPage() {
  const sessionUser = useAuthStore((s) => s.user)
  const pushToast = useToastStore((s) => s.push)
  const [profile, setProfile] = useState<User | null>(null)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinForm, setPinForm] = useState(emptyPinForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!sessionUser) return
    window.api.users.getById(sessionUser.id).then((u) => setProfile(u as User | null))
  }, [sessionUser])

  const { startTour } = usePageTour({
    key: 'perfil',
    steps: perfilTourSteps,
    ready: !!sessionUser
  })

  if (!sessionUser) return null
  const user = profile ?? sessionUser

  const initials =
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('') || user.name.charAt(0).toUpperCase()

  const closePinModal = (): void => {
    setShowPinModal(false)
    setPinForm(emptyPinForm)
    setError('')
  }

  const handleChangePin = async (): Promise<void> => {
    setError('')
    if (pinForm.current.length !== 6 || pinForm.next.length !== 6) {
      setError('El PIN debe tener exactamente 6 dígitos')
      return
    }
    if (pinForm.next !== pinForm.confirm) {
      setError('Los PINs nuevos no coinciden')
      return
    }
    if (pinForm.next === pinForm.current) {
      setError('El PIN nuevo debe ser distinto al actual')
      return
    }

    setSaving(true)
    try {
      const verified = (await window.api.users.login(user.id, pinForm.current)) as User | null
      if (!verified) {
        setError('El PIN actual es incorrecto')
        return
      }
      await window.api.users.update(user.id, { pin: pinForm.next })
      pushToast('success', 'PIN actualizado correctamente')
      closePinModal()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el PIN')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mi perfil"
        subtitle="Información de tu cuenta y seguridad"
        actions={<TourButton onClick={startTour} />}
      />

      <Card
        data-tour="perfil-info"
        className="rounded-2xl p-6"
        style={{ boxShadow: 'var(--shadow-card-soft)' }}
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-light text-brand text-xl font-semibold flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text-main truncate">{user.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge tone={roleTone[user.role]}>{roleLabel[user.role]}</Badge>
              <Badge tone={user.active ? 'success' : 'danger'}>
                {user.active ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-border">
          <InfoRow icon={<UserCircle2 size={16} />} label="ID de usuario" value={`#${user.id}`} />
          <InfoRow icon={<ShieldCheck size={16} />} label="Rol" value={roleLabel[user.role]} />
          <InfoRow
            icon={<UserCircle2 size={16} />}
            label="Miembro desde"
            value={formatMemberSince(user.created_at)}
          />
        </div>
      </Card>

      <Card
        data-tour="perfil-pin"
        className="rounded-2xl p-6"
        style={{ boxShadow: 'var(--shadow-card-soft)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-warning-50 text-warning-700 flex items-center justify-center shrink-0">
              <KeyRound size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-text-main">PIN de acceso</h3>
              <p className="text-sm text-text-muted mt-0.5">
                Cambialo periódicamente. Necesitarás ingresar tu PIN actual para confirmar.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowPinModal(true)}>Cambiar PIN</Button>
        </div>
      </Card>

      <Modal
        open={showPinModal}
        onClose={saving ? () => undefined : closePinModal}
        size="sm"
        title="Cambiar PIN"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={closePinModal} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleChangePin} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar nuevo PIN'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-text-muted mb-1.5">
              PIN actual <span className="text-danger-500">*</span>
            </label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinForm.current}
              onChange={(e) =>
                setPinForm({ ...pinForm, current: e.target.value.replace(/\D/g, '') })
              }
              placeholder="••••••"
              showToggle
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">
              PIN nuevo <span className="text-danger-500">*</span>
            </label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinForm.next}
              onChange={(e) => setPinForm({ ...pinForm, next: e.target.value.replace(/\D/g, '') })}
              placeholder="••••••"
              showToggle
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">
              Confirmar PIN nuevo <span className="text-danger-500">*</span>
            </label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinForm.confirm}
              onChange={(e) =>
                setPinForm({ ...pinForm, confirm: e.target.value.replace(/\D/g, '') })
              }
              placeholder="••••••"
              showToggle
            />
          </div>

          {error && (
            <div className="px-3 py-2 bg-danger-50 text-danger-700 rounded-lg text-sm">{error}</div>
          )}
        </div>
      </Modal>
    </div>
  )
}

function formatMemberSince(value: string | undefined | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-PY', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

interface InfoRowProps {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}

function InfoRow({ icon, label, value }: InfoRowProps): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-surface-muted text-text-muted flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-sm font-medium text-text-main truncate">{value}</p>
      </div>
    </div>
  )
}
