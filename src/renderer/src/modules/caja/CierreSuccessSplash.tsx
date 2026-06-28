import { useEffect } from 'react'
import { formatGs } from '../../lib/utils'

interface Props {
  // counted − expected: 0 = cuadra, >0 sobrante, <0 faltante.
  difference: number
  onDone: () => void
}

// Momento de éxito tras cerrar la caja: confirma de forma inequívoca que el
// cierre YA quedó registrado (igual que el splash de venta). Avanza solo tras
// SUCCESS_MS; un clic lo saltea.
const SUCCESS_MS = 1900

export default function CierreSuccessSplash({ difference, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, SUCCESS_MS)
    return () => clearTimeout(t)
  }, [onDone])

  const cuadra = difference === 0
  const resultText = cuadra
    ? 'Caja cuadrada'
    : difference > 0
      ? `Sobrante ${formatGs(difference)}`
      : `Faltante ${formatGs(-difference)}`
  const resultClass = difference < 0 ? 'text-danger-700' : 'text-success-700'

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
        <p className="text-sm font-medium text-text-muted">¡Caja cerrada!</p>
        <p className={`text-3xl font-bold tabular-nums leading-none mt-1 ${resultClass}`}>
          {resultText}
        </p>
        <p className="text-sm text-text-muted mt-3">Turno cerrado correctamente</p>
      </div>
    </div>
  )
}
