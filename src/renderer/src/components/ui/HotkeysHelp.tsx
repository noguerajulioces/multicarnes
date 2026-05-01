import { useState } from 'react'
import { Modal } from './Modal'
import { useHotkey } from '../../lib/hotkeys'

interface Shortcut {
  keys: string[]
  description: string
}

interface Section {
  title: string
  shortcuts: Shortcut[]
}

const sections: Section[] = [
  {
    title: 'Globales',
    shortcuts: [
      { keys: ['F1'], description: 'Mostrar / ocultar este menú de atajos' },
      { keys: ['Esc'], description: 'Cerrar diálogos y modales' }
    ]
  },
  {
    title: 'Ventas',
    shortcuts: [
      { keys: ['F4'], description: 'Editar descuento' },
      { keys: ['F8'], description: 'Cancelar venta en curso' },
      { keys: ['F12'], description: 'Abrir cobro' },
      { keys: ['Enter'], description: 'Confirmar código escaneado' }
    ]
  }
]

export function HotkeysHelp() {
  const [open, setOpen] = useState(false)

  useHotkey(
    ['F1', '?'],
    (e) => {
      e.preventDefault()
      setOpen((o) => !o)
    },
    []
  )

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Atajos de teclado" size="md">
      <div className="space-y-5">
        {sections.map((section) => (
          <div key={section.title}>
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
              {section.title}
            </h4>
            <div className="space-y-1.5">
              {section.shortcuts.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-text-main">{s.description}</span>
                  <div className="flex gap-1">
                    {s.keys.map((kk) => (
                      <kbd
                        key={kk}
                        className="px-2 py-0.5 bg-surface-muted text-text-main rounded border border-border font-mono text-xs"
                      >
                        {kk}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="text-xs text-text-muted pt-2 border-t border-border">
          Tocá <kbd className="px-1.5 py-0.5 bg-surface-muted rounded border border-border font-mono text-[10px]">F1</kbd> en cualquier momento para volver a abrir esta ayuda.
        </p>
      </div>
    </Modal>
  )
}
