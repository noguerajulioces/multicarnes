import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'
import { formatGs } from '../../lib/utils'
import type { Supplier, Product } from '@shared/types'
import { Plus, Trash2 } from 'lucide-react'

interface OrderItem {
  productId: number; productName: string; quantity: number; unitCost: number; subtotal: number
}

export default function NuevaCompraPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [items, setItems] = useState<OrderItem[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchProduct, setSearchProduct] = useState('')
  const [showProductSearch, setShowProductSearch] = useState(false)

  useEffect(() => {
    window.api.suppliers.getAll().then(setSuppliers)
  }, [])

  useEffect(() => {
    if (searchProduct.length >= 2) {
      window.api.products.getAll({ search: searchProduct }).then(setProducts)
    }
  }, [searchProduct])

  const addItem = (p: Product) => {
    if (items.find((i) => i.productId === p.id)) return
    setItems([...items, { productId: p.id, productName: p.name, quantity: 1, unitCost: 0, subtotal: 0 }])
    setShowProductSearch(false)
    setSearchProduct('')
  }

  const updateItem = (idx: number, field: string, value: number) => {
    setItems(items.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      updated.subtotal = Math.round(updated.quantity * updated.unitCost)
      return updated
    }))
  }

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx))
  const total = items.reduce((sum, i) => sum + i.subtotal, 0)

  const handleSave = async (receive: boolean) => {
    if (!user || items.length === 0) return
    setLoading(true)
    try {
      await window.api.purchases.create({
        supplierId: supplierId || null, userId: user.id,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost, subtotal: i.subtotal })),
        total, notes: notes || undefined, receive
      })
      navigate('/compras')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nueva Orden de Compra</h1>
      <div className="bg-surface rounded-lg shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm text-text-muted mb-1">Proveedor</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
            className="w-full border rounded-lg p-2 bg-surface">
            <option value="">Seleccionar...</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-text-muted">Items</label>
            <button onClick={() => setShowProductSearch(true)} className="text-sm text-brand flex items-center gap-1 hover:underline">
              <Plus size={14} /> Agregar producto
            </button>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-text-muted text-left">
              <th className="pb-2">Producto</th><th className="pb-2 w-24">Cantidad</th>
              <th className="pb-2 w-32">Costo unit.</th><th className="pb-2 w-28 text-right">Subtotal</th><th className="pb-2 w-8"></th>
            </tr></thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.productId} className="border-b">
                  <td className="py-2">{item.productName}</td>
                  <td className="py-2"><input type="number" value={item.quantity} min={0.01} step={0.01}
                    onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-full border rounded p-1 text-right text-sm" /></td>
                  <td className="py-2"><input type="number" value={item.unitCost}
                    onChange={(e) => updateItem(idx, 'unitCost', parseInt(e.target.value) || 0)}
                    className="w-full border rounded p-1 text-right text-sm" /></td>
                  <td className="py-2 text-right font-medium">{formatGs(item.subtotal)}</td>
                  <td className="py-2"><button onClick={() => removeItem(idx)} className="text-red-500 p-1"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-right text-lg font-bold mt-2">Total: {formatGs(total)}</div>
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-1">Notas</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-brand" rows={2} />
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button onClick={() => navigate('/compras')} className="flex-1 border rounded-lg py-2 hover:bg-surface-muted">Cancelar</button>
          <button onClick={() => handleSave(false)} disabled={loading || items.length === 0}
            className="flex-1 border border-brand text-brand py-2 rounded-lg hover:bg-brand-light disabled:opacity-50">
            Guardar Pendiente
          </button>
          <button onClick={() => handleSave(true)} disabled={loading || items.length === 0}
            className="flex-1 bg-brand text-white py-2 rounded-lg hover:bg-brand-hover disabled:opacity-50">
            Guardar y Recibir
          </button>
        </div>
      </div>

      {showProductSearch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="font-semibold mb-3">Buscar Producto</h3>
            <input value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)}
              className="w-full border rounded-lg p-2 mb-3 focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="Nombre o código..." autoFocus />
            <div className="max-h-60 overflow-y-auto">
              {products.map((p) => (
                <button key={p.id} onClick={() => addItem(p)}
                  className="w-full text-left px-3 py-2 hover:bg-surface-muted text-sm border-b">{p.name}</button>
              ))}
            </div>
            <button onClick={() => { setShowProductSearch(false); setSearchProduct('') }}
              className="w-full mt-3 border rounded-lg py-2 hover:bg-surface-muted text-sm">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
