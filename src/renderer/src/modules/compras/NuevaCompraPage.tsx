import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'
import { formatGs } from '../../lib/utils'
import { priceTypeInfo } from '../../lib/price-types'
import type { Supplier, Product, PriceType } from '@shared/types'
import { Plus, Trash2, Package } from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  MoneyInput,
  PageHeader,
  Select,
  TourButton
} from '../../components/ui'
import { usePageTour } from '../../lib/use-page-tour'
import { compraNuevaTourSteps } from '../../lib/tour-steps'

interface OrderItem {
  productId: number
  productName: string
  priceType: PriceType
  quantity: number
  unitCost: number
  subtotal: number
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
    window.api.suppliers.getAll().then((res) => setSuppliers(res.items))
  }, [])

  useEffect(() => {
    if (searchProduct.length >= 2) {
      window.api.products
        .getAll({ search: searchProduct, active: true })
        .then((res) => setProducts(res.items))
    } else {
      setProducts([])
    }
  }, [searchProduct])

  const addItem = (p: Product): void => {
    if (items.find((i) => i.productId === p.id)) return
    setItems([
      ...items,
      {
        productId: p.id,
        productName: p.name,
        priceType: p.price_type,
        quantity: 1,
        unitCost: 0,
        subtotal: 0
      }
    ])
    setShowProductSearch(false)
    setSearchProduct('')
  }

  const updateItem = (idx: number, field: 'quantity' | 'unitCost', value: number): void => {
    setItems(
      items.map((item, i) => {
        if (i !== idx) return item
        const updated = { ...item, [field]: value }
        updated.subtotal = Math.round(updated.quantity * updated.unitCost)
        return updated
      })
    )
  }

  const removeItem = (idx: number): void => setItems(items.filter((_, i) => i !== idx))
  const total = items.reduce((sum, i) => sum + i.subtotal, 0)

  const handleSave = async (receive: boolean): Promise<void> => {
    if (!user || items.length === 0) return
    setLoading(true)
    try {
      await window.api.purchases.create({
        supplierId: supplierId || null,
        userId: user.id,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitCost: i.unitCost,
          subtotal: i.subtotal
        })),
        total,
        notes: notes || undefined,
        receive
      })
      navigate('/compras')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error')
    }
    setLoading(false)
  }

  const { startTour } = usePageTour({ key: 'compra-nueva', steps: compraNuevaTourSteps })

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        title="Nueva Orden de Compra"
        subtitle="Registrá una compra a un proveedor. Si la marcás como recibida, el stock se actualiza automáticamente."
        actions={<TourButton onClick={startTour} />}
      />

      <Card
        data-tour="compra-nueva-supplier"
        className="rounded-2xl"
        style={{ boxShadow: 'var(--shadow-card-soft)' }}
      >
        <CardHeader>
          <h2 className="font-semibold text-text-main">Detalles de la orden</h2>
          <p className="text-xs text-text-muted">Proveedor y notas</p>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="block text-sm text-text-muted mb-1.5">Proveedor</label>
            <Select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Sin proveedor / consumidor final</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1.5">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-main placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
              rows={2}
              placeholder="Observaciones, número de factura, etc."
            />
          </div>
        </CardBody>
      </Card>

      <Card
        data-tour="compra-nueva-items"
        className="rounded-2xl"
        style={{ boxShadow: 'var(--shadow-card-soft)' }}
      >
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-text-main">Productos</h2>
            <p className="text-xs text-text-muted">
              {items.length === 0
                ? 'Agregá los productos comprados'
                : `${items.length} producto${items.length === 1 ? '' : 's'} en la orden`}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowProductSearch(true)}>
            <Plus size={14} /> Agregar producto
          </Button>
        </CardHeader>
        <CardBody>
          {items.length === 0 ? (
            <EmptyState
              icon={<Package size={36} />}
              title="Sin productos"
              description="Agregá al menos un producto para crear la orden."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-muted border-b border-border">
                    <th className="pb-2 font-normal pr-3">Producto</th>
                    <th className="pb-2 font-normal pr-3 w-28">Cantidad</th>
                    <th className="pb-2 font-normal pr-3 w-36">Costo unit.</th>
                    <th className="pb-2 font-normal text-right w-32">Subtotal</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const pt = priceTypeInfo(item.priceType)
                    return (
                    <tr key={item.productId} className="border-b border-border last:border-0">
                      <td className="py-3 pr-3 font-medium text-text-main">{item.productName}</td>
                      <td className="py-3 pr-3">
                        <div className="relative">
                          <Input
                            type="number"
                            value={item.quantity}
                            min={pt.inputStep}
                            step={pt.inputStep}
                            onChange={(e) =>
                              updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)
                            }
                            className="h-9 text-right text-sm tabular-nums pr-10"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted pointer-events-none">
                            {pt.unit}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <MoneyInput
                          value={item.unitCost}
                          onValueChange={(v) => updateItem(idx, 'unitCost', v)}
                          className="h-9 text-right text-sm tabular-nums"
                          placeholder="0"
                        />
                      </td>
                      <td className="py-3 text-right font-medium tabular-nums">
                        {formatGs(item.subtotal)}
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-1.5 text-danger-500 hover:bg-danger-50 rounded-lg"
                          aria-label="Quitar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <td colSpan={3} className="pt-3 text-right font-medium text-text-muted">
                      Total
                    </td>
                    <td className="pt-3 text-right text-xl font-bold text-brand tabular-nums">
                      {formatGs(total)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <div data-tour="compra-nueva-actions" className="flex gap-3 justify-end flex-wrap">
        <Button
          variant="secondary"
          size="lg"
          className="rounded-xl"
          onClick={() => navigate('/compras')}
        >
          Cancelar
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="rounded-xl border-brand text-brand"
          onClick={() => handleSave(false)}
          disabled={loading || items.length === 0}
        >
          Guardar Pendiente
        </Button>
        <Button
          size="lg"
          className="rounded-xl"
          onClick={() => handleSave(true)}
          disabled={loading || items.length === 0}
        >
          {loading ? 'Guardando...' : 'Guardar y Recibir'}
        </Button>
      </div>

      <Modal
        open={showProductSearch}
        onClose={() => {
          setShowProductSearch(false)
          setSearchProduct('')
        }}
        size="md"
        title="Buscar producto"
      >
        <div className="space-y-3">
          <Input
            value={searchProduct}
            onChange={(e) => setSearchProduct(e.target.value)}
            placeholder="Nombre o código de barras..."
            autoFocus
          />
          <div className="max-h-72 overflow-y-auto -mx-4">
            {searchProduct.length < 2 ? (
              <p className="text-center text-sm text-text-muted py-8 px-4">
                Escribí al menos 2 caracteres para buscar
              </p>
            ) : products.length === 0 ? (
              <p className="text-center text-sm text-text-muted py-8 px-4">
                Sin resultados para &quot;{searchProduct}&quot;
              </p>
            ) : (
              products.map((p) => {
                const alreadyAdded = items.some((i) => i.productId === p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addItem(p)}
                    disabled={alreadyAdded}
                    className="w-full text-left px-4 py-2.5 hover:bg-surface-muted text-sm border-b border-border last:border-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate text-text-main">{p.name}</p>
                      <p className="text-xs text-text-muted">
                        {p.category_name ?? 'Sin categoría'} · Stock: {p.stock}{' '}
                        {priceTypeInfo(p.price_type).unit}
                      </p>
                    </div>
                    {alreadyAdded && (
                      <span className="text-xs text-text-disabled shrink-0">Ya agregado</span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
