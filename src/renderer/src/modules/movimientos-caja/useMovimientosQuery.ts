// 003-cash-movements-history T018
//
// Filter state + fetch hook for the Movimientos de Caja page. State is mirrored
// to URL search params so navigating away and back preserves filters (FR-014);
// a cold reload resets to defaults.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { todayStr } from '../../lib/utils'
import type { CashMovementListOpts, CashMovementListResult, CashMovementType } from '@shared/types'

export interface MovimientosFilters {
  from: string
  to: string
  types: CashMovementType[]
  userId: number | undefined
  registerId: number | undefined
  search: string
  page: number
  perPage: number
}

const DEFAULT_PER_PAGE = 25

function parseTypes(raw: string | null): CashMovementType[] {
  if (!raw) return []
  const allowed: CashMovementType[] = ['income', 'expense', 'opening', 'closing', 'void']
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t): t is CashMovementType => (allowed as string[]).includes(t))
}

function parseIntOrUndef(raw: string | null): number | undefined {
  if (!raw) return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function useMovimientosQuery() {
  const [searchParams, setSearchParams] = useSearchParams()

  const readFromParams = useCallback((): MovimientosFilters => {
    const today = todayStr()
    return {
      from: searchParams.get('from') || today,
      to: searchParams.get('to') || today,
      types: parseTypes(searchParams.get('types')),
      userId: parseIntOrUndef(searchParams.get('userId')),
      registerId: parseIntOrUndef(searchParams.get('registerId')),
      search: searchParams.get('search') || '',
      page: parseIntOrUndef(searchParams.get('page')) ?? 1,
      perPage: parseIntOrUndef(searchParams.get('perPage')) ?? DEFAULT_PER_PAGE
    }
  }, [searchParams])

  const [filters, setFiltersState] = useState<MovimientosFilters>(() => readFromParams())
  const [data, setData] = useState<CashMovementListResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const syncToParams = useCallback(
    (next: MovimientosFilters) => {
      const params: Record<string, string> = {}
      const today = todayStr()
      if (next.from && next.from !== today) params.from = next.from
      if (next.to && next.to !== today) params.to = next.to
      if (next.types.length > 0) params.types = next.types.join(',')
      if (next.userId !== undefined) params.userId = String(next.userId)
      if (next.registerId !== undefined) params.registerId = String(next.registerId)
      if (next.search) params.search = next.search
      if (next.page > 1) params.page = String(next.page)
      if (next.perPage !== DEFAULT_PER_PAGE) params.perPage = String(next.perPage)
      setSearchParams(params, { replace: true })
    },
    [setSearchParams]
  )

  const setFilters = useCallback(
    (patch: Partial<MovimientosFilters>): void => {
      setFiltersState((prev) => {
        // Any change other than a page-only change resets to page 1 (FR-013).
        const changedKeys = Object.keys(patch) as (keyof MovimientosFilters)[]
        const onlyPageChange = changedKeys.length === 1 && changedKeys[0] === 'page'
        const next: MovimientosFilters = {
          ...prev,
          ...patch,
          page: onlyPageChange ? (patch.page ?? prev.page) : 1
        }
        syncToParams(next)
        return next
      })
    },
    [syncToParams]
  )

  const buildOpts = useCallback(
    (f: MovimientosFilters): CashMovementListOpts => ({
      from: f.from || undefined,
      to: f.to || undefined,
      types: f.types.length > 0 ? f.types : undefined,
      userId: f.userId,
      registerId: f.registerId,
      search: f.search || undefined,
      page: f.page,
      perPage: f.perPage
    }),
    []
  )

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.cashMovements.list(buildOpts(filters))
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [filters, buildOpts])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const fetchAllForExport = useCallback(async (): Promise<CashMovementListResult> => {
    // First pass: get the total to size the second pass; the listMovements
    // query caps perPage at 100, so we chunk if total > 100.
    const first = await window.api.cashMovements.list(
      buildOpts({ ...filters, page: 1, perPage: 100 })
    )
    if (first.total <= 100) return first
    const pages = Math.ceil(first.total / 100)
    const items = [...first.items]
    for (let p = 2; p <= pages; p++) {
      const chunk = await window.api.cashMovements.list(
        buildOpts({ ...filters, page: p, perPage: 100 })
      )
      items.push(...chunk.items)
    }
    return { items, total: first.total, page: 1, perPage: first.total }
  }, [filters, buildOpts])

  const result = useMemo(
    () => ({
      filters,
      setFilters,
      data,
      loading,
      error,
      refetch,
      fetchAllForExport
    }),
    [filters, setFilters, data, loading, error, refetch, fetchAllForExport]
  )

  return result
}
