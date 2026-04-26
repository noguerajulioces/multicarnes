import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatGs } from '../../lib/utils'
import { useAuthStore } from '../../store/auth.store'
import type { Product, Category } from '@shared/types'
import { Search, Plus, Edit2, AlertTriangle, Package } from 'lucide-react'

export default function ProductosPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<number | ''>('')
  const [filterStock, setFilterStock] = useState(false)
  const [adjustModal, setAdjustModal] = useState<Product | null>(null)
  const [newStock, setNewStock] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  useEffect(() => { window.api.products.categories().then(setCategories) }, [])

  useEffect(() => {
    const filters: Record<string, unknown> = { search: search || undefined, active: true }
    if (filterCat) filters.categoryId = filterCat
    if (filterStock) filters.lowStock = true
    window.api.products.getAll(filters).then(setProducts)
  }, [search, filterCat, filterStock])

  const handleAdjust = async () => {
    if (!adjustModal || !newStock || !adjustReason || !user) return
    await window.api.products.adjustStock(adjustModal.id, parseFloat(newStock), adjustReason, user.id)
    setAdjustModal(null)
    setNewStock('')
    setAdjustReason('')
    window.api.products.getAll({ search: search || undefined, active: true }).then(setProducts)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Productos</h1>
        <button onClick={() => navigate('/productos/nuevo')} className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover flex items-center gap-2">
          <Plus size={16} /> Nuevo Producto
        </button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-brand text-sm"
            placeholder="Buscar..." />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value ? Number(e.target.value) : '')}
          className="border rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm border rounded-lg px-3 bg-white cursor-pointer">
          <input type="checkbox" checked={filterStock} onChange={(e) => setFilterStock(e.target.checked)} />
          Stock bajo
        </label>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-secondary text-left text-text-muted">
              <th className="p-3">Nombre</th>
              <th className="p-3">Categoría</th>
              <th className="p-3 text-right">Precio</th>
              <th className="p-3">Tipo</th>
              <th className="p-3 text-right">Stock</th>
              <th className="p-3 text-right">Mín.</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium flex items-center gap-2">
                  {p.stock <= p.min_stock && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                  {p.name}
                </td>
                <td className="p-3 text-text-muted">{p.category_name || '-'}</td>
                <td className="p-3 text-right">{formatGs(p.price)}</td>
                <td className="p-3">{p.price_type === 'kg' ? 'Por kg' : 'Unidad'}</td>
                <td className={`p-3 text-right font-medium ${p.stock <= p.min_stock ? 'text-red-600' : ''}`}>
                  {p.price_type === 'kg' ? p.stock.toFixed(2) : p.stock}
                </td>
                <td className="p-3 text-right">{p.min_stock}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button onClick={() => navigate(`/productos/${p.id}`)} className="p-1.5 hover:bg-gray-100 rounded" title="Editar">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => { setAdjustModal(p); setNewStock(String(p.stock)) }} className="p-1.5 hover:bg-gray-100 rounded" title="Ajustar stock">
                      <Package size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-text-muted">No se encontraron productos</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {adjustModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold mb-4">Ajustar Stock: {adjustModal.name}</h3>
            <p className="text-sm text-text-muted mb-3">Stock actual: {adjustModal.stock}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-text-muted mb-1">Nuevo stock</label>
                <input type="number" value={newStock} onChange={(e) => setNewStock(e.target.value)}
                  step={adjustModal.price_type === 'kg' ? '0.01' : '1'}
                  className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand" autoFocus />
              </div>
              {newStock && (
                <p className="text-sm">Diferencia: <span className={`font-medium ${parseFloat(newStock) - adjustModal.stock >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {parseFloat(newStock) - adjustModal.stock >= 0 ? '+' : ''}{(parseFloat(newStock) - adjustModal.stock).toFixed(2)}
                </span></p>
              )}
              <div>
                <label className="block text-sm text-text-muted mb-1">Motivo (requerido)</label>
                <input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setAdjustModal(null)} className="flex-1 border rounded-lg py-2 hover:bg-gray-50">Cancelar</button>
                <button onClick={handleAdjust} disabled={!newStock || !adjustReason}
                  className="flex-1 bg-brand text-white py-2 rounded-lg hover:bg-brand-hover disabled:opacity-50">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
