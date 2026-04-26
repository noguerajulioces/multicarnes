import { useState, useEffect } from 'react'
import type { User } from '@shared/types'
import { Plus } from 'lucide-react'

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', role: 'cajero', pin: '', confirmPin: '', active: true })
  const [error, setError] = useState('')

  useEffect(() => { window.api.users.getAll().then(setUsers) }, [])

  const handleSave = async () => {
    setError('')
    if (!form.name) { setError('Nombre requerido'); return }
    if (!editId && !form.pin) { setError('PIN requerido'); return }
    if (form.pin && form.pin.length < 4) { setError('PIN mínimo 4 dígitos'); return }
    if (form.pin && form.pin !== form.confirmPin) { setError('PINs no coinciden'); return }

    if (editId) {
      const data: Record<string, unknown> = { name: form.name, role: form.role, active: form.active }
      if (form.pin) data.pin = form.pin
      await window.api.users.update(editId, data)
    } else {
      await window.api.users.create({ name: form.name, role: form.role, pin: form.pin })
    }
    setShowForm(false); setEditId(null)
    setForm({ name: '', role: 'cajero', pin: '', confirmPin: '', active: true })
    window.api.users.getAll().then(setUsers)
  }

  const handleEdit = (u: User) => {
    setForm({ name: u.name, role: u.role, pin: '', confirmPin: '', active: !!u.active })
    setEditId(u.id); setShowForm(true); setError('')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', role: 'cajero', pin: '', confirmPin: '', active: true }); setError('') }}
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover flex items-center gap-2">
          <Plus size={16} /> Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-bg-secondary text-left text-text-muted">
            <th className="p-3">Nombre</th><th className="p-3">Rol</th><th className="p-3">Estado</th><th className="p-3">Acciones</th>
          </tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{u.name}</td>
                <td className="p-3 capitalize">{u.role}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="p-3">
                  <button onClick={() => handleEdit(u)} className="text-brand text-xs hover:underline">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold mb-4">{editId ? 'Editar' : 'Nuevo'} Usuario</h3>
            <div className="space-y-3">
              <div><label className="block text-sm text-text-muted mb-1">Nombre *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border rounded-lg p-2" autoFocus /></div>
              <div><label className="block text-sm text-text-muted mb-1">Rol</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-white">
                  <option value="admin">Admin</option><option value="supervisor">Supervisor</option><option value="cajero">Cajero</option>
                </select></div>
              <div><label className="block text-sm text-text-muted mb-1">PIN (4-6 dígitos){editId ? ' — dejar vacío para no cambiar' : ' *'}</label>
                <input type="password" inputMode="numeric" maxLength={6} value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                  className="w-full border rounded-lg p-2" /></div>
              <div><label className="block text-sm text-text-muted mb-1">Confirmar PIN</label>
                <input type="password" inputMode="numeric" maxLength={6} value={form.confirmPin}
                  onChange={(e) => setForm({ ...form, confirmPin: e.target.value.replace(/\D/g, '') })}
                  className="w-full border rounded-lg p-2" /></div>
              {editId && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  Activo
                </label>
              )}
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 border rounded-lg py-2 hover:bg-gray-50">Cancelar</button>
                <button onClick={handleSave}
                  className="flex-1 bg-brand text-white py-2 rounded-lg hover:bg-brand-hover">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
