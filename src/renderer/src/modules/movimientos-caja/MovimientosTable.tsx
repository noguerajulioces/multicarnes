// 003-cash-movements-history T020
//
// Table presentation for the Movimientos de Caja page. Renders type with an
// icon/colour, amount with the correct sign per row meaning, and the voided
// flag. For US1 the actions column is rendered but empty (US3 fills in the
// "Anular" button); for cajero (US2) the whole actions column is hidden.

import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui'
import { formatGs, formatDateTime } from '../../lib/utils'
import { ArrowDownToLine, ArrowUpFromLine, DoorOpen, DoorClosed, Undo2, Link2 } from 'lucide-react'
import type { CashMovementRow, CashMovementType, Role } from '@shared/types'

const TYPE_META: Record<
  CashMovementType,
  { label: string; tone: 'success' | 'warning' | 'info' | 'neutral'; sign: 1 | -1 | 0 }
> = {
  income: { label: 'Ingreso', tone: 'success', sign: 1 },
  expense: { label: 'Egreso', tone: 'warning', sign: -1 },
  opening: { label: 'Apertura', tone: 'info', sign: 0 },
  closing: { label: 'Cierre', tone: 'info', sign: 0 },
  void: { label: 'Anulación', tone: 'neutral', sign: 0 }
}

const TYPE_ICON: Record<CashMovementType, typeof ArrowDownToLine> = {
  income: ArrowDownToLine,
  expense: ArrowUpFromLine,
  opening: DoorOpen,
  closing: DoorClosed,
  void: Undo2
}

const tableHeadCls = 'bg-surface-muted/60 text-left text-text-muted'
const thCls = 'px-4 py-3 font-medium'
const trCls = 'border-t border-border hover:bg-surface-muted/40 transition-colors'
const tdCls = 'px-4 py-3'

interface Props {
  rows: CashMovementRow[]
  callerRole: Role | undefined
  onVoid?: (row: CashMovementRow) => void
  voidingId?: number | null
}

export default function MovimientosTable({
  rows,
  callerRole,
  onVoid,
  voidingId
}: Props): React.JSX.Element {
  const navigate = useNavigate()
  const showActions = callerRole !== 'cajero'

  const goToRegister = (row: CashMovementRow): void => {
    if (row.registerStatus === 'open') {
      navigate('/caja')
    } else {
      // US4 (T031): deep-link into the existing "Cierres Caja" tab in Reportes.
      navigate(`/reportes?tab=caja&registerId=${row.registerId}`)
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className={tableHeadCls}>
            <th className={thCls}>Fecha</th>
            <th className={thCls}>Tipo</th>
            <th className={thCls}>Descripción</th>
            <th className={`${thCls} text-right`}>Monto</th>
            <th className={thCls}>Cajero</th>
            <th className={thCls}>Caja</th>
            {showActions && <th className={`${thCls} text-right w-28`}>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const meta = TYPE_META[row.type]
            const Icon = TYPE_ICON[row.type]
            const displayAmount = meta.sign === -1 ? -row.amount : row.amount
            const amountClass = row.isVoided
              ? 'line-through text-text-disabled'
              : meta.sign === -1
                ? 'text-danger-700'
                : meta.sign === 1
                  ? 'text-success-700'
                  : 'text-text-main'
            return (
              <tr key={row.id} className={trCls}>
                <td className={`${tdCls} text-text-muted tabular-nums whitespace-nowrap`}>
                  {formatDateTime(row.createdAt)}
                </td>
                <td className={tdCls}>
                  <Badge tone={meta.tone}>
                    <span className="inline-flex items-center gap-1">
                      <Icon size={12} />
                      {meta.label}
                    </span>
                  </Badge>
                </td>
                <td className={tdCls}>
                  <div className="flex flex-col">
                    <span className={row.isVoided ? 'line-through text-text-disabled' : ''}>
                      {row.description}
                    </span>
                    {row.isVoided && row.voidedBy != null && (
                      <span className="text-[11px] text-text-muted">
                        Anulado por #{row.voidedBy}
                      </span>
                    )}
                    {row.type === 'void' && row.voidOf != null && (
                      <span className="text-[11px] text-text-muted inline-flex items-center gap-1">
                        <Link2 size={11} />
                        Anulación de #{row.voidOf}
                      </span>
                    )}
                  </div>
                </td>
                <td className={`${tdCls} text-right font-medium tabular-nums ${amountClass}`}>
                  {formatGs(displayAmount)}
                </td>
                <td className={`${tdCls} text-text-muted`}>{row.userName || '?'}</td>
                <td className={tdCls}>
                  <button
                    type="button"
                    onClick={() => goToRegister(row)}
                    className="text-xs text-brand hover:underline"
                    title={
                      row.registerStatus === 'open'
                        ? 'Ir a la caja abierta'
                        : 'Ir al detalle del cierre'
                    }
                  >
                    #{row.registerId}
                  </button>
                </td>
                {showActions && (
                  <td className={`${tdCls} text-right`}>
                    {onVoid &&
                    !row.isVoided &&
                    (row.type === 'income' || row.type === 'expense') ? (
                      <button
                        type="button"
                        onClick={() => onVoid(row)}
                        disabled={voidingId === row.id}
                        className="text-xs px-2 py-1 rounded-md border border-border text-text-muted hover:bg-surface-muted hover:text-text-main transition-colors disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {voidingId === row.id ? 'Anulando...' : 'Anular'}
                      </button>
                    ) : null}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
