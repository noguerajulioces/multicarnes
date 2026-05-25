import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Category, PriceType } from '@shared/types'
import { ImagePlus, Plus } from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  MoneyInput,
  PageHeader,
  Select,
  TourButton
} from '../../components/ui'
import { formatGs } from '../../lib/utils'
import { PRICE_TYPE_LIST, priceTypeInfo } from '../../lib/price-types'
import { usePageTour } from '../../lib/use-page-tour'
import { productoFormTourSteps } from '../../lib/tour-steps'

// 005-promotional-pricing: translate the typed validation errors thrown by
// the products query layer into user-facing Spanish copy.
const PROMO_ERROR_MSG: Record<string, string> = {
  PROMO_INCOMPLETE: 'Para activar la promoción, indicá el tipo y el valor.',
  PROMO_FIXED_NOT_LESS_THAN_PRICE: 'El precio promo debe ser menor al precio normal.',
  PROMO_FIXED_NOT_POSITIVE: 'El precio promo debe ser mayor a 0.',
  PROMO_PERCENT_OUT_OF_RANGE: 'El descuento debe estar entre 1% y 99%.',
  PROMO_DATE_FORMAT: 'La fecha debe tener formato AAAA-MM-DD.',
  PROMO_DATE_RANGE: "La fecha 'Desde' debe ser anterior o igual a 'Hasta'."
}

