import { memo, useEffect, useState } from 'react'
import { User, X } from 'lucide-react'
import { Input } from '../../components/ui'
import { formatGs } from '../../lib/utils'
import { useDebouncedValue } from '../../lib/use-debounced-value'
import type { Customer } from '@shared/types'

interface Props {
  selected: Customer | null
  onSelect: (c: Customer) => void
  onClear: () => void
}

// Isolated so typing in the search only re-renders THIS small subtree instead of
// the whole (heavy) CobroModal. With the search state living in the parent, every
// keystroke re-rendered the entire modal (totals, mixed lines, processor grids),
// which on a modest PC produced visible input lag — typing "julio" showed "j"
// then jumped to "ulio". Keeping the search state + debounce + IPC here decouples
// it; the parent only hears about an actual selection.
function CustomerPicker({ selected, onSelect, onClear }: Props) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const debounced = useDebouncedValue(search)

  useEffect(() => {
    const term = debounced.trim()
    if (term.length < 2) return
    // Guard against out-of-order IPC resolutions (a later keystroke's results
    // overwriting an earlier, slower query's).
    let alive = true
    window.api.customers.getAll({ search: term }).then((res) => {
      if (alive) setResults(res.items)
    })
    return () => {
      alive = false
    }
  }, [debounced])

  if (selected) {
    return (
      <div className="flex items-center justify-between border border-border rounded-xl p-3 bg-surface-muted/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-brand-light text-brand flex items-center justify-center shrink-0">
            <User size={16} />
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate text-text-main">{selected.name}</p>
            <p className="text-xs text-text-muted tabular-nums">
              Saldo: {formatGs(selected.balance)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-danger-500 hover:text-danger-700 p-1 rounded shrink-0"
          aria-label="Quitar cliente"
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar cliente..."
      />
      {search.trim().length >= 2 && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 bg-surface border border-border rounded-xl mt-1 z-10 max-h-44 overflow-y-auto"
          style={{ boxShadow: 'var(--shadow-popover)' }}
        >
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c)
                setSearch('')
                setResults([])
              }}
              className="w-full text-left px-3 py-2 hover:bg-surface-muted text-sm flex items-center justify-between gap-2"
            >
              <span className="truncate text-text-main">{c.name}</span>
              <span className="text-xs text-text-muted tabular-nums shrink-0">
                {formatGs(c.balance)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(CustomerPicker)
