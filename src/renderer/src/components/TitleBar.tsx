import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.api.window.isMaximized().then(setIsMaximized)
    const unsubscribe = window.api.window.onStateChange(setIsMaximized)
    return () => unsubscribe()
  }, [])

  const btn =
    'h-full w-11 inline-flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-colors'

  return (
    <div
      className="h-8 bg-brand shrink-0 select-none border-b border-white/10 flex items-stretch"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex-1" />
      <div
        className="flex items-stretch"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => window.api.window.minimize()}
          className={btn}
          aria-label="Minimizar"
          title="Minimizar"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={() => window.api.window.maximizeToggle()}
          className={btn}
          aria-label={isMaximized ? 'Restaurar' : 'Maximizar'}
          title={isMaximized ? 'Restaurar' : 'Maximizar'}
        >
          {isMaximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          type="button"
          onClick={() => window.api.window.close()}
          className="h-full w-11 inline-flex items-center justify-center text-white/85 hover:text-white hover:bg-danger-700 transition-colors"
          aria-label="Cerrar"
          title="Cerrar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
