import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatGs } from '../../lib/utils'
import type { Customer } from '@shared/types'
import { Search, Plus, Eye } from 'lucide-react'

export default function ClientesPage() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', address: '', is_employee: false })
  const [editId, setEditId] = useState<number | null>(null)

  useEffect(() => {
    window.api.customers.getAll(search || undefined).then(setCustomers)
  }, [search])

  const handleSave = async () => {
    if (!form.name) return
    if (editId) {
      await window.api.customers.update(editId, form)
    } else {
      await window.api.customers.create(form)
    }
    setShowForm(false)
    setForm({ name: '', phone: '', address: '', is_employee: false })
    setEditId(null)
    window.api.customers.getAll(search || undefined).then(setCustomers)
  }

  const handleEdit = (c: Customer) => {
    setForm({ name: c.name, phone: c.phone || '', address: c.address || '', is_employee: !!c.is_employee })
    setEditId(c.id)
    setShowForm(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', phone: '', address: '', is_employee: false }) }}
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover flex items-center gap-2">
          <Plus size={16} /> Nuevo Cliente
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm"
          placeholder="Buscar por nombre..." />
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-secondary text-left text-text-muted">
              <th className="p-3">Nombre</th>
              <th className="p-3">Teléfono</th>
              <th className="p-3 text-right">Saldo</th>
              <th className="p-3">Empleado</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 text-text-muted">{c.phone || '-'}</td>
                <td className={`p-3 text-right font-medium ${c.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatGs(c.balance)}
                </td>
                <td className="p-3">{c.is_employee ? 'Sí' : 'No'}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button onClick={() => navigate(`/clientes/${c.id}`)} className="p-1.5 hover:bg-gray-100 rounded" title="Ver ficha">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => handleEdit(c)} className="p-1.5 hover:bg-gray-100 rounded text-xs text-brand">Editar</button>
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-text-muted">No se encontraron clientes</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold mb-4">{editId ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
            <div className="space-y-3">
              <div><label className="block text-sm text-text-muted mb-1">Nombre *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand" autoFocus /></div>
              <div><label className="block text-sm text-text-muted mb-1">Teléfono</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand" /></div>
              <div><label className="block text-sm text-text-muted mb-1">Dirección</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand" /></div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_employee} onChange={(e) => setForm({ ...form, is_employee: e.target.checked })} />
                Es empleado
              </label>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 border rounded-lg py-2 hover:bg-gray-50">Cancelar</button>
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
