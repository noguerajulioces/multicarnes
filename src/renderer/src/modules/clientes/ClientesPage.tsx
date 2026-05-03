import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatGs } from '../../lib/utils'
import type { Customer, DocumentType } from '@shared/types'
import { Search, Plus, Eye, Edit2, UserCheck } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select
} from '../../components/ui'

const emptyForm: {
  name: string
  phone: string
  address: string
  document: string
  document_type: DocumentType
  is_employee: boolean
} = { name: '', phone: '', address: '', document: '', document_type: 'CI', is_employee: false }

const PER_PAGE = 50

export default function ClientesPage() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'customers' | 'employees'>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<number | null>(null)

  useEffect(() => {
    setPage(1)
  }, [search, filterType])

  const buildOpts = (): {
    search?: string
    isEmployee?: boolean
    page: number
    perPage: number
  } => ({
    search: search || undefined,
    isEmployee: filterType === 'employees' ? true : filterType === 'customers' ? false : undefined,
    page,
    perPage: PER_PAGE
  })

  useEffect(() => {
    window.api.customers.getAll(buildOpts()).then((res) => {
      setCustomers(res.items)
      setTotal(res.total)
    })
  }, [search, filterType, page])

  const reload = (): void => {
    window.api.customers.getAll(buildOpts()).then((res) => {
      setCustomers(res.items)
      setTotal(res.total)
    })
  }

  const handleSave = async (): Promise<void> => {
    if (!form.name) return
    if (editId) {
      await window.api.customers.update(editId, form)
    } else {
      await window.api.customers.create(form)
    }
    closeForm()
    reload()
  }

  const handleEdit = (c: Customer): void => {
    setForm({
      name: c.name,
      phone: c.phone || '',
      address: c.address || '',
      document: c.document || '',
      document_type: c.document_type || 'CI',
      is_employee: !!c.is_employee
    })
    setEditId(c.id)
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientes"
        subtitle={`${total} cliente${total === 1 ? '' : 's'} registrado${total === 1 ? '' : 's'}`}
        actions={
          <button
            onClick={handleNew}
            className="bg-brand text-white px-4 py-2.5 rounded-xl font-medium hover:bg-brand-hover flex items-center gap-2 shadow-sm transition-colors"
          >
            <Plus size={18} />
            Nuevo Cliente
          </button>
        }
      />

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
            size={16}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
            placeholder="Buscar por nombre, teléfono o documento..."
          />
        </div>
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as 'all' | 'customers' | 'employees')}
          className="w-auto min-w-[160px] rounded-xl"
        >
          <option value="all">Todos</option>
          <option value="customers">Solo clientes</option>
          <option value="employees">Solo empleados</option>
        </Select>
      </div>

      <Card
        className="rounded-2xl overflow-hidden"
        style={{ boxShadow: 'var(--shadow-card-soft)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-muted/60 text-left text-text-muted">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Documento</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium text-right">Saldo</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const owes = c.balance < 0
                return (
                  <tr
                    key={c.id}
                    className="border-t border-border hover:bg-surface-muted/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-text-main">{c.name}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {c.document ? (
                        <span className="inline-flex items-center gap-2">
                          <Badge tone="neutral">{c.document_type || 'Doc'}</Badge>
                          <span className="tabular-nums">{c.document}</span>
                        </span>
                      ) : (
                        <span className="text-text-disabled">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {c.phone || <span className="text-text-disabled">—</span>}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium tabular-nums ${
                        owes ? 'text-danger-700' : c.balance > 0 ? 'text-success-700' : ''
                      }`}
                    >
                      {formatGs(c.balance)}
                    </td>
                    <td className="px-4 py-3">
                      {c.is_employee ? (
                        <Badge tone="info">Empleado</Badge>
                      ) : (
                        <span className="text-text-disabled text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => navigate(`/clientes/${c.id}`)}
                          className="p-1.5 hover:bg-surface-muted rounded-lg text-text-muted hover:text-text-main transition-colors"
                          title="Ver ficha"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleEdit(c)}
                          className="p-1.5 hover:bg-surface-muted rounded-lg text-text-muted hover:text-text-main transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    {search ? (
                      <EmptyState
                        icon={<Search size={40} />}
                        title="Sin resultados"
                        description={`Ningún cliente coincide con "${search}".`}
                      />
                    ) : (
                      <EmptyState
                        icon={<UserCheck size={40} />}
                        title="Aún no hay clientes"
                        description="Cargá clientes para llevar registro de saldos y pagos."
                        action={
                          <Button onClick={handleNew}>
                            <Plus size={16} /> Nuevo Cliente
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
        <Pagination page={page} perPage={PER_PAGE} total={total} onPageChange={setPage} />
      </Card>

      <Modal
        open={showForm}
        onClose={closeForm}
        size="sm"
        title={editId ? 'Editar Cliente' : 'Nuevo Cliente'}
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
            <label className="block text-sm text-text-muted mb-1.5">Documento</label>
            <div className="flex gap-2">
              <Select
                value={form.document_type}
                onChange={(e) =>
                  setForm({ ...form, document_type: e.target.value as DocumentType })
                }
                className="w-24"
              >
                <option value="CI">CI</option>
                <option value="RUC">RUC</option>
              </Select>
              <Input
                value={form.document}
                onChange={(e) => setForm({ ...form, document: e.target.value })}
                placeholder="Número"
                className="flex-1 tabular-nums"
              />
            </div>
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
            <label className="block text-sm text-text-muted mb-1.5">Dirección</label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          <label className="flex items-center gap-2 text-sm pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_employee}
              onChange={(e) => setForm({ ...form, is_employee: e.target.checked })}
              className="w-4 h-4 rounded accent-brand"
            />
            <span className="text-text-main">Es empleado</span>
          </label>
        </div>
      </Modal>
    </div>
  )
}
