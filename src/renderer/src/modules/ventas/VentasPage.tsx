import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTour } from '@reactour/tour'
import { useCartStore } from '../../store/cart.store'
import { useCashStore } from '../../store/cash.store'
import { useHeldStore } from '../../store/held.store'
import { useTourStore } from '../../store/tour.store'
import { ventasTourSteps } from '../../lib/tour-steps'
import { formatGs, formatDateTime } from '../../lib/utils'
import { parseBalanceCode } from '../../lib/balance-code'
import { toast } from '../../lib/toast'
import { confirm } from '../../lib/confirm'
import type { Category, Product } from '@shared/types'
import {
  Search,
  Trash2,
  Plus,
  Minus,
  Package,
  ScanLine,
  ShoppingCart,
  Pause,
  Play,
  Clock,
  HelpCircle,
  Wallet
} from 'lucide-react'
import { Badge, Button, EmptyState, Input, Modal, MoneyInput } from '../../components/ui'
import { cn } from '../../lib/utils'
import { priceTypeInfo } from '../../lib/price-types'
import CobroModal from './CobroModal'

export default function VentasPage() {
  const navigate = useNavigate()
  const register = useCashStore((s) => s.register)
  const { setIsOpen: setTourOpen, setCurrentStep, setSteps } = useTour()
  const ventasSeen = useTourStore((s) => s.seen.ventas)
  const markSeen = useTourStore((s) => s.markSeen)
  const {
    items, discount, addItem, updateQuantity, removeItem, setDiscount, clear, restore,
    subtotal, total
  } = useCartStore()
  const heldTickets = useHeldStore((s) => s.tickets)
  const addHeld = useHeldStore((s) => s.add)
  const consumeHeld = useHeldStore((s) => s.consume)
  const removeHeld = useHeldStore((s) => s.remove)
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [productsTotal, setProductsTotal] = useState(0)
  const [productsPage, setProductsPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [quantityModal, setQuantityModal] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState('')
  const [showCobro, setShowCobro] = useState(false)
  const [showHeld, setShowHeld] = useState(false)
  const [scannerActive, setScannerActive] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const discountRef = useRef<HTMLInputElement>(null)
  const barcodeBuffer = useRef('')
  const barcodeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const scannerTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const PRODUCTS_PER_PAGE = 30

  useEffect(() => {
    window.api.products.categories().then(setCategories)
  }, [])

  useEffect(() => {
    if (!register || ventasSeen) return
    const id = setTimeout(() => {
      setSteps?.(ventasTourSteps)
      setCurrentStep(0)
      setTourOpen(true)
      markSeen('ventas')
    }, 600)
    return () => clearTimeout(id)
  }, [register, ventasSeen, setSteps, setCurrentStep, setTourOpen, markSeen])

  const startTour = () => {
    setSteps?.(ventasTourSteps)
    setCurrentStep(0)
    setTourOpen(true)
  }

  const loadProducts = async (
    page: number,
    q?: string,
    categoryId?: number | null
  ): Promise<void> => {
    try {
      const filters: Record<string, unknown> = {
        search: q,
        active: true,
        page,
        perPage: PRODUCTS_PER_PAGE
      }
      if (categoryId) filters.categoryId = categoryId
      const result = await window.api.products.getAll(filters)
      setProductsTotal(result.total)
      setProducts((prev) => (page === 1 ? result.items : [...prev, ...result.items]))
    } catch {
      toast.error('Error al cargar productos')
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    setProductsPage(1)
    const timer = setTimeout(() => {
      loadProducts(1, search || undefined, activeCategory)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, activeCategory])

  useEffect(() => {
    if (productsPage === 1) return
    setLoadingMore(true)
    loadProducts(productsPage, search || undefined, activeCategory)
  }, [productsPage])

  useEffect(() => {
    const target = loadMoreRef.current
    if (!target) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore && products.length < productsTotal) {
          setProductsPage((p) => p + 1)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [loadingMore, products.length, productsTotal])

  // Barcode scanner support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showCobro || quantityModal) return
      if (e.target !== searchRef.current && (e.target as HTMLElement).tagName === 'INPUT') return

      if (e.key === 'Enter' && barcodeBuffer.current.length >= 3) {
        const barcode = barcodeBuffer.current
        barcodeBuffer.current = ''
        setScannerActive(false)

        // Código generado por balanza electrónica (EAN-13 con peso embebido)
        const balance = parseBalanceCode(barcode)
        if (balance) {
          window.api.products.getByBarcode(balance.productCode).then((p) => {
            if (p && p.price_type === 'kg') {
              addItem(p, balance.weightKg)
              toast.success(`${p.name}: ${balance.weightKg.toFixed(3)} kg agregado`)
            } else if (p) {
              toast.warning(`${p.name} no es un producto por kg`)
            } else {
              toast.warning(`Código de balanza ${balance.productCode} no encontrado`)
            }
          })
          return
        }

        // Lectura normal de código de barras
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

  const suspendCart = (): void => {
    if (items.length === 0) return
    const label = `${items.length} producto${items.length === 1 ? '' : 's'} · ${formatGs(total())}`
    addHeld(label, items, discount)
    clear()
    toast.success('Venta suspendida')
    searchRef.current?.focus()
  }

  const resumeHeld = async (id: string): Promise<void> => {
    if (items.length > 0) {
      const ok = await confirm({
        title: 'Reanudar ticket',
        message: 'El carrito actual se va a reemplazar por el ticket suspendido. ¿Continuar?',
        confirmLabel: 'Reanudar',
        cancelLabel: 'Volver'
      })
      if (!ok) return
    }
    const ticket = consumeHeld(id)
    if (!ticket) return
    restore(ticket.items, ticket.discount)
    setShowHeld(false)
    toast.success('Venta reanudada')
  }

  const deleteHeld = async (id: string): Promise<void> => {
    const ok = await confirm({
      title: 'Eliminar ticket suspendido',
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true
    })
    if (!ok) return
    removeHeld(id)
    toast.info('Ticket eliminado')
  }

  // Global shortcuts: F4 = descuento, F8 = cancelar, F9 = suspender, F12 = cobrar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showCobro || quantityModal || showHeld) return
      if (e.key === 'F4') {
        e.preventDefault()
        discountRef.current?.focus()
        discountRef.current?.select()
      } else if (e.key === 'F8') {
        e.preventDefault()
        cancelCart()
      } else if (e.key === 'F9') {
        e.preventDefault()
        suspendCart()
      } else if (e.key === 'F12') {
        e.preventDefault()
        if (items.length > 0) setShowCobro(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, showCobro, quantityModal, showHeld])

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
      <div className="h-full flex items-center justify-center">
        <div
          className="w-full max-w-md bg-surface rounded-2xl border border-border p-8"
          style={{ boxShadow: 'var(--shadow-card-soft)' }}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-4"
              style={{ background: 'var(--gradient-kpi-blue)' }}
            >
              <Wallet size={26} />
            </div>
            <h1 className="text-xl font-bold text-text-main">Caja no abierta</h1>
            <p className="text-sm text-text-muted mt-1 mb-6">
              Debe abrir una caja antes de empezar a vender.
            </p>
            <button
              onClick={() => navigate('/caja/apertura')}
              className="w-full bg-brand text-white py-3 rounded-xl font-medium hover:bg-brand-hover transition-colors shadow-sm"
            >
              Abrir caja
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Cart */}
        <div
          data-tour="ventas-cart"
          className="w-[45%] bg-surface rounded-2xl border border-border flex flex-col overflow-hidden"
          style={{ boxShadow: 'var(--shadow-card-soft)' }}
        >
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-bold text-lg text-text-main">Carrito</h2>
              <p className="text-xs text-text-muted mt-0.5">
                {items.length} producto{items.length === 1 ? '' : 's'} en el ticket
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {heldTickets.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHeld(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warning-50 text-warning-700 hover:bg-warning-50/70 transition-colors"
                  title="Tickets suspendidos"
                >
                  <Clock size={12} />
                  Pendientes ({heldTickets.length})
                </button>
              )}
              <Badge
                tone={scannerActive ? 'danger' : 'neutral'}
                className={scannerActive ? 'animate-pulse' : ''}
              >
                <ScanLine size={12} />
                {scannerActive ? 'Escaneando' : 'Lector listo'}
              </Badge>
            </div>
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
                  {items.map((item) => {
                    const itemPt = priceTypeInfo(item.product.price_type)
                    return (
                    <tr key={item.product.id} className="border-b border-border">
                      <td className="py-2">
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-xs text-text-muted">
                          {formatGs(item.product.price)} / {itemPt.unit}
                        </p>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(
                              item.product.id,
                              Math.max(itemPt.cartStep, item.quantity - itemPt.cartStep)
                            )}
                            className="p-1 hover:bg-surface-muted rounded"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-12 text-center font-medium">
                            {itemPt.decimals > 0 ? item.quantity.toFixed(itemPt.decimals) : item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(
                              item.product.id,
                              item.quantity + itemPt.cartStep
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
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* TOTAL section */}
          <div
            data-tour="ventas-totals"
            className="border-t border-border bg-surface-muted px-5 py-4 space-y-2.5"
          >
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Subtotal</span>
              <span className="font-medium tabular-nums">{formatGs(subtotal())}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-text-muted">Descuento</span>
              <MoneyInput
                ref={discountRef}
                value={discount}
                onValueChange={setDiscount}
                className="w-32 h-8 text-right"
                placeholder="0"
              />
            </div>
            <div className="flex items-baseline justify-between pt-3 border-t border-border">
              <span className="text-sm font-semibold text-text-muted">TOTAL</span>
              <span className="text-display font-bold text-brand leading-none tabular-nums">
                {formatGs(total())}
              </span>
            </div>
            <div className="flex gap-2 pt-3">
              <Button
                variant="secondary"
                className="rounded-xl"
                onClick={cancelCart}
                disabled={items.length === 0}
                title="Cancelar (F8)"
              >
                <Trash2 size={14} />
              </Button>
              <Button
                data-tour="ventas-suspend"
                variant="secondary"
                className="rounded-xl"
                onClick={suspendCart}
                disabled={items.length === 0}
                title="Suspender (F9)"
              >
                <Pause size={14} />
                Suspender
              </Button>
              <Button
                size="xl"
                className="flex-1 rounded-xl"
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
          <div data-tour="ventas-search" className="relative mb-3">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted z-10"
              size={18}
            />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 text-base rounded-xl"
              placeholder="Buscar por nombre o código de barras..."
              autoFocus
            />
          </div>

          {categories.length > 0 && (
            <div
              data-tour="ventas-categories"
              className="flex gap-2 mb-3 overflow-x-auto pb-1 -mx-1 px-1"
            >
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  activeCategory === null
                    ? 'bg-brand text-white border-brand'
                    : 'bg-surface text-text-main border-border hover:bg-surface-muted'
                )}
              >
                Todas
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategory(c.id)}
                  className={cn(
                    'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    activeCategory === c.id
                      ? 'bg-brand text-white border-brand'
                      : 'bg-surface text-text-main border-border hover:bg-surface-muted'
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          <div data-tour="ventas-products" className="flex-1 overflow-y-auto">
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
              <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {products.map((p) => {
                  const lowStock = p.stock > 0 && p.stock <= p.min_stock
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProductClick(p)}
                      disabled={p.stock <= 0}
                      style={{ boxShadow: 'var(--shadow-card-soft)' }}
                      className="bg-surface rounded-xl border border-border text-left hover:border-brand hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
                        <p className="font-medium text-sm truncate text-text-main">{p.name}</p>
                        <p className="text-brand font-bold mt-1 tabular-nums">
                          {formatGs(p.price)}
                        </p>
                        <div className="flex items-center justify-between mt-1.5 gap-2">
                          <span className="text-xs text-text-muted">
                            Stock: {p.stock} {priceTypeInfo(p.price_type).unit}
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
              {products.length < productsTotal && (
                <div ref={loadMoreRef} className="py-4 text-center text-xs text-text-muted">
                  {loadingMore ? 'Cargando más productos...' : ' '}
                </div>
              )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Shortcut footer bar */}
      <div
        data-tour="ventas-shortcuts"
        className="mt-3 flex items-center gap-3 text-xs text-text-muted bg-surface border border-border rounded-md px-3 py-2 shrink-0"
      >
        <ShortcutHint k="F4" label="Descuento" />
        <ShortcutHint k="F8" label="Cancelar" />
        <ShortcutHint k="F9" label="Suspender" />
        <ShortcutHint k="F12" label="Cobrar" />
        <ShortcutHint k="F1" label="Ayuda" />
        <button
          type="button"
          onClick={startTour}
          className="ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-surface-muted text-text-muted hover:text-text-main transition-colors"
          title="Ver tutorial de la pantalla de ventas"
        >
          <HelpCircle size={12} />
          Ver tutorial
        </button>
      </div>

      {/* Quantity Modal */}
      <Modal
        open={quantityModal != null}
        onClose={() => setQuantityModal(null)}
        title={quantityModal?.name}
        size="sm"
      >
        {quantityModal && (() => {
          const qmPt = priceTypeInfo(quantityModal.price_type)
          return (
          <>
            <p className="text-sm text-text-muted mb-4">
              {formatGs(quantityModal.price)} / {qmPt.unit}
            </p>
            <div className="mb-4">
              <label className="block text-sm text-text-muted mb-1">
                Cantidad ({qmPt.unit})
              </label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddToCart()}
                step={qmPt.inputStep}
                min={qmPt.inputStep}
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
          )
        })()}
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

      {/* Tickets suspendidos */}
      <Modal
        open={showHeld}
        onClose={() => setShowHeld(false)}
        size="md"
        title="Tickets suspendidos"
      >
        {heldTickets.length === 0 ? (
          <EmptyState
            icon={<Clock size={36} />}
            title="Sin tickets suspendidos"
            description="Cuando suspendés una venta, aparece acá hasta que la reanudes."
          />
        ) : (
          <ul className="space-y-2">
            {heldTickets.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl border border-border hover:bg-surface-muted/40 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-warning-50 text-warning-700 flex items-center justify-center shrink-0">
                    <Clock size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-main truncate">{t.label}</p>
                    <p className="text-xs text-text-muted tabular-nums">
                      {formatDateTime(t.savedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => deleteHeld(t.id)}
                    className="p-1.5 text-text-muted hover:text-danger-700 hover:bg-danger-50 rounded-lg transition-colors"
                    title="Eliminar"
                    aria-label="Eliminar ticket"
                  >
                    <Trash2 size={14} />
                  </button>
                  <Button
                    size="sm"
                    onClick={() => resumeHeld(t.id)}
                    className="rounded-lg"
                  >
                    <Play size={12} />
                    Reanudar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
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
