import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, DollarSign, Lock, LogOut } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useCashStore } from '../../store/cash.store'
import { Badge, EmptyState, Button } from '../../components/ui'
import VentasPage from './VentasPage'

export default function PosScreen() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const register = useCashStore((s) => s.register)

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center bg-bg-secondary">
        <EmptyState
          icon={<Lock size={48} />}
          title="Sesión no iniciada"
          description="Iniciá sesión para usar el punto de venta."
          action={<Button onClick={() => navigate('/login')}>Ir a Login</Button>}
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-bg-secondary">
      <PosHeader
        userName={user.name}
        cashOpen={register != null}
        onClose={() => navigate('/dashboard')}
        onCloseRegister={() => navigate('/caja/cierre')}
      />
      <div className="flex-1 min-h-0 p-4">
        <VentasPage />
      </div>
    </div>
  )
}

function PosHeader({
  userName,
  cashOpen,
  onClose,
  onCloseRegister
}: {
  userName: string
  cashOpen: boolean
  onClose: () => void
  onCloseRegister: () => void
}): React.ReactElement {
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')

  return (
    <div className="bg-surface border-b border-border h-12 flex items-center px-4 gap-3 shrink-0">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-text-main hover:bg-surface-muted transition-colors"
      >
        <ArrowLeft size={16} />
        Salir
      </button>
      <div className="h-5 w-px bg-border" />
      <h1 className="font-semibold text-sm text-text-main">Punto de Venta</h1>
      <div className="ml-auto flex items-center gap-3 text-xs">
        {cashOpen ? (
          <div className="inline-flex items-center bg-success-50 text-success-700 rounded-full pl-2.5 pr-1 py-0.5 gap-2 border border-success-200">
            <span className="inline-flex items-center gap-1 font-medium">
              <DollarSign size={12} />
              Caja abierta
            </span>
            <span className="h-3.5 w-px bg-success-200" />
            <button
              type="button"
              onClick={onCloseRegister}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium hover:bg-success-100 transition-colors"
            >
              <LogOut size={12} />
              Cerrar
            </button>
          </div>
        ) : (
          <Badge tone="neutral">
            <DollarSign size={12} />
            Caja cerrada
          </Badge>
        )}
        <PosClock />
        <div
          className="w-7 h-7 rounded-full bg-brand-light text-brand text-xs font-semibold flex items-center justify-center"
          title={userName}
        >
          {initials || userName.charAt(0).toUpperCase()}
        </div>
      </div>
    </div>
  )
}

function PosClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const time = now.toLocaleTimeString('es-PY', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  return <span className="font-medium text-text-main tabular-nums">{time}</span>
}
