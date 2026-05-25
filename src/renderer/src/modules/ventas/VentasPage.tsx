import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../../store/cart.store'
import { useCashStore } from '../../store/cash.store'
import { useHeldStore } from '../../store/held.store'
import { usePageTour } from '../../lib/use-page-tour'
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
  Wallet,
  AlertTriangle
} from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Modal,
  MoneyInput,
  TourButton
} from '../../components/ui'
import { cn } from '../../lib/utils'
import { priceTypeInfo, formatQty } from '../../lib/price-types'
import { isPromoActive } from '../../lib/promo'
import CobroModal from './CobroModal'

export default function VentasPage() {
  const navigate = useNavigate()
  const register = useCashStore((s) => s.register)
  const {
    items,
    discount,
    addItem,
    updateQuantity,
    removeItem,
    setDiscount,
    clear,
    restore,
    subtotal,
    total
  } = useCartStore()
  const heldTickets = useHeldStore((s) => s.tickets)
  const heldLoaded = useHeldStore((s) => s.loaded)
  const loadHeldFromDb = useHeldStore((s) => s.loadFromDb)
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
  const [inputMode, setInputMode] = useState<'qty' | 'amount'>('qty')
  const [amountInput, setAmountInput] = useState(0)
  const [showCobro, setShowCobro] = useState(false)
  const [showHeld, setShowHeld] = useState(false)
  const [scannerActive, setScannerActive] = useState(false)
  const [discountMode, setDiscountMode] = useState<'gs' | 'pct'>('gs')
  const [discountPct, setDiscountPct] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const discountRef = useRef<HTMLInputElement>(null)
  const barcodeBuffer = useRef('')
  const burstStart = useRef(0)
  const lastKeyTime = useRef(0)
  const finalizeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const scannerTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const PRODUCTS_PER_PAGE = 30

  useEffect(() => {
    window.api.products.categories().then(setCategories)
  }, [])

  useEffect(() => {
    if (!heldLoaded) void loadHeldFromDb()
  }, [heldLoaded, loadHeldFromDb])

  // Cuando el descuento se configura en %, recalcular el monto en Gs cada vez que
  // el subtotal cambia (al agregar/quitar productos).
  useEffect(() => {
    if (discountMode === 'pct') {
      const sub = items.reduce((s, i) => s + i.subtotal, 0)
      setDiscount(Math.round((sub * discountPct) / 100))
    }
  }, [discountMode, discountPct, items, setDiscount])

  const { startTour } = usePageTour({
    key: 'ventas',
    steps: ventasTourSteps,
    ready: !!register
  })

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

  // Mantener el cursor en el buscador siempre que no haya un modal abierto, para
  // poder escribir o escanear el siguiente producto sin tener que volver a hacer clic.
  useEffect(() => {
    if (!showCobro && !quantityModal && !showHeld) {
      searchRef.current?.focus()
    }
  }, [showCobro, quantityModal, showHeld])

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

  const openQuantityModal = useCallback((product: Product) => {
    setQuantityModal(product)
    setInputMode('qty')
    setAmountInput(0)
    setQuantity(product.price_type === 'kg' ? '' : '1')
  }, [])

  // Resuelve un código (escaneado o pegado) contra el catálogo y lo agrega al
  // carrito de inmediato. Limpia el buscador para dejarlo listo para la próxima
  // lectura.
  //
  // Estrategia en dos pasos para no confundir productos envasados con etiquetas
  // de balanza (ambos son EAN-13):
  //   1. Match EXACTO del código completo → producto con código fijo (envasado).
  //   2. Si no hay match, lo interpreta como etiqueta de balanza de peso
  //      variable (7 dígitos producto + 5 peso en gramos + verificador) y busca
  //      el producto por sus 7 dígitos, agregándolo con el peso embebido.
  const processScannedCode = useCallback(
    async (code: string) => {
      setScannerActive(false)
      setSearch('')

      // 1) Producto con código de barras fijo (envasado / por unidad)
      const exact = await window.api.products.getByBarcode(code)
      if (exact) {
        if (exact.price_type === 'kg') {
          // Por kg pero se escaneó un código fijo: pedimos el peso a mano.
          openQuantityModal(exact)
        } else {
          addItem(exact, 1)
          toast.success(`${exact.name} agregado`)
          searchRef.current?.focus()
        }
        return
      }

      // 2) Etiqueta de balanza con peso embebido (EAN-13 de peso variable)
      const balance = parseBalanceCode(code)
      if (balance) {
        const p = await window.api.products.getByBarcode(balance.productCode)
        if (p && p.price_type === 'kg') {
          addItem(p, balance.weightKg)
          toast.success(`${p.name}: ${balance.weightKg.toFixed(3)} kg agregado`)
          searchRef.current?.focus()
          return
        }
        if (p) {
          toast.warning(`${p.name} no está configurado como producto por kg`)
          return
        }
      }

      toast.warning(`Código ${code} no encontrado`)
    },
    [addItem, openQuantityModal]
  )

  // Barcode scanner support.
  //
  // Un lector de código de barras "teclea" la lectura mucho más rápido que una
  // persona y, según el modelo, agrega o no un Enter al final. Por eso NO
  // dependemos del Enter: detectamos el escaneo por la velocidad de tecleo
  // (promedio de ms entre teclas) y lo confirmamos de dos formas: al recibir
  // Enter, o tras una breve pausa sin más teclas (para lectores sin Enter).
  // Así el producto entra al carrito de inmediato en ambos casos, mientras que
  // escribir un nombre a mano sigue filtrando la lista sin agregar nada.
  useEffect(() => {
    const SCAN_AVG_GAP_MS = 50 // ≤ esto entre teclas ⇒ velocidad de lector
    const IDLE_FINALIZE_MS = 120 // pausa que cierra un escaneo sin Enter
    const MIN_SCAN_LEN = 4 // largo mínimo para auto-confirmar sin Enter

    const finalizeScan = (viaEnter: boolean) => {
      clearTimeout(finalizeTimer.current)
      const code = barcodeBuffer.current
      barcodeBuffer.current = ''
      const len = code.length
      const avgGap = len > 1 ? (lastKeyTime.current - burstStart.current) / (len - 1) : Infinity
      const isScannerSpeed = avgGap <= SCAN_AVG_GAP_MS
      const minLen = viaEnter ? 3 : MIN_SCAN_LEN
      // Si fue tecleo humano (lento) o muy corto, lo dejamos como búsqueda.
      if (len < minLen || !isScannerSpeed) return
      processScannedCode(code)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showCobro || quantityModal) return
      if (e.target !== searchRef.current && (e.target as HTMLElement).tagName === 'INPUT') return

      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length >= 3) finalizeScan(true)
        return
      }
      if (e.key.length === 1) {
        const now = Date.now()
        if (barcodeBuffer.current === '') burstStart.current = now
        barcodeBuffer.current += e.key
        lastKeyTime.current = now
        setScannerActive(true)
        clearTimeout(scannerTimer.current)
        scannerTimer.current = setTimeout(() => setScannerActive(false), 300)
        clearTimeout(finalizeTimer.current)
        finalizeTimer.current = setTimeout(() => finalizeScan(false), IDLE_FINALIZE_MS)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCobro, quantityModal, processScannedCode])

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
    // El ticket suspendido guarda el descuento en Gs; volvemos a modo Gs para que
    // el efecto de % no recalcule sobre el nuevo subtotal.
    setDiscountMode('gs')
    setDiscountPct(0)
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

  const closeQuantityModal = () => {
    setQuantityModal(null)
    setQuantity('')
    setAmountInput(0)
    setInputMode('qty')
  }

  const handleProductClick = (product: Product) => {
    openQuantityModal(product)
  }

  const computeQty = (product: Product): number => {
    if (inputMode === 'amount') {
      if (amountInput <= 0 || product.price <= 0) return 0
      // Sin redondear: queremos qty * price === amount para evitar el "compraste 19.988
      // ingresando 20.000". La cantidad mostrada en pantalla se redondea solo para display.
      return amountInput / product.price
    }
    return parseFloat(quantity) || 0
  }

  const handleAddToCart = () => {
    if (!quantityModal) return
    const qty = computeQty(quantityModal)
    if (qty <= 0) return
    addItem(quantityModal, qty)
    closeQuantityModal()
    setSearch('')
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
            <Button size="lg" className="w-full" onClick={() => navigate('/caja/apertura')}>
              Abrir caja
            </Button>
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
                    const hasPromo =
                      item.normal_price != null &&
                      item.unit_price != null &&
                      item.normal_price > item.unit_price
                    return (
                      <tr key={item.product.id} className="border-b border-border">
                        <td className="py-2">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium">{item.product.name}</p>
                            {hasPromo && <Badge tone="success">PROMO</Badge>}
                          </div>
                          <p className="text-xs text-text-muted">
                            {hasPromo ? (
                              <>
                                <span className="line-through opacity-60">
                                  {formatGs(item.normal_price!)}
                                </span>{' '}
                                <span className="font-medium text-success-700">
                                  {formatGs(item.unit_price!)}
                                </span>{' '}
                                / {itemPt.unit}
                              </>
                            ) : (
                              <>
                                {formatGs(item.product.price)} / {itemPt.unit}
                              </>
                            )}
                          </p>
                        </td>
                        <td className="py-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  item.product.id,
                                  Math.max(itemPt.cartStep, item.quantity - itemPt.cartStep)
                                )
                              }
                              className="p-1 hover:bg-surface-muted rounded"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-12 text-center font-medium">
                              {item.quantity.toLocaleString('es-PY', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: itemPt.decimals
                              })}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(item.product.id, item.quantity + itemPt.cartStep)
                              }
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
              <div className="flex items-center gap-2">
                <span className="text-text-muted">Descuento</span>
                <button
                  type="button"
                  onClick={() => {
                    if (discountMode === 'gs') {
                      const sub = items.reduce((s, i) => s + i.subtotal, 0)
                      const pct = sub > 0 ? Math.round((discount / sub) * 100) : 0
                      setDiscountPct(Math.min(100, Math.max(0, pct)))
                      setDiscountMode('pct')
                    } else {
                      setDiscountMode('gs')
                    }
                  }}
                  className="px-2 py-0.5 rounded-md border border-border text-xs font-medium text-text-muted hover:bg-surface hover:text-text-main transition-colors"
                  title="Alternar entre monto (Gs) y porcentaje (%)"
                >
                  {discountMode === 'gs' ? 'Gs' : '%'}
                </button>
              </div>
              {discountMode === 'gs' ? (
                <MoneyInput
                  ref={discountRef}
                  value={discount}
                  onValueChange={setDiscount}
                  className="w-32 h-8 text-right"
                  placeholder="0"
                />
              ) : (
                <div className="relative w-32">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={discountPct || ''}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      setDiscountPct(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0)
                    }}
                    className="h-8 text-right pr-7 tabular-nums"
                    placeholder="0"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted pointer-events-none">
                    %
                  </span>
                </div>
              )}
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
                title="Cancelar (F8) — Vacía el carrito y descarta el ticket sin guardarlo."
              >
                <Trash2 size={14} />
              </Button>
              <Button
                data-tour="ventas-suspend"
                variant="secondary"
                className="rounded-xl"
                onClick={suspendCart}
                disabled={items.length === 0}
                title="Suspender (F9) — Pausa el ticket actual y lo guarda en Pendientes para retomarlo después."
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
              onPaste={(e) => {
                // Pegar un código numérico equivale a escanearlo: lo agrega al
                // carrito en vez de dejarlo como término de búsqueda. Pegar
                // texto con letras (un nombre) sigue filtrando normalmente.
                const text = e.clipboardData.getData('text').trim()
                if (/^\d{3,}$/.test(text)) {
                  e.preventDefault()
                  processScannedCode(text)
                }
              }}
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
                    const promo = isPromoActive(p, new Date())
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleProductClick(p)}
                        disabled={p.stock <= 0}
                        style={{ boxShadow: 'var(--shadow-card-soft)' }}
                        className="bg-surface rounded-xl border border-border text-left hover:border-brand hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <div className="relative w-full h-24 bg-surface-muted">
                          {p.image ? (
                            <img
                              src={`product-img://${p.image}`}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package size={32} className="text-text-disabled" />
                            </div>
                          )}
                          {promo && (
                            <Badge tone="success" className="absolute top-1.5 right-1.5 shadow-sm">
                              PROMO
                            </Badge>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="font-medium text-sm truncate text-text-main">{p.name}</p>
                          {promo ? (
                            <div className="mt-1 leading-tight">
                              <p className="text-xs text-text-muted line-through tabular-nums">
                                {formatGs(promo.normalPrice)}
                              </p>
                              <p className="text-success-700 font-bold tabular-nums">
                                {formatGs(promo.unitPrice)}
                              </p>
                            </div>
                          ) : (
                            <p className="text-brand font-bold mt-1 tabular-nums">
                              {formatGs(p.price)}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-1.5 gap-2">
                            <span className="text-xs text-text-muted">
                              Stock: {formatQty(p.stock, p.price_type)}
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
        <TourButton onClick={startTour} label="Ver tutorial" size="sm" className="ml-auto" />
      </div>

      {/* Quantity Modal */}
      <Modal
        open={quantityModal != null}
        onClose={closeQuantityModal}
        title={quantityModal?.name}
        size="sm"
      >
        {quantityModal &&
          (() => {
            const product = quantityModal
            const qmPt = priceTypeInfo(product.price_type)
            const allowAmountMode = qmPt.decimals > 0
            const presets = qmPt.decimals > 0 ? [0.25, 0.5, 1, 2] : [1, 2, 5, 10]
            const stock = product.stock
            const stockLabel = formatQty(stock, product.price_type)

            const setQty = (n: number): void => {
              if (n <= 0) {
                setQuantity('')
                return
              }
              const factor = Math.pow(10, qmPt.decimals)
              const rounded = Math.round(n * factor) / factor
              setQuantity(String(rounded))
            }

            const currentQty = parseFloat(quantity) || 0
            const finalQty = computeQty(product)
            // En modo "Por monto", el total mostrado debe coincidir exactamente con el
            // monto ingresado por el usuario, no con una multiplicación que podría
            // diferir por floating point.
            const finalTotal =
              inputMode === 'amount' && amountInput > 0
                ? amountInput
                : Math.round(finalQty * product.price)
            const exceedsStock = finalQty > stock && stock > 0

            return (
              <>
                {/* Header con imagen, precio y stock */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-14 h-14 rounded-xl border border-border bg-surface-muted overflow-hidden flex items-center justify-center shrink-0">
                    {product.image ? (
                      <img
                        src={`product-img://${product.image}`}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package size={20} className="text-text-disabled" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-muted">
                      {formatGs(product.price)} / {qmPt.unit}
                    </p>
                    <p
                      className={cn(
                        'text-xs mt-0.5',
                        stock <= 0
                          ? 'text-danger-700'
                          : stock <= product.min_stock
                            ? 'text-warning-700'
                            : 'text-text-muted'
                      )}
                    >
                      Disponible: {stockLabel}
                    </p>
                  </div>
                </div>

                {/* Toggle Cantidad / Monto */}
                {allowAmountMode && (
                  <div className="flex gap-1 p-1 bg-surface-muted rounded-xl mb-4">
                    <button
                      type="button"
                      onClick={() => setInputMode('qty')}
                      className={cn(
                        'flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors',
                        inputMode === 'qty'
                          ? 'bg-surface text-text-main shadow-sm'
                          : 'text-text-muted hover:text-text-main'
                      )}
                    >
                      Por cantidad
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('amount')}
                      className={cn(
                        'flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors',
                        inputMode === 'amount'
                          ? 'bg-surface text-text-main shadow-sm'
                          : 'text-text-muted hover:text-text-main'
                      )}
                    >
                      Por monto
                    </button>
                  </div>
                )}

                {/* Input principal */}
                <div className="mb-3">
                  <label className="block text-sm text-text-muted mb-1">
                    {inputMode === 'amount' ? 'Monto (Gs.)' : `Cantidad (${qmPt.unit})`}
                  </label>
                  {inputMode === 'amount' ? (
                    <MoneyInput
                      value={amountInput}
                      onValueChange={setAmountInput}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddToCart()}
                      onFocus={(e) => e.target.select()}
                      className="text-center text-xl h-14"
                      placeholder="0"
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-stretch gap-2">
                      <button
                        type="button"
                        onClick={() => setQty(currentQty - qmPt.cartStep)}
                        disabled={currentQty <= 0}
                        className="w-12 rounded-xl border border-border hover:bg-surface-muted text-text-main flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Disminuir"
                      >
                        <Minus size={16} />
                      </button>
                      <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddToCart()}
                        onFocus={(e) => e.target.select()}
                        step={qmPt.inputStep}
                        min={qmPt.inputStep}
                        className="text-center text-xl h-14 flex-1"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setQty(currentQty + qmPt.cartStep)}
                        className="w-12 rounded-xl border border-border hover:bg-surface-muted text-text-main flex items-center justify-center"
                        aria-label="Aumentar"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Presets rápidos */}
                {inputMode === 'qty' && (
                  <div className="mb-3">
                    <p className="text-xs text-text-muted mb-1.5">Cantidad rápida</p>
                    <div className="flex gap-2">
                      {presets.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setQty(p)}
                          className="flex-1 py-1.5 text-sm rounded-lg border border-border hover:bg-surface-muted text-text-main transition-colors"
                        >
                          {p}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setQty(stock)}
                        disabled={stock <= 0}
                        className="flex-1 py-1.5 text-sm rounded-lg border border-border hover:bg-surface-muted text-text-main transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={`Establecer al stock disponible (${stockLabel})`}
                      >
                        máx
                      </button>
                    </div>
                  </div>
                )}

                {/* Indicadores secundarios */}
                {finalQty > 0 && inputMode === 'amount' && (
                  <p className="text-center text-sm text-text-muted mb-3">
                    ≈ {formatQty(finalQty, product.price_type)}
                  </p>
                )}

                {finalQty > 0 && exceedsStock && (
                  <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-warning-500/50 bg-warning-50 px-3 py-2.5">
                    <AlertTriangle size={18} className="text-warning-700 shrink-0 mt-0.5" />
                    <div className="text-sm leading-tight">
                      <p className="font-semibold text-warning-700">Excede el stock disponible</p>
                      <p className="text-xs text-warning-700/80 mt-0.5">
                        Solo quedan {stockLabel} en inventario.
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-center text-xs text-text-disabled mb-3">
                  Enter para agregar · Esc para cancelar
                </p>

                <div className="flex gap-3">
                  <Button variant="secondary" className="flex-1" onClick={closeQuantityModal}>
                    Cancelar
                  </Button>
                  <Button className="flex-[2]" onClick={handleAddToCart} disabled={finalQty <= 0}>
                    Agregar{finalQty > 0 ? ` · ${formatGs(finalTotal)}` : ''}
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
            const soldQtyById = new Map<number, number>()
            for (const it of items) {
              soldQtyById.set(it.product.id, (soldQtyById.get(it.product.id) ?? 0) + it.quantity)
            }
            setProducts((prev) =>
              prev.map((p) => {
                const sold = soldQtyById.get(p.id)
                return sold ? { ...p, stock: Math.max(0, p.stock - sold) } : p
              })
            )
            clear()
            setShowCobro(false)
            toast.success('Venta registrada')
            // Confirmar con la fuente de verdad por si hubo cambios concurrentes
            // (otra caja, ajuste de stock manual, etc.)
            loadProducts(1, search || undefined, activeCategory)
            setProductsPage(1)
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
                  <Button size="sm" onClick={() => resumeHeld(t.id)} className="rounded-lg">
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
