// 003-cash-movements-history T019
//
// Filter bar for the Movimientos de Caja page. Presentational — emits a
// patch to the parent's filter state. For US1 the cashier dropdown is always
// enabled (page is admin/supervisor only); US2 (T026) will lock it when the
// role is cajero.

import { useEffect, useState } from 'react'
import { Button, Card, CardBody, Input, Select } from '../../components/ui'
import { Search } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import type { CashMovementType, CashRegister, User, Role } from '@shared/types'
import type { MovimientosFilters as Filters } from './useMovimientosQuery'

const TYPE_LABEL: Record<CashMovementType, string> = {
  income: 'Ingreso',
  expense: 'Egreso',
  opening: 'Apertura',
  closing: 'Cierre',
  void: 'Anulación'
}

interface Props {
  filters: Filters
  onChange: (patch: Partial<Filters>) => void
  onConsultar: () => void
  loading: boolean
  callerRole: Role | undefined
}

export default function MovimientosFilters({
  filters,
  onChange,
  onConsultar,
  loading,
  callerRole
}: Props): React.JSX.Element {
  const [users, setUsers] = useState<User[]>([])
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const cashierLocked = callerRole === 'cajero'
  const authUser = useAuthStore((s) => s.user)

  useEffect(() => {
    // Cashier-locked: don't bother fetching the user list. Admin/supervisor
    // see all cashiers so they can filter.
    if (cashierLocked) return
    void window.api.users.getAll().then(setUsers)
  }, [cashierLocked])

  // US2 (T026): when the caller is a cajero, force the userId filter to
  // their own id so the dropdown shows their name. Server-side scoping in
  // listMovements already enforces this, but the UI hint avoids the
  // confusing "Todos" label while the field is disabled.
  useEffect(() => {
    if (cashierLocked && authUser && filters.userId !== authUser.id) {
      onChange({ userId: authUser.id })
    }
  }, [cashierLocked, authUser, filters.userId, onChange])

  useEffect(() => {
    void window.api.cash.getAll().then((rows) => setRegisters(rows ?? []))
  }, [])

  const toggleType = (t: CashMovementType): void => {
    const next = filters.types.includes(t)
      ? filters.types.filter((x) => x !== t)
      : [...filters.types, t]
    onChange({ types: next })
  }

  return (
    <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Desde</label>
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => onChange({ from: e.target.value })}
              className="w-44"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Hasta</label>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => onChange({ to: e.target.value })}
              className="w-44"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Cajero</label>
            <Select
              value={filters.userId ?? ''}
              disabled={cashierLocked}
              onChange={(e) =>
                onChange({ userId: e.target.value ? Number(e.target.value) : undefined })
              }
              className="w-48"
            >
              {cashierLocked && authUser ? (
                <option value={authUser.id}>{authUser.name}</option>
              ) : (
                <>
                  <option value="">Todos</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </>
              )}
            </Select>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Caja</label>
            <Select
              value={filters.registerId ?? ''}
              onChange={(e) =>
                onChange({ registerId: e.target.value ? Number(e.target.value) : undefined })
              }
              className="w-56"
            >
              <option value="">Todas</option>
              {registers.map((r) => (
                <option key={r.id} value={r.id}>
                  #{r.id} — {r.user_name ?? '?'} ·{' '}
                  {r.status === 'open' ? 'Abierta' : (r.closed_at ?? '').slice(0, 10)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs text-text-muted mb-1">Buscar en descripción</label>
            <Input
              type="text"
              value={filters.search}
              placeholder="Texto a buscar"
              onChange={(e) => onChange({ search: e.target.value })}
            />
          </div>
          <Button onClick={onConsultar} disabled={loading} className="rounded-xl">
            <Search size={16} />
            {loading ? 'Cargando...' : 'Consultar'}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-muted">Tipo:</span>
          {(Object.keys(TYPE_LABEL) as CashMovementType[]).map((t) => {
            const active = filters.types.includes(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  active
                    ? 'bg-brand text-white border-brand'
                    : 'bg-surface text-text-muted border-border hover:bg-surface-muted'
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            )
          })}
          {filters.types.length > 0 && (
            <button
              type="button"
              onClick={() => onChange({ types: [] })}
              className="text-xs text-text-muted underline ml-2"
            >
              Limpiar
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-text-muted">Por página:</label>
            <Select
              value={filters.perPage}
              onChange={(e) => onChange({ perPage: Number(e.target.value) })}
              className="w-20"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </Select>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
