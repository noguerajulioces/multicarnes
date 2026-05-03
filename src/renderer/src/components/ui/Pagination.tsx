import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  perPage: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, perPage, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1
  const to = Math.min(safePage * perPage, total)

  if (total === 0) return null

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
      <span className="text-xs text-text-muted tabular-nums">
        Mostrando{' '}
        <span className="font-medium text-text-main">
          {from}-{to}
        </span>{' '}
        de <span className="font-medium text-text-main">{total}</span>
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-sm border border-border bg-surface text-text-main hover:bg-surface-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft size={14} />
          Anterior
        </button>
        <span className="px-3 text-xs text-text-muted tabular-nums">
          Página <span className="font-medium text-text-main">{safePage}</span> de{' '}
          <span className="font-medium text-text-main">{totalPages}</span>
        </span>
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-sm border border-border bg-surface text-text-main hover:bg-surface-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          Siguiente
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
