import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatGs, formatDateTime, todayStr, firstDayOfMonthStr } from '../../lib/utils'
import { exportToExcel, exportToPDF } from '../../lib/export'
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  PageHeader,
  TableSkeleton
} from '../../components/ui'
import type { PaymentMethod, Sale } from '@shared/types'
import { Eye, FileSpreadsheet, FileText, Plus, Printer, Search } from 'lucide-react'
import TicketPreviewModal from '../ventas/TicketPreviewModal'

const methodLabels: Record<string, string> = {
  cash: 'Efectivo',
  credit: 'Fiado',
  transfer: 'Transferencia',
  mixed: 'Mixto'
}

const methodTone: Record<PaymentMethod, 'success' | 'warning' | 'info' | 'neutral'> = {
  cash: 'success',
  credit: 'warning',
  transfer: 'info',
  mixed: 'neutral'
}

const exportColumns = [
  { header: 'Fecha', key: '_fecha', width: 18 },
  { header: 'N°', key: '_num', width: 8 },
  { header: 'Cliente', key: 'customer_name', width: 20 },
  { header: 'Total', key: '_total', align: 'right' as const, width: 15 },
  { header: 'Método', key: '_method', width: 14 },
  { header: 'Cajero', key: 'user_name', width: 18 }
]

const tableHeadCls = 'bg-surface-muted/60 text-left text-text-muted'
const thCls = 'px-4 py-3 font-medium'
const trCls = 'border-t border-border hover:bg-surface-muted/40 transition-colors cursor-pointer'
const tdCls = 'px-4 py-3'

export default function VentasListadoPage() {
  const navigate = useNavigate()
  const [from, setFrom] = useState(firstDayOfMonthStr())
  const [to, setTo] = useState(todayStr())
  const [data, setData] = useState<Sale[]>([])
  const [loading, setLoading] = useState(false)
  const [printSale, setPrintSale] = useState<Sale | null>(null)
  const [printingId, setPrintingId] = useState<number | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      const sales = await window.api.reports.salesByPeriod(from, to)
      setData(sales as Sale[])
    } catch {
      /* ignore */
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goToDetail = (id: number): void => {
    navigate(`/ventas/${id}`)
  }

  const openPrint = async (id: number): Promise<void> => {
    setPrintingId(id)
    try {
      const sale = await window.api.sales.getById(id)
      if (sale) setPrintSale(sale)
    } finally {
      setPrintingId(null)
    }
  }

  const prepareExport = (): Record<string, unknown>[] =>
    data.map((s) => {
      const isCredit = s.payment_method === 'credit'
      const creditPaid = isCredit && s.customer_balance != null && s.customer_balance >= 0
      return {
        ...s,
        _fecha: formatDateTime(s.created_at),
        _num: `#${s.id}`,
        customer_name: s.customer_name || '-',
        _total: formatGs(s.total),
        _method: creditPaid ? 'Fiado · Pagado' : methodLabels[s.payment_method] || s.payment_method
      }
    })

  const handleExportExcel = (): void => {
    exportToExcel(prepareExport(), exportColumns, `ventas_${from}_${to}`, `Ventas (${from} a ${to})`)
  }

  const handleExportPDF = (): void => {
    exportToPDF(prepareExport(), exportColumns, `ventas_${from}_${to}`, `Ventas (${from} a ${to})`)
  }

  const hasData = data.length > 0
  const showEmpty = !loading && !hasData

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ventas"
        subtitle="Listado de ventas registradas en el período"
        actions={
          <Button onClick={() => navigate('/pos')} className="rounded-xl">
            <Plus size={16} />
            Nueva venta
          </Button>
        }
      />

      <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
        <CardBody className="space-y-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs text-text-muted mb-1">Desde</label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-44"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Hasta</label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-44"
              />
            </div>
            <Button onClick={load} disabled={loading} className="rounded-xl">
              <Search size={16} />
              {loading ? 'Cargando...' : 'Consultar'}
            </Button>

            {hasData && (
              <div className="ml-auto flex gap-2">
                <Button variant="secondary" onClick={handleExportExcel} className="rounded-xl">
                  <FileSpreadsheet size={16} className="text-success-700" />
                  Excel
                </Button>
                <Button variant="secondary" onClick={handleExportPDF} className="rounded-xl">
                  <FileText size={16} className="text-danger-700" />
                  PDF
                </Button>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {loading && (
        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
          <CardBody>
            <TableSkeleton rows={6} columns={7} />
          </CardBody>
        </Card>
      )}

      {!loading && hasData && (
        <Card
          className="rounded-2xl overflow-hidden"
          style={{ boxShadow: 'var(--shadow-card-soft)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeadCls}>
                  <th className={thCls}>Fecha</th>
                  <th className={thCls}>N°</th>
                  <th className={thCls}>Cliente</th>
                  <th className={`${thCls} text-right`}>Total</th>
                  <th className={thCls}>Método</th>
                  <th className={thCls}>Cajero</th>
                  <th className={`${thCls} text-right w-28`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => {
                  const isCredit = s.payment_method === 'credit'
                  const creditPaid =
                    isCredit && s.customer_balance != null && s.customer_balance >= 0
                  const isPrinting = printingId === s.id
                  return (
                    <tr key={s.id} className={trCls} onClick={() => goToDetail(s.id)}>
                      <td className={`${tdCls} text-text-muted tabular-nums`}>
                        {formatDateTime(s.created_at)}
                      </td>
                      <td className={`${tdCls} font-medium`}>#{s.id}</td>
                      <td className={tdCls}>
                        {s.customer_name || (
                          <span className="text-text-disabled">Consumidor final</span>
                        )}
                      </td>
                      <td className={`${tdCls} text-right font-medium tabular-nums`}>
                        {formatGs(s.total)}
                      </td>
                      <td className={tdCls}>
                        {creditPaid ? (
                          <Badge tone="success">Fiado · Pagado</Badge>
                        ) : (
                          <Badge tone={methodTone[s.payment_method]}>
                            {methodLabels[s.payment_method] || s.payment_method}
                          </Badge>
                        )}
                      </td>
                      <td className={`${tdCls} text-text-muted`}>{s.user_name}</td>
                      <td className={`${tdCls} text-right`}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              goToDetail(s.id)
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-brand hover:bg-brand-light transition-colors"
                            title="Ver detalle"
                            aria-label={`Ver detalle de venta #${s.id}`}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openPrint(s.id)
                            }}
                            disabled={isPrinting}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-brand hover:bg-brand-light transition-colors disabled:opacity-40 disabled:cursor-wait"
                            title="Imprimir ticket"
                            aria-label={`Imprimir ticket de venta #${s.id}`}
                          >
                            <Printer size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-muted/40">
                  <td colSpan={3} className="px-4 py-3 font-medium text-text-muted">
                    Total: {data.length} ventas
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-brand tabular-nums">
                    {formatGs(data.reduce((s, v) => s + v.total, 0))}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {showEmpty && (
        <Card className="rounded-2xl" style={{ boxShadow: 'var(--shadow-card-soft)' }}>
          <CardBody>
            <EmptyState
              icon={<FileText size={40} />}
              title="Sin ventas en el período"
              description='Ajustá el rango de fechas y hacé click en "Consultar".'
            />
          </CardBody>
        </Card>
      )}

      {printSale && (
        <TicketPreviewModal
          sale={printSale}
          onClose={() => setPrintSale(null)}
          closeLabel="Cerrar"
        />
      )}
    </div>
  )
}
