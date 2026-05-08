import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  DollarSign,
  Users,
  FileText,
  Settings,
  LogOut,
  Truck,
  UserCheck,
  Building2,
  HardDrive,
  ChevronLeft,
  ChevronRight,
  type LucideIcon
} from 'lucide-react'
import logo from '../assets/logo.png'
import type { Role } from '@shared/types'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  roles: Role[]
}

interface NavSection {
  label: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: 'Principal',
    items: [
      {
        to: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        roles: ['admin', 'supervisor', 'cajero']
      },
      {
        to: '/pos',
        label: 'POS',
        icon: ShoppingCart,
        roles: ['admin', 'supervisor', 'cajero']
      },
      {
        to: '/ventas',
        label: 'Ventas',
        icon: Receipt,
        roles: ['admin', 'supervisor', 'cajero']
      },
      { to: '/caja', label: 'Caja', icon: DollarSign, roles: ['admin', 'supervisor', 'cajero'] }
    ]
  },
  {
    label: 'Gestión',
    items: [
      { to: '/productos', label: 'Productos', icon: Package, roles: ['admin', 'supervisor'] },
      { to: '/clientes', label: 'Clientes', icon: UserCheck, roles: ['admin', 'supervisor'] },
      { to: '/proveedores', label: 'Proveedores', icon: Building2, roles: ['admin', 'supervisor'] },
      { to: '/compras', label: 'Compras', icon: Truck, roles: ['admin', 'supervisor'] }
    ]
  },
  {
    label: 'Análisis',
    items: [{ to: '/reportes', label: 'Reportes', icon: FileText, roles: ['admin', 'supervisor'] }]
  },
  {
    label: 'Sistema',
    items: [
      { to: '/usuarios', label: 'Usuarios', icon: Users, roles: ['admin'] },
      { to: '/configuracion', label: 'Configuración', icon: Settings, roles: ['admin'] },
      { to: '/backup', label: 'Backup', icon: HardDrive, roles: ['admin'] }
    ]
  }
]

const STORAGE_KEY = 'sidebar-collapsed'

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const profileActive = location.pathname === '/perfil'
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => user && item.roles.includes(user.role))
    }))
    .filter((section) => section.items.length > 0)

  const initials =
    (user?.name ?? '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('') || (user?.name ?? '?').charAt(0).toUpperCase()

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-60'
      } bg-brand text-white flex flex-col h-full shrink-0 transition-[width] duration-200`}
    >
      {/* Brand header */}
      <div
        className={`flex items-center ${
          collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3.5'
        }`}
      >
        <img src={logo} alt="Multicarnes" className="h-9 w-9 object-contain shrink-0" />
        {!collapsed && (
          <div className="leading-tight min-w-0">
            <h1 className="text-base font-bold tracking-tight truncate">Multicarnes</h1>
            <p className="text-[11px] opacity-75 uppercase tracking-wider">S.R.L.</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 pb-2 overflow-y-auto">
        {filteredSections.map((section, sIdx) => (
          <div key={section.label} className={sIdx > 0 ? 'mt-2.5' : ''}>
            {!collapsed && (
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider opacity-50">
                {section.label}
              </div>
            )}
            {collapsed && sIdx > 0 && <div className="mx-2 my-1.5 h-px bg-white/15" />}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `relative flex items-center ${
                    collapsed ? 'justify-center px-2' : 'gap-3 px-3'
                  } py-1.5 text-sm rounded-lg transition-colors ${
                    isActive
                      ? 'bg-white/25 font-semibold'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && !collapsed && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-white" />
                    )}
                    <item.icon size={18} className="shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User block */}
      <div className={`border-t border-white/15 ${collapsed ? 'p-2' : 'px-3 py-2'}`}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/perfil')}
              title="Mi perfil"
              aria-label="Abrir mi perfil"
              aria-current={profileActive ? 'page' : undefined}
              className={`relative flex-1 min-w-0 flex items-center gap-2.5 rounded-lg p-1 -m-1 transition-colors text-left ${
                profileActive ? 'bg-white/25' : 'hover:bg-white/10'
              }`}
            >
              {profileActive && (
                <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-white" />
              )}
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                  profileActive ? 'bg-white/30' : 'bg-white/20'
                }`}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0 leading-tight">
                <p
                  className={`text-sm truncate ${profileActive ? 'font-semibold' : 'font-medium'}`}
                >
                  {user?.name}
                </p>
                <p className="text-[11px] opacity-75 capitalize">{user?.role}</p>
              </div>
            </button>
            <button
              onClick={() => {
                logout()
                window.location.hash = '#/login'
              }}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="p-2 rounded-lg hover:bg-white/15 text-white/85 hover:text-white shrink-0 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('/perfil')}
              title={`Mi perfil (${user?.name ?? ''})`}
              aria-label="Abrir mi perfil"
              aria-current={profileActive ? 'page' : undefined}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                profileActive ? 'bg-white/35 ring-2 ring-white/40' : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {initials}
            </button>
            <button
              onClick={() => {
                logout()
                window.location.hash = '#/login'
              }}
              title={`Cerrar sesión (${user?.name ?? ''})`}
              className="flex items-center justify-center hover:bg-white/15 p-1.5 rounded-lg text-white/85 hover:text-white transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        className="border-t border-white/15 py-2 text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  )
}
