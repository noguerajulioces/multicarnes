import { useState, useEffect } from 'react'
import type { Role, User } from '@shared/types'
import { Edit2, Plus, Users } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select
} from '../../components/ui'

const emptyForm = { name: '', role: 'cajero' as Role, pin: '', confirmPin: '', active: true }

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

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.users.getAll().then(setUsers)
  }, [])

  const reload = (): void => {
    window.api.users.getAll().then(setUsers)
  }

  const closeForm = (): void => {
    setShowForm(false)
    setEditId(null)
    setForm(emptyForm)
    setError('')
  }

  const handleSave = async (): Promise<void> => {
    setError('')
    if (!form.name) {
      setError('Nombre requerido')
      return
    }
    if (!editId && !form.pin) {
      setError('PIN requerido')
      return
    }
    if (form.pin && form.pin.length < 4) {
      setError('PIN mínimo 4 dígitos')
      return
    }
    if (form.pin && form.pin !== form.confirmPin) {
      setError('Los PINs no coinciden')
      return
    }

    if (editId) {
      const data: Record<string, unknown> = { name: form.name, role: form.role, active: form.active }
      if (form.pin) data.pin = form.pin
      await window.api.users.update(editId, data)
    } else {
      await window.api.users.create({ name: form.name, role: form.role, pin: form.pin })
    }
    closeForm()
    reload()
  }

  const handleEdit = (u: User): void => {
    setForm({
      name: u.name,
      role: u.role,
      pin: '',
      confirmPin: '',
      active: !!u.active
    })
    setEditId(u.id)
    setShowForm(true)
    setError('')
  }

  const handleNew = (): void => {
    setForm(emptyForm)
    setEditId(null)
    setShowForm(true)
    setError('')
  }

  const initialsOf = (name: string): string =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('') || name.charAt(0).toUpperCase()

  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuarios"
        subtitle={`${users.length} usuario${users.length === 1 ? '' : 's'} registrado${users.length === 1 ? '' : 's'}`}
        actions={
          <button
            onClick={handleNew}
            className="bg-brand text-white px-4 py-2.5 rounded-xl font-medium hover:bg-brand-hover flex items-center gap-2 shadow-sm transition-colors"
          >
            <Plus size={18} />
            Nuevo Usuario
          </button>
        }
      />

      <Card className="rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-muted/60 text-left text-text-muted">
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-border hover:bg-surface-muted/40 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-light text-brand text-sm font-semibold flex items-center justify-center shrink-0">
                        {initialsOf(u.name)}
                      </div>
                      <span className="font-medium text-text-main">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={roleTone[u.role]}>{roleLabel[u.role]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.active ? 'success' : 'danger'}>
                      {u.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleEdit(u)}
                        className="p-1.5 hover:bg-surface-muted rounded-lg text-text-muted hover:text-text-main transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon={<Users size={40} />}
                      title="Sin usuarios"
                      description="Agregá los usuarios que van a operar el sistema."
                      action={
                        <Button onClick={handleNew}>
                          <Plus size={16} /> Nuevo Usuario
                        </Button>
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={showForm}
        onClose={closeForm}
        size="sm"
        title={editId ? 'Editar Usuario' : 'Nuevo Usuario'}
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={closeForm}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>{editId ? 'Guardar cambios' : 'Crear'}</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-text-muted mb-1.5">
              Nombre <span className="text-danger-500">*</span>
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">Rol</label>
            <Select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              <option value="admin">Admin — acceso total</option>
              <option value="supervisor">Supervisor — gestión sin usuarios</option>
              <option value="cajero">Cajero — sólo ventas y caja</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">
              PIN (4-6 dígitos)
              {editId ? (
                <span className="text-text-disabled ml-1">— dejar vacío para no cambiar</span>
              ) : (
                <span className="text-danger-500 ml-1">*</span>
              )}
            </label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
              placeholder="••••"
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">Confirmar PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={form.confirmPin}
              onChange={(e) => setForm({ ...form, confirmPin: e.target.value.replace(/\D/g, '') })}
              placeholder="••••"
            />
          </div>

          {editId && (
            <label className="flex items-center gap-2 text-sm pt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="w-4 h-4 rounded accent-brand"
              />
              <span className="text-text-main">Usuario activo</span>
              <span className="text-xs text-text-muted">— puede iniciar sesión</span>
            </label>
          )}

          {error && (
            <div className="px-3 py-2 bg-danger-50 text-danger-700 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
