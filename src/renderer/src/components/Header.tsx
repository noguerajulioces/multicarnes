import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, DollarSign } from 'lucide-react'
import { useCashStore } from '../store/cash.store'
import { useAuthStore } from '../store/auth.store'

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/ventas': 'Ventas',
  '/caja': 'Caja',
  '/caja/apertura': 'Apertura',
  '/caja/cierre': 'Cierre',
  '/productos': 'Productos',
  '/productos/nuevo': 'Nuevo',
  '/compras': 'Compras',
  '/compras/nueva': 'Nueva',
  '/compras/proveedores': 'Proveedores',
  '/clientes': 'Clientes',
  '/reportes': 'Reportes',
  '/usuarios': 'Usuarios',
  '/configuracion': 'Configuración',
  '/backup': 'Backup'
}

interface Crumb {
  label: string
  to?: string
}

function getBreadcrumb(pathname: string): Crumb[] {
  const parts = pathname.split('/').filter(Boolean)
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
    <header className="bg-surface border-b border-border px-6 h-10 flex items-center justify-between shrink-0">
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
        <Clock />
        <UserAvatar />
      </div>
    </header>
  )
}

function UserAvatar() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
  return (
    <div
      className="w-7 h-7 rounded-full bg-brand-light text-brand text-xs font-semibold flex items-center justify-center shrink-0"
      title={user.name}
    >
      {initials || user.name.charAt(0).toUpperCase()}
    </div>
  )
}

function CashBadge() {
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

function Clock() {
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
