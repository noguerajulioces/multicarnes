import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Supplier } from '@shared/types'
import { ArrowLeft, Edit2, Plus, Users } from 'lucide-react'
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  TourButton
} from '../../components/ui'
import { usePageTour } from '../../lib/use-page-tour'
import { proveedoresTourSteps } from '../../lib/tour-steps'
import { handleApiError } from '../../lib/api-error'

const emptyForm = { name: '', phone: '', email: '', address: '' }
const PER_PAGE = 50

export default function ProveedoresPage() {
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)

  const load = (): void => {
    window.api.suppliers.getAll({ page, perPage: PER_PAGE }).then((res) => {
      setSuppliers(res.items)
      setTotal(res.total)
    })
  }

  useEffect(() => {
    load()
  }, [page])

  const handleSave = async (): Promise<void> => {
    if (!form.name) return
    try {
      if (editId) {
        await window.api.suppliers.update(editId, form)
      } else {
        await window.api.suppliers.create(form)
      }
    } catch (err) {
      handleApiError(err)
      return
    }
    closeForm()
    load()
  }

  const handleEdit = (s: Supplier): void => {
    setForm({
      name: s.name,
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || ''
    })
    setEditId(s.id)
    setShowForm(true)
  }

  const handleNew = (): void => {
    setForm(emptyForm)
    setEditId(null)
    setShowForm(true)
  }

  const closeForm = (): void => {
    setShowForm(false)
    setEditId(null)
    setForm(emptyForm)
  }

  const { startTour } = usePageTour({ key: 'proveedores', steps: proveedoresTourSteps })

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate('/compras')}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-brand transition-colors"
      >
        <ArrowLeft size={14} />
        Volver a Compras
      </button>

      <PageHeader
        title="Proveedores"
        subtitle={`${total} proveedor${total === 1 ? '' : 'es'} registrado${total === 1 ? '' : 's'}`}
        actions={
          <>
            <TourButton onClick={startTour} />
            <button
              data-tour="proveedores-new"
              onClick={handleNew}
              className="bg-brand text-white px-4 py-2.5 rounded-xl font-medium hover:bg-brand-hover flex items-center gap-2 shadow-sm transition-colors"
            >
              <Plus size={18} />
              Nuevo Proveedor
            </button>
          </>
        }
      />

      <Card
        data-tour="proveedores-table"
        className="rounded-2xl overflow-hidden"
        style={{ boxShadow: 'var(--shadow-card-soft)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-muted/60 text-left text-text-muted">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Dirección</th>
                <th className="px-4 py-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-border hover:bg-surface-muted/40 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-text-main">{s.name}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {s.phone || <span className="text-text-disabled">—</span>}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {s.email || <span className="text-text-disabled">—</span>}
                  </td>
                  <td className="px-4 py-3 text-text-muted truncate max-w-[200px]">
                    {s.address || <span className="text-text-disabled">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleEdit(s)}
                      className="p-1.5 hover:bg-surface-muted rounded-lg text-text-muted hover:text-text-main transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={<Users size={40} />}
                      title="Sin proveedores"
                      description="Cargá los proveedores con los que trabajás para asociarlos a tus órdenes de compra."
                      action={
                        <Button onClick={handleNew}>
                          <Plus size={16} /> Nuevo Proveedor
                        </Button>
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />
      </Card>

      <Modal
        open={showForm}
        onClose={closeForm}
        size="sm"
        title={editId ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={closeForm}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!form.name}>
              {editId ? 'Guardar cambios' : 'Crear'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-text-muted mb-1.5">
              Nombre <span className="text-danger-500">*</span>
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1.5">Teléfono</label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1.5">Email</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1.5">Dirección</label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Opcional"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
