import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Supplier } from '@shared/types'
import { Plus } from 'lucide-react'

export default function ProveedoresPage() {
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' })

  useEffect(() => { window.api.suppliers.getAll().then(setSuppliers) }, [])

  const handleSave = async () => {
    if (!form.name) return
    if (editId) { await window.api.suppliers.update(editId, form) }
    else { await window.api.suppliers.create(form) }
    setShowForm(false); setEditId(null)
    setForm({ name: '', phone: '', email: '', address: '' })
    window.api.suppliers.getAll().then(setSuppliers)
  }

  const handleEdit = (s: Supplier) => {
    setForm({ name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '' })
    setEditId(s.id); setShowForm(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate('/compras')} className="text-sm text-brand hover:underline">← Compras</button>
          <h1 className="text-2xl font-bold">Proveedores</h1>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', phone: '', email: '', address: '' }) }}
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover flex items-center gap-2">
          <Plus size={16} /> Nuevo Proveedor
        </button>
      </div>

      <div className="bg-surface rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-bg-secondary text-left text-text-muted">
            <th className="p-3">Nombre</th><th className="p-3">Teléfono</th><th className="p-3">Email</th><th className="p-3">Acciones</th>
          </tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-b hover:bg-surface-muted">
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3 text-text-muted">{s.phone || '-'}</td>
                <td className="p-3 text-text-muted">{s.email || '-'}</td>
                <td className="p-3">
                  <button onClick={() => handleEdit(s)} className="text-brand text-xs hover:underline">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold mb-4">{editId ? 'Editar' : 'Nuevo'} Proveedor</h3>
            <div className="space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nombre *" className="w-full border rounded-lg p-2" autoFocus />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Teléfono" className="w-full border rounded-lg p-2" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email" className="w-full border rounded-lg p-2" />
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Dirección" className="w-full border rounded-lg p-2" />
              <div className="flex gap-3">
                <button onClick={() => setShowForm(false)} className="flex-1 border rounded-lg py-2 hover:bg-surface-muted">Cancelar</button>
                <button onClick={handleSave} disabled={!form.name}
                  className="flex-1 bg-brand text-white py-2 rounded-lg hover:bg-brand-hover disabled:opacity-50">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
