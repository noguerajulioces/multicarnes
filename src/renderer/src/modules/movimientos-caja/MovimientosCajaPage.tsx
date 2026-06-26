// 003-cash-movements-history T021 + T022
//
// Top-level page composing the filter bar + table + pagination + Excel export
// for the Movimientos de Caja history. Reuses the server-side pagination
// contract from VentasListadoPage and the existing exportToExcel utility.

import { useState } from 'react'
import {
  Card,
  CardBody,
  Button,
  EmptyState,
  PageHeader,
  Pagination,
  TableSkeleton
} from '../../components/ui'
import { exportToExcel } from '../../lib/export'
import { confirm } from '../../lib/confirm'
import { toast } from '../../lib/toast'
import { handleApiError } from '../../lib/api-error'
import { useInFlightGuard } from '../../hooks/use-in-flight-guard'
import { formatDateTime, formatGs } from '../../lib/utils'
import { useAuthStore } from '../../store/auth.store'
import { FileSpreadsheet, History } from 'lucide-react'
import type { CashMovementRow, CashMovementType } from '@shared/types'
import { useMovimientosQuery } from './useMovimientosQuery'
import MovimientosFilters from './MovimientosFilters'
import MovimientosTable from './MovimientosTable'

const EXPORT_WARN_THRESHOLD = 10_000

const TYPE_LABEL_ES: Record<CashMovementType, string> = {
  income: 'Ingreso',
  expense: 'Egreso',
  opening: 'Apertura',
  closing: 'Cierre',
  void: 'Anulación'
}

const exportColumns = [
  { header: 'Fecha', key: '_fecha', width: 20 },
  { header: 'Tipo', key: '_tipo', width: 12 },
  { header: 'Descripción', key: 'description', width: 36 },
  { header: 'Monto', key: '_monto', align: 'right' as const, width: 16 },
  { header: 'Cajero', key: 'userName', width: 18 },
  { header: 'Caja', key: 'registerId', width: 8 },
  { header: 'Anulado', key: '_anulado', width: 10 },
  { header: 'Anulación de', key: 'voidOf', width: 14 }
]

function prepareExport(rows: CashMovementRow[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    ...r,
    _fecha: formatDateTime(r.createdAt),
    _tipo: TYPE_LABEL_ES[r.type],
    _monto: formatGs(r.type === 'expense' ? -r.amount : r.amount),
    _anulado: r.isVoided ? `Sí (por #${r.voidedBy ?? ''})` : 'No',
    voidOf: r.voidOf ?? ''
  }))
}

export default function MovimientosCajaPage(): React.JSX.Element {
  const user = useAuthStore((s) => s.user)
  const callerRole = user?.role
  const { filters, setFilters, data, loading, error, refetch, fetchAllForExport } =
    useMovimientosQuery()
  const [exporting, setExporting] = useState(false)
  const [voidingId, setVoidingId] = useState<number | null>(null)
  // 011-double-submit-guard: lock síncrono para que un doble-click en "Anular" no
  // dispare dos movimientos inversos (descuadraría el arqueo), inmune al re-render.
  const runVoid = useInFlightGuard()

  const onConsultar = (): void => {
    // Filter inputs already update state via onChange; we still expose a
    // button so the UX matches /ventas. Triggering refetch here is redundant
    // (the hook auto-fetches on filter change) but ensures the user gets a
    // visible response even if nothing actually changed.
    void refetch()
  }

  const onPageChange = (next: number): void => {
    setFilters({ page: next })
  }

  const handleExport = async (): Promise<void> => {
    if (!data) return
    if (data.total > EXPORT_WARN_THRESHOLD) {
      const ok = await confirm({
        title: 'Exportación grande',
        message: `Vas a exportar ${data.total} filas. La operación puede demorar y consumir mucha memoria. ¿Querés estrechar el rango de fechas antes?`,
        confirmLabel: 'Exportar igual',
        cancelLabel: 'Cancelar'
      })
      if (!ok) return
    }
    setExporting(true)
    try {
      const all = await fetchAllForExport()
      exportToExcel(
        prepareExport(all.items),
        exportColumns,
        `movimientos-caja_${filters.from}_${filters.to}`,
        `Movimientos de Caja (${filters.from} a ${filters.to})`
      )
    } catch (err) {
      handleApiError(err)
    } finally {
      setExporting(false)
    }
  }

  const handleVoid = async (row: CashMovementRow): Promise<void> => {
    await runVoid(async () => {
      const ok = await confirm({
        title: 'Anular movimiento',
        message: `Vas a anular "${row.description}" por ${formatGs(row.amount)}. Se va a registrar un movimiento inverso, el original queda como historial. ¿Confirmás?`,
        confirmLabel: 'Anular',
        cancelLabel: 'Cancelar',
        danger: true
      })
      if (!ok) return
      setVoidingId(row.id)
      try {
        await window.api.cashMovements.void(row.id)
        toast.success('Movimiento anulado.')
        await refetch()
      } catch (err) {
        handleApiError(err)
      } finally {
        setVoidingId(null)
      }
    })
  }

  const rows = data?.items ?? []
  const total = data?.total ?? 0
  const hasData = rows.length > 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="Movimientos de Caja"
        subtitle="Ingresos, egresos, aperturas y cierres a través de las cajas"
        actions={
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={!hasData || exporting}
            className="rounded-xl"
          >
            <FileSpreadsheet size={16} className="text-success-700" />
            {exporting ? 'Exportando...' : 'Excel'}
          </Button>
        }
      />

      <MovimientosFilters
        filters={filters}
        onChange={setFilters}
        onConsultar={onConsultar}
        loading={loading}
        callerRole={callerRole}
      />

      {error && (
        <Card>
          <CardBody>
            <p className="text-sm text-danger-700">{error}</p>
          </CardBody>
        </Card>
      )}

      {loading && (
        <Card>
          <CardBody>
            <TableSkeleton rows={6} columns={7} />
          </CardBody>
        </Card>
      )}

      {!loading && hasData && (
        <Card
          className="overflow-hidden"
        >
          <MovimientosTable
            rows={rows}
            callerRole={callerRole}
            voidingId={voidingId}
            onVoid={
              callerRole === 'admin' || callerRole === 'supervisor'
                ? (row) => {
                    if (voidingId !== row.id) void handleVoid(row)
                  }
                : undefined
            }
          />
          <Pagination
            page={filters.page}
            perPage={filters.perPage}
            total={total}
            onPageChange={onPageChange}
          />
        </Card>
      )}

      {!loading && !error && !hasData && (
        <Card>
          <CardBody>
            <EmptyState
              icon={<History size={40} />}
              title="Sin movimientos en el período"
              description="Ajustá el rango de fechas o los filtros y volvé a consultar."
            />
          </CardBody>
        </Card>
      )}
    </div>
  )
}
