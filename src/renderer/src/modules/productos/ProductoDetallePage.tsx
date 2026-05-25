import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  DollarSign,
  Package,
  Pencil,
  Power,
  ShoppingBag,
  Sliders,
  Truck,
  Wallet
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  KpiCard,
  Modal,
  Skeleton,
  Table,
  TBody,
  Td,
  Th,
  THead,
  TourButton,
  Tr
} from '../../components/ui'
import { usePageTour } from '../../lib/use-page-tour'
import { productoDetalleTourSteps } from '../../lib/tour-steps'
import { confirm } from '../../lib/confirm'
import { toast } from '../../lib/toast'
import { formatGs, formatDateTime, cn } from '../../lib/utils'
import { priceTypeInfo, formatQty, roundQty } from '../../lib/price-types'
import { useAuthStore } from '../../store/auth.store'
import {
  type StockAdjustMode,
  STOCK_ADJUST_MODES,
  applyStockAdjust,
  stockAdjustInputLabel,
  stockAdjustReasonPlaceholder
} from '../../lib/stock-adjust'
import type {
  Product,
  ProductLastPurchase,
  ProductRecentSale,
  ProductSalesStats,
  ProductStockMovement
} from '@shared/types'

export default function ProductoDetallePage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const productId = Number(id)
  const user = useAuthStore((s) => s.user)

  const [product, setProduct] = useState<Product | null>(null)
  const [movements, setMovements] = useState<ProductStockMovement[]>([])
  const [sales, setSales] = useState<ProductRecentSale[]>([])
  const [stats, setStats] = useState<ProductSalesStats | null>(null)
  const [lastPurchase, setLastPurchase] = useState<ProductLastPurchase | null>(null)
  const [loading, setLoading] = useState(true)

  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustMode, setAdjustMode] = useState<StockAdjustMode>('add')
  const [adjustValue, setAdjustValue] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)

  const loadAll = async (): Promise<void> => {
    // Use allSettled so an auth-blocked endpoint (cajeros lose access to
    // movements / recentSales / salesStats / lastPurchase per US3) does not
    // tear down the whole page. The corresponding sections render empty.
    const [p, m, s, st, lp] = await Promise.allSettled([
      window.api.products.getById(productId),
      window.api.products.movements(productId, 50),
      window.api.products.recentSales(productId, 20),
      window.api.products.salesStats(productId),
      window.api.products.lastPurchase(productId)
    ])
    setProduct(p.status === 'fulfilled' ? p.value : null)
    setMovements(m.status === 'fulfilled' ? m.value : [])
    setSales(s.status === 'fulfilled' ? s.value : [])
    setStats(st.status === 'fulfilled' ? st.value : null)
    setLastPurchase(lp.status === 'fulfilled' ? lp.value : null)
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    loadAll()
  }, [id])

  const openAdjust = (): void => {
    if (!product) return
    setAdjustMode('add')
    setAdjustValue('')
    setAdjustReason('')
    setShowAdjust(true)
  }

  const submitAdjust = async (): Promise<void> => {
    if (!product || !user) return
    const entered = parseFloat(adjustValue)
    if (isNaN(entered)) {
      toast.error('Cantidad inválida')
      return
    }
    // add/subtract apply the incoming/outgoing quantity, set replaces the
    // total; the IPC always receives the resulting absolute stock.
    const newStock = applyStockAdjust(adjustMode, product.stock, entered)
    if (newStock < 0) {
      toast.error('El stock no puede quedar negativo')
      return
    }
    if (!adjustReason.trim()) {
      toast.error('Indicá el motivo del ajuste')
      return
    }
    setAdjustSaving(true)
    try {
      await window.api.products.adjustStock(product.id, newStock, adjustReason.trim(), user.id)
      setShowAdjust(false)
      toast.success('Stock ajustado')
      await loadAll()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al ajustar stock')
    } finally {
      setAdjustSaving(false)
    }
  }

  const toggleActive = async (): Promise<void> => {
    if (!product) return
    const willActivate = !product.active
    const ok = await confirm({
      title: willActivate ? 'Activar producto' : 'Desactivar producto',
      message: willActivate
        ? 'El producto volverá a aparecer en el punto de venta.'
        : 'El producto dejará de mostrarse en el punto de venta.',
      confirmLabel: willActivate ? 'Activar' : 'Desactivar',
      danger: !willActivate
    })
    if (!ok) return
    try {
      await window.api.products.update(product.id, { active: willActivate })
      toast.success(willActivate ? 'Producto activado' : 'Producto desactivado')
      await loadAll()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar estado')
    }
  }

  const { startTour } = usePageTour({
    key: 'producto-detalle',
    steps: productoDetalleTourSteps,
    ready: !!product
  })

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-5">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-6xl mx-auto">
        <EmptyState
          icon={<Package size={48} />}
          title="Producto no encontrado"
          description="Verificá que el producto exista o volvé al listado."
          action={<Button onClick={() => navigate('/productos')}>Volver a productos</Button>}
        />
      </div>
    )
  }

  const ptInfo = priceTypeInfo(product.price_type)
  const stockUnit = ptInfo.unit
  const imageUrl = product.image ? `product-img://${product.image}` : null
  const lowStock = product.stock <= product.min_stock
  const margin =
    lastPurchase && product.price > 0
      ? ((product.price - lastPurchase.unit_cost) / product.price) * 100
      : null

  const adjustEntered = adjustValue !== '' ? parseFloat(adjustValue) : NaN
  const adjustResulting = !Number.isNaN(adjustEntered)
    ? roundQty(applyStockAdjust(adjustMode, product.stock, adjustEntered), product.price_type)
    : null
  const adjustDelta = adjustResulting !== null ? adjustResulting - product.stock : null
  const adjustWouldGoNegative = adjustResulting !== null && adjustResulting < 0

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/productos')}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-main transition-colors"
        >
          <ArrowLeft size={14} />
          Volver a productos
        </button>
        <TourButton onClick={startTour} size="sm" />
      </div>

      <Card
        data-tour="producto-detalle-header"
      >
        <CardBody className="flex flex-col sm:flex-row gap-5">
          <div className="w-32 h-32 rounded-2xl overflow-hidden border border-border bg-surface-muted shrink-0 flex items-center justify-center">
            {imageUrl ? (
              <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <Package size={40} className="text-text-disabled" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-text-main truncate">{product.name}</h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {product.category_name && <Badge tone="info">{product.category_name}</Badge>}
                  <Badge tone={product.active ? 'success' : 'neutral'}>
                    {product.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                  {lowStock && product.active && <Badge tone="danger">Stock bajo</Badge>}
                  <Badge tone="neutral">{ptInfo.label}</Badge>
                </div>
                {product.barcode && (
                  <p className="text-xs text-text-muted mt-2 tabular-nums">
                    Código de barras: {product.barcode}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="secondary" onClick={openAdjust}>
                  <Sliders size={16} />
                  Ajustar stock
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/productos/${product.id}/editar`)}
                >
                  <Pencil size={16} />
                  Editar
                </Button>
                <Button variant={product.active ? 'secondary' : 'primary'} onClick={toggleActive}>
                  <Power size={16} />
                  {product.active ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div
        data-tour="producto-detalle-kpis"
        className={`grid grid-cols-2 ${user?.role === 'cajero' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}
      >
        <KpiCard
          gradient="blue"
          icon={<Wallet size={20} />}
          label="Stock actual"
          value={formatQty(product.stock, product.price_type)}
          hint={`Mínimo: ${formatQty(product.min_stock, product.price_type)}`}
        />
        <KpiCard
          gradient="green"
          icon={<DollarSign size={20} />}
          label="Precio actual"
          value={formatGs(product.price)}
          hint={ptInfo.label}
        />
        <KpiCard
          gradient="purple"
          icon={<ShoppingBag size={20} />}
          label="Vendido (7 días)"
          value={formatQty(stats?.units_7d ?? 0, product.price_type)}
          hint={formatGs(stats?.total_7d ?? 0)}
        />
        {user?.role !== 'cajero' && (
          <KpiCard
            gradient="teal"
            icon={<Truck size={20} />}
            label="Última compra"
            value={lastPurchase ? formatGs(lastPurchase.unit_cost) : '—'}
            hint={
              lastPurchase
                ? margin !== null
                  ? `Margen: ${margin.toFixed(0)}%`
                  : formatDateTime(lastPurchase.created_at)
                : 'Sin compras registradas'
            }
          />
        )}
      </div>

      <Card
        data-tour="producto-detalle-movements"
      >
        <CardHeader>
          <h2 className="font-semibold text-text-main">Movimientos de stock</h2>
          <p className="text-xs text-text-muted">
            Ajustes manuales registrados ({movements.length})
          </p>
        </CardHeader>
        <CardBody className="p-0">
          {movements.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Sliders size={36} />}
                title="Sin movimientos"
                description="Aún no se registraron ajustes manuales de stock para este producto."
              />
            </div>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Fecha</Th>
                  <Th>Antes</Th>
                  <Th>Después</Th>
                  <Th>Cambio</Th>
                  <Th>Motivo</Th>
                  <Th>Usuario</Th>
                </Tr>
              </THead>
              <TBody>
                {movements.map((m) => (
                  <Tr key={m.id}>
                    <Td className="whitespace-nowrap text-text-muted">
                      {formatDateTime(m.created_at)}
                    </Td>
                    <Td className="tabular-nums">
                      {formatQty(m.quantity_before, product.price_type)}
                    </Td>
                    <Td className="tabular-nums">
                      {formatQty(m.quantity_after, product.price_type)}
                    </Td>
                    <Td>
                      <Badge tone={m.delta >= 0 ? 'success' : 'danger'}>
                        {m.delta >= 0 ? '+' : ''}
                        {formatQty(m.delta, product.price_type)}
                      </Badge>
                    </Td>
                    <Td className="max-w-xs truncate" title={m.reason}>
                      {m.reason}
                    </Td>
                    <Td className="text-text-muted">{m.user_name || '—'}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card
        data-tour="producto-detalle-sales"
      >
        <CardHeader>
          <h2 className="font-semibold text-text-main">Últimas ventas</h2>
          <p className="text-xs text-text-muted">
            {stats
              ? `Últimos 30 días: ${formatQty(stats.units_30d, product.price_type)} · ${formatGs(stats.total_30d)}`
              : 'Tickets más recientes que incluyeron este producto'}
          </p>
        </CardHeader>
        <CardBody className="p-0">
          {sales.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<ShoppingBag size={36} />}
                title="Sin ventas"
                description="Este producto todavía no fue vendido."
              />
            </div>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Fecha</Th>
                  <Th>Ticket</Th>
                  <Th>Cantidad</Th>
                  <Th>Precio unit.</Th>
                  <Th>Subtotal</Th>
                  <Th>Cliente</Th>
                  <Th>Cajero</Th>
                </Tr>
              </THead>
              <TBody>
                {sales.map((s) => (
                  <Tr key={s.sale_id}>
                    <Td className="whitespace-nowrap text-text-muted">
                      {formatDateTime(s.created_at)}
                    </Td>
                    <Td className="tabular-nums">#{s.sale_id}</Td>
                    <Td className="tabular-nums">{formatQty(s.quantity, product.price_type)}</Td>
                    <Td className="tabular-nums">{formatGs(s.unit_price)}</Td>
                    <Td className="tabular-nums font-medium">{formatGs(s.subtotal)}</Td>
                    <Td className="text-text-muted">{s.customer_name || '—'}</Td>
                    <Td className="text-text-muted">{s.user_name || '—'}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal
        open={showAdjust}
        onClose={() => setShowAdjust(false)}
        title="Ajustar stock"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowAdjust(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submitAdjust}
              disabled={adjustSaving || adjustResulting === null || adjustWouldGoNegative}
            >
              {adjustSaving ? 'Guardando...' : 'Confirmar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="text-sm text-text-muted">
            Stock actual:{' '}
            <span className="font-medium text-text-main tabular-nums">
              {formatQty(product.stock, product.price_type)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 bg-surface-muted rounded-lg">
            {STOCK_ADJUST_MODES.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setAdjustMode(mode)
                  setAdjustValue(
                    mode === 'set' ? String(roundQty(product.stock, product.price_type)) : ''
                  )
                }}
                className={cn(
                  'px-2 py-1.5 rounded-md text-sm font-medium transition-colors',
                  adjustMode === mode
                    ? 'bg-surface text-text-main shadow-sm'
                    : 'text-text-muted hover:text-text-main'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">
              {stockAdjustInputLabel(adjustMode, stockUnit)}
            </label>
            <Input
              type="number"
              value={adjustValue}
              onChange={(e) => setAdjustValue(e.target.value)}
              step={ptInfo.inputStep}
              min="0"
              placeholder={adjustMode === 'set' ? '' : 'Ej: 10'}
              className="text-right tabular-nums"
              autoFocus
            />
            {adjustResulting !== null && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-text-muted">Nuevo total:</span>
                <span className="font-semibold tabular-nums text-text-main">
                  {formatQty(adjustResulting, product.price_type)}
                </span>
                {adjustDelta !== null && (
                  <Badge tone={adjustDelta >= 0 ? 'success' : 'danger'}>
                    {adjustDelta >= 0 ? '+' : ''}
                    {formatQty(adjustDelta, product.price_type)}
                  </Badge>
                )}
              </div>
            )}
            {adjustWouldGoNegative && (
              <p className="mt-1.5 text-xs text-danger-600">
                No podés restar más de lo que hay en stock.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">Motivo</label>
            <Input
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder={stockAdjustReasonPlaceholder(adjustMode)}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
