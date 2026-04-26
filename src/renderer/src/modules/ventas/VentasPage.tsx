import { useState, useEffect, useRef } from 'react'
import { useCartStore } from '../../store/cart.store'
import { useCashStore } from '../../store/cash.store'
import { formatGs } from '../../lib/utils'
import { toast } from '../../lib/toast'
import { confirm } from '../../lib/confirm'
import type { Product } from '@shared/types'
import {
  Search, Trash2, Plus, Minus, Package, ScanLine, ShoppingCart, DollarSign
} from 'lucide-react'
import { Button, Input, Modal, EmptyState, Badge } from '../../components/ui'
import CobroModal from './CobroModal'

export default function VentasPage() {
  const register = useCashStore((s) => s.register)
  const {
    items, discount, addItem, updateQuantity, removeItem, setDiscount, clear, subtotal, total
  } = useCartStore()
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [quantityModal, setQuantityModal] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState('')
  const [showCobro, setShowCobro] = useState(false)
  const [scannerActive, setScannerActive] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const discountRef = useRef<HTMLInputElement>(null)
  const barcodeBuffer = useRef('')
  const barcodeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const scannerTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => { loadProducts() }, [])

  const loadProducts = async (q?: string) => {
    try {
      const result = await window.api.products.getAll({ search: q, active: true })
      setProducts(result)
    } catch {
      toast.error('Error al cargar productos')
    }
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
        setScannerActive(false)
        window.api.products.getByBarcode(barcode).then((p) => {
          if (p) {
            if (p.price_type === 'kg') {
              setQuantityModal(p)
            } else {
              addItem(p, 1)
              toast.success(`${p.name} agregado`)
            }
          } else {
            toast.warning(`Código ${barcode} no encontrado`)
          }
        })
        return
      }
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key
        setScannerActive(true)
        clearTimeout(barcodeTimer.current)
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = '' }, 100)
        clearTimeout(scannerTimer.current)
        scannerTimer.current = setTimeout(() => setScannerActive(false), 300)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCobro, quantityModal, addItem])

  const cancelCart = async () => {
    if (items.length === 0) return
    const ok = await confirm({
      title: 'Cancelar venta',
      message: `Se quitarán ${items.length} producto${items.length === 1 ? '' : 's'} del carrito. ¿Continuar?`,
      confirmLabel: 'Cancelar venta',
      cancelLabel: 'Volver',
      danger: true
    })
    if (!ok) return
    clear()
    toast.info('Carrito cancelado')
  }

  // Global shortcuts: F4 = focus descuento, F8 = cancelar carrito, F12 = abrir cobro
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showCobro || quantityModal) return
      if (e.key === 'F4') {
        e.preventDefault()
        discountRef.current?.focus()
        discountRef.current?.select()
      } else if (e.key === 'F8') {
        e.preventDefault()
        cancelCart()
      } else if (e.key === 'F12') {
        e.preventDefault()
        if (items.length > 0) setShowCobro(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, showCobro, quantityModal])

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
      <EmptyState
        icon={<DollarSign size={48} />}
        title="Caja no abierta"
        description="Debe abrir una caja antes de empezar a vender."
      />
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Cart */}
        <div className="w-[45%] bg-surface rounded-lg shadow-card border border-border flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-bold text-lg">Carrito</h2>
            <Badge
              tone={scannerActive ? 'danger' : 'neutral'}
              className={scannerActive ? 'animate-pulse' : ''}
            >
              <ScanLine size={12} />
              {scannerActive ? 'Escaneando' : 'Lector listo'}
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2">
            {items.length === 0 ? (
              <EmptyState
                icon={<ShoppingCart size={40} />}
                title="Carrito vacío"
                description="Buscá productos por nombre o pasá un código de barras."
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-muted text-left border-b border-border">
                    <th className="pb-2">Producto</th>
                    <th className="pb-2 w-24 text-center">Cant.</th>
                    <th className="pb-2 text-right">Subtotal</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.product.id} className="border-b border-border">
                      <td className="py-2">
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-xs text-text-muted">
                          {formatGs(item.product.price)} / {item.product.price_type === 'kg' ? 'kg' : 'u.'}
                        </p>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(
                              item.product.id,
                              Math.max(
                                item.product.price_type === 'kg' ? 0.1 : 1,
                                item.quantity - (item.product.price_type === 'kg' ? 0.25 : 1)
                              )
                            )}
                            className="p-1 hover:bg-surface-muted rounded"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-12 text-center font-medium">
                            {item.product.price_type === 'kg' ? item.quantity.toFixed(3) : item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(
                              item.product.id,
                              item.quantity + (item.product.price_type === 'kg' ? 0.25 : 1)
                            )}
                            className="p-1 hover:bg-surface-muted rounded"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="py-2 text-right font-medium">{formatGs(item.subtotal)}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => removeItem(item.product.id)}
                          className="p-1 text-danger-500 hover:bg-danger-50 rounded"
                          aria-label="Quitar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* TOTAL section */}
          <div className="border-t border-border bg-surface-muted px-4 py-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Subtotal</span>
              <span className="font-medium">{formatGs(subtotal())}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-text-muted">Descuento</span>
              <Input
                ref={discountRef}
                type="number"
                value={discount || ''}
                onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
                className="w-32 h-8 text-right"
                placeholder="0"
              />
            </div>
            <div className="flex items-baseline justify-between pt-2 border-t border-border">
              <span className="text-sm font-semibold text-text-muted">TOTAL</span>
              <span className="text-display font-bold text-brand leading-none">
                {formatGs(total())}
              </span>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={cancelCart}
                disabled={items.length === 0}
              >
                Cancelar (F8)
              </Button>
              <Button
                size="xl"
                className="flex-[2]"
                onClick={() => setShowCobro(true)}
                disabled={items.length === 0}
              >
                Cobrar (F12)
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Product Search */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="relative mb-4">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10"
              size={18}
            />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12 text-base"
              placeholder="Buscar por nombre o código de barras..."
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {products.length === 0 ? (
              <EmptyState
                icon={<Package size={48} />}
                title="Sin productos"
                description={
                  search
                    ? `Ningún producto coincide con "${search}".`
                    : 'No hay productos cargados.'
                }
              />
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {products.map((p) => {
                  const lowStock = p.stock > 0 && p.stock <= p.min_stock
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProductClick(p)}
                      disabled={p.stock <= 0}
                      className="bg-surface rounded-lg shadow-card border border-border text-left hover:shadow-popover hover:border-brand transition-all disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {p.image ? (
                        <div className="w-full h-24 bg-surface-muted">
                          <img
                            src={`product-img://${p.image}`}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-24 bg-surface-muted flex items-center justify-center">
                          <Package size={32} className="text-text-disabled" />
                        </div>
                      )}
                      <div className="p-3">
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        <p className="text-brand font-bold mt-1">{formatGs(p.price)}</p>
                        <div className="flex items-center justify-between mt-1 gap-2">
                          <span className="text-xs text-text-muted">
                            Stock: {p.stock} {p.price_type === 'kg' ? 'kg' : 'u.'}
                          </span>
                          {p.stock <= 0 ? (
                            <Badge tone="danger">Sin stock</Badge>
                          ) : lowStock ? (
                            <Badge tone="warning">Stock bajo</Badge>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shortcut footer bar */}
      <div className="mt-3 flex items-center gap-3 text-xs text-text-muted bg-surface border border-border rounded-md px-3 py-2 shrink-0">
        <ShortcutHint k="F4" label="Descuento" />
        <ShortcutHint k="F8" label="Cancelar" />
        <ShortcutHint k="F12" label="Cobrar" />
        <ShortcutHint k="F1" label="Ayuda" />
        <span className="ml-auto opacity-70 hidden md:inline">
          Pasá un código o tipeá Enter para confirmar
        </span>
      </div>

      {/* Quantity Modal */}
      <Modal
        open={quantityModal != null}
        onClose={() => setQuantityModal(null)}
        title={quantityModal?.name}
        size="sm"
      >
        {quantityModal && (
          <>
            <p className="text-sm text-text-muted mb-4">
              {formatGs(quantityModal.price)} / {quantityModal.price_type === 'kg' ? 'kg' : 'unidad'}
            </p>
            <div className="mb-4">
              <label className="block text-sm text-text-muted mb-1">
                Cantidad ({quantityModal.price_type === 'kg' ? 'kg' : 'unidades'})
              </label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddToCart()}
                step={quantityModal.price_type === 'kg' ? '0.001' : '1'}
                min={quantityModal.price_type === 'kg' ? '0.001' : '1'}
                className="text-center text-xl h-14"
                autoFocus
              />
            </div>

            {quantity && parseFloat(quantity) > 0 && (
              <p className="text-center text-2xl font-bold text-brand mb-4">
                {formatGs(Math.round(parseFloat(quantity) * quantityModal.price))}
              </p>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setQuantityModal(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddToCart}
                disabled={!quantity || parseFloat(quantity) <= 0}
              >
                Agregar
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Cobro Modal */}
      {showCobro && (
        <CobroModal
          onClose={() => setShowCobro(false)}
          onSuccess={() => {
            clear()
            setShowCobro(false)
            toast.success('Venta registrada')
          }}
        />
      )}
    </div>
  )
}

function ShortcutHint({ k, label }: { k: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="px-1.5 py-0.5 bg-surface-muted text-text-main rounded border border-border font-mono text-[10px]">
        {k}
      </kbd>
      {label}
    </span>
  )
}