export default function ProductoFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const [categories, setCategories] = useState<Category[]>([])
  const [newCat, setNewCat] = useState('')
  const [form, setForm] = useState({
    name: '',
    category_id: '' as string | number,
    barcode: '',
    price: 0,
    price_type: 'unit',
    stock: '0',
    min_stock: '0',
    active: true,
    // 005-promotional-pricing
    promo_enabled: false,
    promo_type: 'fixed' as 'fixed' | 'percent',
    promo_value: 0,
    promo_from: '',
    promo_to: ''
  })
  const [image, setImage] = useState<string | null>(null)
  const [stagedImage, setStagedImage] = useState<{ srcPath: string; dataUrl: string } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    window.api.products.categories().then(setCategories)
    if (isEdit) {
      window.api.products.getById(Number(id)).then((p) => {
        if (p) {
          setForm({
            name: p.name,
            category_id: p.category_id || '',
            barcode: p.barcode || '',
            price: p.price,
            price_type: p.price_type,
            stock: String(p.stock),
            min_stock: String(p.min_stock),
            active: !!p.active,
            promo_enabled: !!p.promo_enabled,
            promo_type: p.promo_type === 'percent' ? 'percent' : 'fixed',
            promo_value: p.promo_value ?? 0,
            promo_from: p.promo_from ?? '',
            promo_to: p.promo_to ?? ''
          })
          setImage(p.image || null)
        }
      })
    }
  }, [id])

  const handleCreateCategory = async (): Promise<void> => {
    if (!newCat.trim()) return
    const cat = await window.api.products.createCategory(newCat.trim())
    setCategories([...categories, cat])
    setForm({ ...form, category_id: cat.id })
    setNewCat('')
  }

  const handleUploadImage = async (): Promise<void> => {
    if (isEdit) {
      const filename = await window.api.products.uploadImage(Number(id))
      if (filename) setImage(filename)
      return
    }
    const picked = await window.api.products.pickImage()
    if (picked) setStagedImage(picked)
  }

  const handleSave = async (): Promise<void> => {
    setLoading(true)
    const data = {
      name: form.name,
      category_id: form.category_id ? Number(form.category_id) : null,
      barcode: form.barcode || null,
      price: form.price,
      price_type: form.price_type as PriceType,
      stock: parseFloat(form.stock) || 0,
      min_stock: parseFloat(form.min_stock) || 0,
      active: form.active,
      promo_enabled: form.promo_enabled,
      promo_type: form.promo_enabled ? form.promo_type : null,
      promo_value: form.promo_enabled ? form.promo_value : null,
      promo_from: form.promo_enabled && form.promo_from ? form.promo_from : null,
      promo_to: form.promo_enabled && form.promo_to ? form.promo_to : null
    }
    try {
      if (isEdit) {
        await window.api.products.update(Number(id), data)
        navigate(`/productos/${id}`)
      } else {
        const created = await window.api.products.create(data)
        if (created && stagedImage) {
          await window.api.products.saveImageFromPath(created.id, stagedImage.srcPath)
        }
        navigate(created ? `/productos/${created.id}` : '/productos')
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Error al guardar'
      alert(PROMO_ERROR_MSG[raw] ?? raw)
    } finally {
      setLoading(false)
    }
  }

  const imageUrl = stagedImage?.dataUrl ?? (image ? `product-img://${image}` : null)
  const hasImage = !!imageUrl
  const ptInfo = priceTypeInfo(form.price_type)
  const stockUnit = ptInfo.unit

  const { startTour } = usePageTour({ key: 'producto-form', steps: productoFormTourSteps })

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <PageHeader
        title={isEdit ? 'Editar Producto' : 'Nuevo Producto'}
        subtitle={
          isEdit
            ? 'Actualizá los datos del producto y guardá los cambios.'
            : 'Cargá los datos del producto y, si querés, una imagen.'
        }
        actions={<TourButton onClick={startTour} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card
          data-tour="producto-form-image"
          className="lg:col-span-1 self-start"
        >
          <CardHeader>
            <h2 className="font-semibold text-text-main">Imagen</h2>
            <p className="text-xs text-text-muted">PNG, JPG o WebP</p>
          </CardHeader>
          <CardBody className="space-y-3">
            <button
              type="button"
              onClick={handleUploadImage}
              className="w-full aspect-square rounded-2xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-brand hover:bg-brand-light transition-colors overflow-hidden"
            >
              {imageUrl ? (
                <img src={imageUrl} alt={form.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-text-muted">
                  <ImagePlus size={36} />
                  <span className="text-sm">Sin imagen</span>
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={handleUploadImage}
              className="w-full text-sm font-medium text-brand hover:text-brand-hover"
            >
              {hasImage ? 'Cambiar imagen' : 'Subir imagen'}
            </button>
          </CardBody>
        </Card>

        <div className="lg:col-span-2 space-y-5">
          <Card
            data-tour="producto-form-basic"
          >
            <CardHeader>
              <h2 className="font-semibold text-text-main">Información básica</h2>
              <p className="text-xs text-text-muted">Nombre, categoría y código</p>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-1.5">
                  Nombre <span className="text-danger-500">*</span>
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Costilla vacuna"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-muted mb-1.5">Categoría</label>
                  <Select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={newCat}
                      onChange={(e) => setNewCat(e.target.value)}
                      placeholder="Nueva categoría"
                      className="h-9 text-sm"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCreateCategory}
                      disabled={!newCat.trim()}
                    >
                      <Plus size={14} />
                      Crear
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1.5">Código de barras</label>
                  <Input
                    value={form.barcode}
                    onChange={(e) => {
                      let v = e.target.value.trim()
                      // Producto por kg: si escanean/pegan la etiqueta completa de
                      // la balanza (EAN-13 = 7 dígitos producto + 5 peso + 1
                      // verificador), guardamos solo los 7 del producto. Así el
                      // código queda constante y el escaneo en ventas matchea
                      // siempre, sin importar el peso de cada pesada.
                      if (form.price_type === 'kg' && /^\d{13}$/.test(v)) {
                        v = v.slice(0, 7)
                      }
                      setForm({ ...form, barcode: v })
                    }}
                    placeholder={form.price_type === 'kg' ? 'Código de 7 dígitos' : 'Opcional'}
                  />
                  {form.price_type === 'kg' && (
                    <p className="text-xs text-text-muted mt-1">
                      Por kg: ingresá los <strong>7 dígitos</strong> del producto. Si escaneás la
                      etiqueta completa de la balanza, tomamos los primeros 7 automáticamente.
                    </p>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card
            data-tour="producto-form-pricing"
          >
            <CardHeader>
              <h2 className="font-semibold text-text-main">Precio y stock</h2>
              <p className="text-xs text-text-muted">Cómo se cobra y la cantidad disponible</p>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-muted mb-1.5">
                    Precio (Gs.) <span className="text-danger-500">*</span>
                  </label>
                  <MoneyInput
                    value={form.price}
                    onValueChange={(v) => setForm({ ...form, price: v })}
                    className="text-right tabular-nums"
                    placeholder="0"
                  />
                  {form.price > 0 && (
                    <p className="text-xs text-text-muted mt-1 text-right">
                      {formatGs(form.price)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1.5">Tipo de precio</label>
                  <Select
                    value={form.price_type}
                    onChange={(e) => setForm({ ...form, price_type: e.target.value })}
                  >
                    {PRICE_TYPE_LIST.map((pt) => (
                      <option key={pt.code} value={pt.code}>
                        {pt.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-muted mb-1.5">
                    Stock {isEdit ? 'actual' : 'inicial'} ({stockUnit})
                  </label>
                  <Input
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    step={ptInfo.inputStep}
                    min="0"
                    className="text-right tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1.5">
                    Stock mínimo ({stockUnit})
                  </label>
                  <Input
                    type="number"
                    value={form.min_stock}
                    onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                    step={ptInfo.inputStep}
                    min="0"
                    className="text-right tabular-nums"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    Recibís alertas cuando el stock baja de este nivel
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm pt-2 border-t border-border cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 rounded accent-brand"
                />
                <span className="text-text-main">Producto activo</span>
                <span className="text-xs text-text-muted">— se muestra en el punto de venta</span>
              </label>
            </CardBody>
          </Card>

          {/* 005-promotional-pricing */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-text-main">Promoción</h2>
              <p className="text-xs text-text-muted">
                Precio promocional que se aplica automáticamente en el POS
              </p>
            </CardHeader>
            <CardBody className="space-y-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.promo_enabled}
                  onChange={(e) => setForm({ ...form, promo_enabled: e.target.checked })}
                  className="w-4 h-4 rounded accent-brand"
                />
                <span className="text-text-main">En promoción</span>
                <span className="text-xs text-text-muted">
                  — el POS usa el precio promo para este producto
                </span>
              </label>

              {form.promo_enabled && (
                <div className="space-y-3 pl-6 border-l-2 border-brand-light">
                  <div>
                    <label className="block text-sm text-text-muted mb-1.5">
                      Tipo de promoción
                    </label>
                    <div className="flex gap-4">
                      <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="promo_type"
                          value="fixed"
                          checked={form.promo_type === 'fixed'}
                          onChange={() => setForm({ ...form, promo_type: 'fixed', promo_value: 0 })}
                          className="accent-brand"
                        />
                        Monto fijo (Gs.)
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="promo_type"
                          value="percent"
                          checked={form.promo_type === 'percent'}
                          onChange={() =>
                            setForm({ ...form, promo_type: 'percent', promo_value: 0 })
                          }
                          className="accent-brand"
                        />
                        Porcentaje de descuento (%)
                      </label>
                    </div>
                  </div>

                  {form.promo_type === 'fixed' ? (
                    <div>
                      <label className="block text-sm text-text-muted mb-1.5">
                        Precio promo (Gs.) <span className="text-danger-500">*</span>
                      </label>
                      <MoneyInput
                        value={form.promo_value}
                        onValueChange={(v) => setForm({ ...form, promo_value: v })}
                        className="text-right tabular-nums"
                        placeholder="0"
                      />
                      <p className="text-xs text-text-muted mt-1">
                        Debe ser menor al precio normal ({formatGs(form.price)})
                        {form.promo_value > 0 && (
                          <>
                            {' '}
                            — el cliente paga{' '}
                            <span className="font-medium text-success-700">
                              {formatGs(form.promo_value)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm text-text-muted mb-1.5">
                        Descuento (%) <span className="text-danger-500">*</span>
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="99"
                        step="1"
                        value={form.promo_value || ''}
                        onChange={(e) =>
                          setForm({ ...form, promo_value: parseInt(e.target.value, 10) || 0 })
                        }
                        className="text-right tabular-nums"
                        placeholder="0"
                      />
                      {form.price > 0 && form.promo_value >= 1 && form.promo_value <= 99 && (
                        <p className="text-xs text-text-muted mt-1">
                          El cliente paga{' '}
                          <span className="font-medium text-success-700">
                            {formatGs(Math.round(form.price * (1 - form.promo_value / 100)))}
                          </span>{' '}
                          — ahorrás{' '}
                          {formatGs(
                            form.price - Math.round(form.price * (1 - form.promo_value / 100))
                          )}
                        </p>
                      )}
                    </div>
                  )}

                  {/* US2: optional date range. Both bounds optional; toggle alone
                      activates the promo when no dates are set. */}
                  <div className="pt-3 border-t border-border space-y-3">
                    <p className="text-xs text-text-muted">
                      Vigencia (opcional) — si dejás las fechas vacías, el toggle controla la
                      promoción manualmente.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-text-muted mb-1.5">Desde</label>
                        <Input
                          type="date"
                          value={form.promo_from}
                          onChange={(e) => setForm({ ...form, promo_from: e.target.value })}
                          className="tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-text-muted mb-1.5">Hasta</label>
                        <Input
                          type="date"
                          value={form.promo_to}
                          onChange={(e) => setForm({ ...form, promo_to: e.target.value })}
                          className="tabular-nums"
                        />
                      </div>
                    </div>
                    {form.promo_from && form.promo_to && form.promo_from > form.promo_to && (
                      <p className="text-xs text-danger-700">
                        La fecha &apos;Desde&apos; debe ser anterior o igual a &apos;Hasta&apos;.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <div data-tour="producto-form-actions" className="flex gap-3 justify-end">
        <Button
          variant="secondary"
          className="rounded-xl"
          size="lg"
          onClick={() => navigate(isEdit ? `/productos/${id}` : '/productos')}
        >
          Cancelar
        </Button>
        <Button
          className="rounded-xl"
          size="lg"
          onClick={handleSave}
          disabled={loading || !form.name || !form.price}
        >
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
        </Button>
      </div>
    </div>
  )
}
