import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatGs, cn } from '../../lib/utils'
import { useAuthStore } from '../../store/auth.store'
import type { Product, Category } from '@shared/types'
import { Search, Plus, Eye, AlertTriangle, Package, TrendingUp, TrendingDown } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select
} from '../../components/ui'

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

  useEffect(() => {
    window.api.products.categories().then(setCategories)
  }, [])

  useEffect(() => {
    const filters: Record<string, unknown> = { search: search || undefined, active: true }
    if (filterCat) filters.categoryId = filterCat
    if (filterStock) filters.lowStock = true
    window.api.products.getAll(filters).then(setProducts)
  }, [search, filterCat, filterStock])

  const handleAdjust = async (): Promise<void> => {
    if (!adjustModal || !newStock || !adjustReason || !user) return
    await window.api.products.adjustStock(
      adjustModal.id,
      parseFloat(newStock),
      adjustReason,
      user.id
    )
    closeAdjustModal()
    window.api.products.getAll({ search: search || undefined, active: true }).then(setProducts)
  }

  const closeAdjustModal = (): void => {
    setAdjustModal(null)
    setNewStock('')
    setAdjustReason('')
  }

  const stockDiff =
    adjustModal && newStock !== '' ? parseFloat(newStock) - adjustModal.stock : null

  return (
    <div className="space-y-5">
      <PageHeader
        title="Productos"
        subtitle={`${products.length} producto${products.length === 1 ? '' : 's'} en catálogo`}
        actions={
          <button
            onClick={() => navigate('/productos/nuevo')}
            className="bg-brand text-white px-4 py-2.5 rounded-xl font-medium hover:bg-brand-hover flex items-center gap-2 shadow-sm transition-colors"
          >
            <Plus size={18} />
            Nuevo Producto
          </button>
        }
      />

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
            size={16}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
            placeholder="Buscar por nombre o código..."
          />
        </div>
        <Select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value ? Number(e.target.value) : '')}
          className="min-w-[180px] rounded-xl"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <button
          type="button"
          onClick={() => setFilterStock((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 h-10 px-3 rounded-xl text-sm font-medium border transition-colors',
            filterStock
              ? 'border-warning-500 bg-warning-50 text-warning-700'
              : 'border-border bg-surface text-text-main hover:bg-surface-muted'
          )}
        >
          <AlertTriangle size={14} />
          Stock bajo
        </button>
      </div>

      <Card className="rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-muted/60 text-left text-text-muted">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium text-right">Precio</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium text-right">Stock</th>
                <th className="px-4 py-3 font-medium text-right">Mínimo</th>
                <th className="px-4 py-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const low = p.stock <= p.min_stock
                const out = p.stock <= 0
                return (
                  <tr
                    key={p.id}
                    className="border-t border-border hover:bg-surface-muted/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-text-main">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-border bg-surface-muted shrink-0 flex items-center justify-center">
                          {p.image ? (
                            <img
                              src={`product-img://${p.image}`}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package size={16} className="text-text-disabled" />
                          )}
                        </div>
                        <span className="truncate">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{p.category_name || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatGs(p.price)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={p.price_type === 'kg' ? 'info' : 'neutral'}>
                        {p.price_type === 'kg' ? 'Por kg' : 'Unidad'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {out ? (
                          <Badge tone="danger">Sin stock</Badge>
                        ) : low ? (
                          <Badge tone="warning">Bajo</Badge>
                        ) : null}
                        <span
                          className={cn(
                            'font-medium tabular-nums',
                            out ? 'text-danger-700' : low ? 'text-warning-700' : ''
                          )}
                        >
                          {p.price_type === 'kg' ? p.stock.toFixed(2) : p.stock}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-text-muted tabular-nums">
                      {p.min_stock}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => navigate(`/productos/${p.id}`)}
                          className="p-1.5 hover:bg-surface-muted rounded-lg text-text-muted hover:text-text-main transition-colors"
                          title="Ver detalle"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setAdjustModal(p)
                            setNewStock(String(p.stock))
                          }}
                          className="p-1.5 hover:bg-surface-muted rounded-lg text-text-muted hover:text-text-main transition-colors"
                          title="Ajustar stock"
                        >
                          <Package size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    {search || filterCat || filterStock ? (
                      <EmptyState
                        icon={<Search size={40} />}
                        title="Sin resultados"
                        description="Ningún producto coincide con los filtros aplicados."
                      />
                    ) : (
                      <EmptyState
                        icon={<Package size={40} />}
                        title="Aún no hay productos"
                        description="Empezá cargando los productos que vendés en el local."
                        action={
                          <Button onClick={() => navigate('/productos/nuevo')}>
                            <Plus size={16} /> Nuevo Producto
                          </Button>
                        }
                      />
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={adjustModal !== null}
        onClose={closeAdjustModal}
        size="sm"
        title={adjustModal ? `Ajustar stock — ${adjustModal.name}` : 'Ajustar stock'}
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={closeAdjustModal}>
              Cancelar
            </Button>
            <Button onClick={handleAdjust} disabled={!newStock || !adjustReason}>
              Guardar
            </Button>
          </div>
        }
      >
        {adjustModal && (
          <div className="space-y-4">
            <div className="bg-surface-muted rounded-xl px-4 py-3">
              <p className="text-xs text-text-muted">Stock actual</p>
              <p className="text-lg font-semibold tabular-nums">
                {adjustModal.price_type === 'kg'
                  ? adjustModal.stock.toFixed(2)
                  : adjustModal.stock}{' '}
                {adjustModal.price_type === 'kg' ? 'kg' : 'u.'}
              </p>
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-1.5">Nuevo stock</label>
              <Input
                type="number"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                step={adjustModal.price_type === 'kg' ? '0.01' : '1'}
                className="text-right tabular-nums"
                autoFocus
              />
              {stockDiff !== null && !Number.isNaN(stockDiff) && (
                <div
                  className={cn(
                    'mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium',
                    stockDiff >= 0
                      ? 'bg-success-50 text-success-700'
                      : 'bg-danger-50 text-danger-700'
                  )}
                >
                  {stockDiff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {stockDiff >= 0 ? '+' : ''}
                  {stockDiff.toFixed(2)} {adjustModal.price_type === 'kg' ? 'kg' : 'u.'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-1.5">Motivo (requerido)</label>
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Compra, merma, conteo, etc."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
