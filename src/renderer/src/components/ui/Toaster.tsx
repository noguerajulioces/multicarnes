import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { useToastStore, type ToastItem, type ToastType } from '../../store/toast.store'
import { cn } from '../../lib/utils'

const iconMap: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle
}

const toneMap: Record<ToastType, string> = {
  success: 'border-success-500 text-success-700',
  error: 'border-danger-500 text-danger-700',
  info: 'border-info-500 text-info-700',
  warning: 'border-warning-500 text-warning-700'
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const remove = useToastStore((s) => s.remove)

  return (
    <div className="fixed top-12 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastView key={t.id} toast={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  )
}

function ToastView({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const Icon = iconMap[toast.type]
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-sm',
        'bg-surface border-l-4 rounded-md shadow-popover px-3 py-2.5',
        'animate-[toastIn_180ms_ease-out]',
        toneMap[toast.type]
      )}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <p className="flex-1 text-sm font-medium text-text-main">{toast.message}</p>
      <button
        type="button"
        onClick={onClose}
        className="text-text-muted hover:text-text-main shrink-0"
        aria-label="Cerrar"
      >
        <X size={14} />
      </button>
    </div>
  )
}
