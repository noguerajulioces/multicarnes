import { useState, useEffect, useRef } from 'react'
import { useCartStore } from '../../store/cart.store'
import { useCashStore } from '../../store/cash.store'
import { formatGs } from '../../lib/utils'
import type { Product } from '@shared/types'
import { Search, Trash2, Plus, Minus } from 'lucide-react'
import CobroModal from './CobroModal'

export default function VentasPage() {
  const register = useCashStore((s) => s.register)
  const { items, discount, addItem, updateQuantity, removeItem, setDiscount, clear, subtotal, total } = useCartStore()
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [quantityModal, setQuantityModal] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState('')
  const [showCobro, setShowCobro] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const barcodeBuffer = useRef('')
  const barcodeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async (q?: string) => {
    const result = await window.api.products.getAll({ search: q, active: true })
    setProducts(result)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search) loadProducts(search)
      else loadProducts()
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Barcode scanner support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showCobro || quantityModal) return
      if (e.target !== searchRef.current && (e.target as HTMLElement).tagName === 'INPUT') return

      if (e.key === 'Enter' && barcodeBuffer.current.length >= 3) {
        const barcode = barcodeBuffer.current
        barcodeBuffer.current = ''
        window.api.products.getByBarcode(barcode).then((p) => {
          if (p) {
            if (p.price_type === 'kg') {
              setQuantityModal(p)
            } else {
              addItem(p, 1)
            }
          }
        })
        return
      }
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key
        clearTimeout(barcodeTimer.current)
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = '' }, 100)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCobro, quantityModal, addItem])

  const handleProductClick = (product: Product) => {
    if (product.price_type === 'kg') {
      setQuantityModal(product)
      setQuantity('')
    } else {
      setQuantityModal(product)
      setQuantity('1')
    }
  }

  const handleAddToCart = () => {
    if (!quantityModal || !quantity) return
    const qty = parseFloat(quantity)
    if (qty <= 0) return
    addItem(quantityModal, qty)
    setQuantityModal(null)
    setQuantity('')
    searchRef.current?.focus()
  }

  if (!register) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted">Debe abrir una caja primero</p>
      </div>
    )
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-5rem)]">
      {/* Left: Cart */}
      <div className="w-[45%] bg-white rounded-lg shadow-sm flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg">Carrito</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="text-center text-text-muted py-12">Carrito vacío</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-left border-b">
                  <th className="pb-2">Producto</th>
                  <th className="pb-2 w-24 text-center">Cant.</th>
                  <th className="pb-2 text-right">Subtotal</th>
                  <th className="pb-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.product.id} className="border-b">
                    <td className="py-2">
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-xs text-text-muted">{formatGs(item.product.price)} / {item.product.price_type === 'kg' ? 'kg' : 'u.'}</p>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.product.id, Math.max(item.product.price_type === 'kg' ? 0.1 : 1, item.quantity - (item.product.price_type === 'kg' ? 0.25 : 1)))}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-12 text-center font-medium">
                          {item.product.price_type === 'kg' ? item.quantity.toFixed(3) : item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + (item.product.price_type === 'kg' ? 0.25 : 1))}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="py-2 text-right font-medium">{formatGs(item.subtotal)}</td>
                    <td className="py-2">
                      <button onClick={() => removeItem(item.product.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span className="font-medium">{formatGs(subtotal())}</span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span>Descuento:</span>
            <input
              type="number"
              value={discount || ''}
              onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
              className="w-32 text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="0"
            />
          </div>
          <div className="flex justify-between text-xl font-bold pt-2 border-t">
            <span>TOTAL:</span>
            <span className="text-brand">{formatGs(total())}</span>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={clear}
              disabled={items.length === 0}
              className="flex-1 border border-red-300 text-red-600 py-2 rounded-lg hover:bg-red-50 disabled:opacity-30"
            >
              Cancelar
            </button>
            <button
              onClick={() => setShowCobro(true)}
              disabled={items.length === 0}
              className="flex-1 bg-brand text-white py-2 rounded-lg font-medium hover:bg-brand-hover disabled:opacity-30 text-lg"
            >
              Cobrar
            </button>
          </div>
        </div>
      </div>

      {/* Right: Product Search */}
      <div className="flex-1 flex flex-col">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="Buscar por nombre o código de barras..."
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => handleProductClick(p)}
                disabled={p.stock <= 0}
                className="bg-white rounded-lg p-4 shadow-sm text-left hover:shadow-md transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <p className="font-medium text-sm truncate">{p.name}</p>
                <p className="text-brand font-bold mt-1">{formatGs(p.price)}</p>
                <p className="text-xs text-text-muted">
                  Stock: {p.stock} {p.price_type === 'kg' ? 'kg' : 'u.'}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quantity Modal */}
      {quantityModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-xs mx-4">
            <h3 className="font-semibold mb-1">{quantityModal.name}</h3>
            <p className="text-sm text-text-muted mb-4">{formatGs(quantityModal.price)} / {quantityModal.price_type === 'kg' ? 'kg' : 'unidad'}</p>

            <div className="mb-4">
              <label className="block text-sm text-text-muted mb-1">
                Cantidad ({quantityModal.price_type === 'kg' ? 'kg' : 'unidades'})
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddToCart()}
                step={quantityModal.price_type === 'kg' ? '0.001' : '1'}
                min={quantityModal.price_type === 'kg' ? '0.001' : '1'}
                className="w-full border rounded-lg p-3 text-center text-xl focus:outline-none focus:ring-2 focus:ring-brand"
                autoFocus
              />
            </div>

            {quantity && parseFloat(quantity) > 0 && (
              <p className="text-center text-lg font-bold text-brand mb-4">
                {formatGs(Math.round(parseFloat(quantity) * quantityModal.price))}
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setQuantityModal(null)} className="flex-1 border rounded-lg py-2 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleAddToCart}
                disabled={!quantity || parseFloat(quantity) <= 0}
                className="flex-1 bg-brand text-white py-2 rounded-lg hover:bg-brand-hover disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cobro Modal */}
      {showCobro && (
        <CobroModal
          onClose={() => setShowCobro(false)}
          onSuccess={() => { clear(); setShowCobro(false) }}
        />
      )}
    </div>
  )
}
