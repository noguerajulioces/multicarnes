import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Category } from '@shared/types'
import { ImagePlus, Plus } from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  MoneyInput,
  PageHeader,
  Select
} from '../../components/ui'
import { formatGs } from '../../lib/utils'

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
    active: true
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
            active: !!p.active
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
      price_type: form.price_type as 'unit' | 'kg',
      stock: parseFloat(form.stock) || 0,
      min_stock: parseFloat(form.min_stock) || 0,
      active: form.active
    }
    try {
      if (isEdit) {
        await window.api.products.update(Number(id), data)
        navigate('/productos')
      } else {
        const created = await window.api.products.create(data)
        if (created && stagedImage) {
          await window.api.products.saveImageFromPath(created.id, stagedImage.srcPath)
        }
        navigate('/productos')
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const imageUrl = stagedImage?.dataUrl ?? (image ? `product-img://${image}` : null)
  const hasImage = !!imageUrl
  const stockUnit = form.price_type === 'kg' ? 'kg' : 'u.'

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <PageHeader
        title={isEdit ? 'Editar Producto' : 'Nuevo Producto'}
        subtitle={
          isEdit
            ? 'Actualizá los datos del producto y guardá los cambios.'
            : 'Cargá los datos del producto y, si querés, una imagen.'
        }
      />

      <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
        <CardHeader>
          <h2 className="font-semibold text-text-main">Información básica</h2>
          <p className="text-xs text-text-muted">Nombre, categoría, código e imagen</p>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleUploadImage}
              className="w-24 h-24 rounded-2xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-brand hover:bg-brand-light transition-colors overflow-hidden"
            >
              {imageUrl ? (
                <img src={imageUrl} alt={form.name} className="w-full h-full object-cover" />
              ) : (
                <ImagePlus size={28} className="text-text-muted" />
              )}
            </button>
            <div>
              <button
                type="button"
                onClick={handleUploadImage}
                className="text-sm font-medium text-brand hover:text-brand-hover"
              >
                {hasImage ? 'Cambiar imagen' : 'Subir imagen'}
              </button>
              <p className="text-xs text-text-muted mt-1">PNG, JPG o WebP</p>
            </div>
          </div>

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
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
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
                <p className="text-xs text-text-muted mt-1 text-right">{formatGs(form.price)}</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1.5">Tipo de precio</label>
              <Select
                value={form.price_type}
                onChange={(e) => setForm({ ...form, price_type: e.target.value })}
              >
                <option value="unit">Por unidad</option>
                <option value="kg">Por kg</option>
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
                step={form.price_type === 'kg' ? '0.01' : '1'}
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
                step={form.price_type === 'kg' ? '0.01' : '1'}
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

      <div className="flex gap-3 justify-end">
        <Button
          variant="secondary"
          className="rounded-xl"
          size="lg"
          onClick={() => navigate('/productos')}
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
