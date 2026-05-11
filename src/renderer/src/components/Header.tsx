import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  CreditCard,
  DollarSign,
  LogOut,
  UserCircle2
} from 'lucide-react'
import { useCashStore } from '../store/cash.store'
import { useAuthStore } from '../store/auth.store'
import { useLogoutGuard } from '../hooks/use-logout-guard'
import { LogoutBlockedModal } from './LogoutBlockedModal'

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/ventas': 'Ventas',
  '/pos': 'Punto de Venta',
  '/caja': 'Caja',
  '/caja/apertura': 'Apertura',
  '/caja/cierre': 'Cierre',
  '/productos': 'Productos',
  '/productos/nuevo': 'Nuevo',
  '/compras': 'Compras',
  '/compras/nueva': 'Nueva',
  '/proveedores': 'Proveedores',
  '/clientes': 'Clientes',
  '/reportes': 'Reportes',
  '/usuarios': 'Usuarios',
  '/perfil': 'Mi perfil',
  '/configuracion': 'Configuración',
  '/backup': 'Backup'
}

interface Crumb {
  label: string
  to?: string
}

function getBreadcrumb(pathname: string): Crumb[] {
  const parts = pathname.split('/').filter(Boolean)
  // En páginas top-level (depth 1) la PageHeader ya muestra el título;
  // sólo mostramos breadcrumbs cuando hay un nivel adicional.
  if (parts.length < 2) return []

  const out: Crumb[] = []
  let cumPath = ''
  parts.forEach((part, i) => {
    cumPath += '/' + part
    const isLast = i === parts.length - 1
    if (/^\d+$/.test(part)) {
      out.push({ label: 'Detalle' })
    } else {
      const label = routeLabels[cumPath] ?? part.charAt(0).toUpperCase() + part.slice(1)
      out.push({ label, to: isLast ? undefined : cumPath })
    }
  })
  return out
}

export default function Header() {
  const location = useLocation()
  const crumbs = getBreadcrumb(location.pathname)

  return (
    <header className="bg-surface border-b border-border px-6 h-12 flex items-center justify-between shrink-0">
      <nav aria-label="Breadcrumb" className="flex items-center text-sm min-w-0">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center min-w-0">
            {i > 0 && <ChevronRight size={14} className="text-text-disabled mx-1 shrink-0" />}
            {c.to ? (
              <Link to={c.to} className="text-text-muted hover:text-brand truncate">
                {c.label}
              </Link>
            ) : (
              <span className="text-text-main font-medium truncate">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="flex items-center gap-3 shrink-0">
        <CashBadge />
        <NotificationBell />
        <Clock />
        <UserAvatar />
      </div>
    </header>
  )
}

function UserAvatar(): React.ReactElement | null {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const logoutGuard = useLogoutGuard()

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!user) return null
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')

  // 004-logout-cash-close: route logout through useLogoutGuard. The hook owns
  // the auth-store teardown and the #/login navigation on the allow path.
  const handleLogout = (): void => {
    setOpen(false)
    void logoutGuard.requestLogout()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={user.name}
        aria-label="Menú de usuario"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-8 h-8 rounded-full bg-brand-light text-brand text-xs font-semibold flex items-center justify-center shrink-0 hover:ring-2 hover:ring-brand/30 transition"
      >
        {initials || user.name.charAt(0).toUpperCase()}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-20 w-56 bg-surface border border-border rounded-xl overflow-hidden"
          style={{ boxShadow: 'var(--shadow-popover)' }}
        >
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-sm font-semibold text-text-main truncate">{user.name}</p>
            <p className="text-xs text-text-muted capitalize">{user.role}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              navigate('/perfil')
            }}
            className="w-full text-left px-3 py-2.5 hover:bg-surface-muted flex items-center gap-2.5 text-sm text-text-main transition-colors"
          >
            <UserCircle2 size={16} className="text-text-muted" />
            Mi perfil
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="w-full text-left px-3 py-2.5 hover:bg-surface-muted flex items-center gap-2.5 text-sm text-danger-700 border-t border-border transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      )}
      <LogoutBlockedModal
        state={logoutGuard.state}
        onClose={logoutGuard.dismiss}
        onProceed={logoutGuard.proceedToClose}
        onRetry={() => void logoutGuard.retry()}
      />
    </div>
  )
}

function CashBadge(): React.ReactElement {
  const register = useCashStore((s) => s.register)
  const open = register != null
  return (
    <Link
      to="/caja"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
        open
          ? 'bg-success-50 text-success-700 hover:bg-success-50/70'
          : 'bg-surface-muted text-text-muted hover:bg-surface-sunken'
      }`}
    >
      <DollarSign size={12} />
      {open ? 'Caja abierta' : 'Caja cerrada'}
    </Link>
  )
}

function Clock(): React.ReactElement {
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
  const date = now.toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit'
  })
  return (
    <div className="text-xs text-text-muted tabular-nums leading-tight text-right">
      <div className="font-medium text-text-main">{time}</div>
      <div>{date}</div>
    </div>
  )
}

function NotificationBell(): React.ReactElement {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isCajero = user?.role === 'cajero'
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)

  const refresh = async (): Promise<void> => {
    try {
      const tasks: Promise<unknown>[] = [window.api.products.lowStock()]
      if (!isCajero) tasks.push(window.api.reports.pendingCredits())
      const results = await Promise.all(tasks)
      const low = results[0] as unknown[]
      setLowStockCount(low.length)
      if (!isCajero) {
        const pending = results[1] as unknown[]
        setPendingCount(pending.length)
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refresh()
    // refresh discreto cada 60s para mantener al día las alertas
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCajero])

  useEffect(() => {
    if (open) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const total = lowStockCount + (isCajero ? 0 : pendingCount)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Notificaciones"
        aria-label="Notificaciones"
        className="relative p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-muted transition-colors"
      >
        <Bell size={16} />
        {total > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-danger-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-20 w-72 bg-surface border border-border rounded-xl overflow-hidden"
          style={{ boxShadow: 'var(--shadow-popover)' }}
        >
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-text-main">Notificaciones</p>
            {total > 0 && (
              <span className="text-xs text-text-muted tabular-nums">
                {total} pendiente{total === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {total === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-success-50 text-success-700 flex items-center justify-center mx-auto mb-2">
                <Bell size={18} />
              </div>
              <p className="text-sm font-medium text-text-main">Todo en orden</p>
              <p className="text-xs text-text-muted mt-0.5">Sin alertas pendientes</p>
            </div>
          ) : (
            <ul>
              {lowStockCount > 0 && (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      navigate('/productos')
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-muted flex items-center gap-3 border-b border-border last:border-0 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-warning-50 text-warning-700 flex items-center justify-center shrink-0">
                      <AlertTriangle size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-main">Stock bajo</p>
                      <p className="text-xs text-text-muted">
                        {lowStockCount} producto{lowStockCount === 1 ? '' : 's'} crítico
                        {lowStockCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-text-disabled shrink-0" />
                  </button>
                </li>
              )}
              {!isCajero && pendingCount > 0 && (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      navigate('/reportes')
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-muted flex items-center gap-3 border-b border-border last:border-0 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-danger-50 text-danger-700 flex items-center justify-center shrink-0">
                      <CreditCard size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-main">Cobros pendientes</p>
                      <p className="text-xs text-text-muted">
                        {pendingCount} cliente{pendingCount === 1 ? '' : 's'} con saldo deudor
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-text-disabled shrink-0" />
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
