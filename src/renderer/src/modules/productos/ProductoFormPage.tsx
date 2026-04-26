import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Category } from '@shared/types'

export default function ProductoFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const [categories, setCategories] = useState<Category[]>([])
  const [newCat, setNewCat] = useState('')
  const [form, setForm] = useState({
    name: '', category_id: '' as string | number, barcode: '',
    price: '', price_type: 'unit', stock: '0', min_stock: '0', active: true
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    window.api.products.categories().then(setCategories)
    if (isEdit) {
      window.api.products.getById(Number(id)).then((p) => {
        if (p) setForm({
          name: p.name, category_id: p.category_id || '',
          barcode: p.barcode || '', price: String(p.price),
          price_type: p.price_type, stock: String(p.stock),
          min_stock: String(p.min_stock), active: !!p.active
        })
      })
    }
  }, [id])

  const handleCreateCategory = async () => {
    if (!newCat.trim()) return
    const cat = await window.api.products.createCategory(newCat.trim())
    setCategories([...categories, cat])
    setForm({ ...form, category_id: cat.id })
    setNewCat('')
  }

  const handleSave = async () => {
    setLoading(true)
    const data = {
      name: form.name,
      category_id: form.category_id ? Number(form.category_id) : null,
      barcode: form.barcode || null,
      price: parseInt(form.price) || 0,
      price_type: form.price_type as 'unit' | 'kg',
      stock: parseFloat(form.stock) || 0,
      min_stock: parseFloat(form.min_stock) || 0,
      active: form.active
    }
    try {
      if (isEdit) {
        await window.api.products.update(Number(id), data)
      } else {
        await window.api.products.create(data)
      }
      navigate('/productos')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al guardar')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Editar Producto' : 'Nuevo Producto'}</h1>

      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm text-text-muted mb-1">Nombre *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Categoría</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full border rounded-lg p-2 bg-white">
              <option value="">Sin categoría</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex gap-1 mt-1">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nueva categoría"
                className="flex-1 border rounded px-2 py-1 text-sm" />
              <button onClick={handleCreateCategory} className="text-sm text-brand hover:underline px-2">Crear</button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Código de barras</label>
            <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Precio (Gs.) *</label>
            <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full border rounded-lg p-2 text-right focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Tipo de precio</label>
            <select value={form.price_type} onChange={(e) => setForm({ ...form, price_type: e.target.value })}
              className="w-full border rounded-lg p-2 bg-white">
              <option value="unit">Por unidad</option>
              <option value="kg">Por kg</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Stock inicial</label>
            <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
              step={form.price_type === 'kg' ? '0.01' : '1'}
              className="w-full border rounded-lg p-2 text-right focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">Stock mínimo</label>
            <input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
              className="w-full border rounded-lg p-2 text-right focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          Activo
        </label>

        <div className="flex gap-3 pt-4 border-t">
          <button onClick={() => navigate('/productos')} className="flex-1 border rounded-lg py-2 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={loading || !form.name || !form.price}
            className="flex-1 bg-brand text-white py-2 rounded-lg hover:bg-brand-hover disabled:opacity-50">
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
