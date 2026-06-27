import { useEffect } from 'react'
import type { Sale } from '@shared/types'
import { formatGs } from '../../lib/utils'

interface Props {
  sale: Sale
  onDone: () => void
}

// Momento de éxito tras registrar la venta: confirma de forma inequívoca que la
// venta YA quedó guardada (N° + total) ANTES de mostrar el comprobante, así el
// botón del ticket no necesita decir "Registrar" (la venta ya está hecha).
// Avanza solo tras SUCCESS_MS; un clic lo saltea para el cajero apurado.
const SUCCESS_MS = 1900

export default function SaleSuccessSplash({ sale, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, SUCCESS_MS)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onDone}
      role="status"
      aria-live="polite"
    >
      <div
        className="bg-surface rounded-2xl shadow-modal px-12 py-12 flex flex-col items-center text-center"
        style={{ animation: 'fadeInUp 280ms ease-out both' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center mb-6">
          {/* Pulso que se expande detrás del disco */}
          <span
            className="absolute w-24 h-24 rounded-full"
            style={{
              background: 'var(--color-success-500)',
              animation: 'successRing 1200ms ease-out both'
            }}
          />
          {/* Disco verde que aparece con un pop */}
          <span
            className="relative w-24 h-24 rounded-full flex items-center justify-center"
            style={{
              background: 'var(--gradient-kpi-green)',
              animation: 'successPop 600ms cubic-bezier(0.18, 0.89, 0.32, 1.28) both'
            }}
          >
            {/* Check que se dibuja solo (stroke-dashoffset) */}
            <svg viewBox="0 0 24 24" className="w-12 h-12" fill="none" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                stroke="white"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ strokeDasharray: 24, animation: 'checkDraw 550ms 300ms ease-out both' }}
              />
            </svg>
          </span>
        </div>
        <p className="text-sm font-medium text-text-muted">¡Venta registrada!</p>
        <p className="text-display-lg font-bold text-success-700 tabular-nums leading-none mt-1">
          {formatGs(sale.total)}
        </p>
        <p className="text-sm text-text-muted mt-3">Venta #{sale.id}</p>
      </div>
    </div>
  )
}
