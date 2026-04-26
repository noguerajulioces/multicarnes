import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import {
  LayoutDashboard, ShoppingCart, Package, DollarSign,
  Users, FileText, Settings, LogOut, Truck, UserCheck, HardDrive,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import logo from '../assets/logo.png'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'supervisor', 'cajero'] },
  { to: '/ventas', label: 'Ventas', icon: ShoppingCart, roles: ['admin', 'supervisor', 'cajero'] },
  { to: '/caja', label: 'Caja', icon: DollarSign, roles: ['admin', 'supervisor', 'cajero'] },
  { to: '/productos', label: 'Productos', icon: Package, roles: ['admin', 'supervisor'] },
  { to: '/compras', label: 'Compras', icon: Truck, roles: ['admin', 'supervisor'] },
  { to: '/clientes', label: 'Clientes', icon: UserCheck, roles: ['admin', 'supervisor'] },
  { to: '/reportes', label: 'Reportes', icon: FileText, roles: ['admin', 'supervisor'] },
  { to: '/usuarios', label: 'Usuarios', icon: Users, roles: ['admin'] },
  { to: '/configuracion', label: 'Configuración', icon: Settings, roles: ['admin'] },
  { to: '/backup', label: 'Backup', icon: HardDrive, roles: ['admin'] }
]

const STORAGE_KEY = 'sidebar-collapsed'

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  const filtered = navItems.filter((item) => user && item.roles.includes(user.role))

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-56'
      } bg-brand text-white flex flex-col h-full shrink-0 transition-[width] duration-200`}
    >
      <div
        className={`border-b border-white/20 flex items-center ${
          collapsed ? 'justify-center p-3' : 'gap-2 p-3'
        }`}
      >
        <img src={logo} alt="Multicarnes" className="h-9 w-9 object-contain shrink-0" />
        {!collapsed && (
          <div className="leading-tight">
            <h1 className="text-sm font-bold">Multicarnes</h1>
            <p className="text-xs opacity-80">S.R.L.</p>
          </div>
        )}
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {filtered.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center ${
                collapsed ? 'justify-center px-2' : 'gap-3 px-4'
              } py-3 text-sm transition-colors ${
                isActive ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
              }`
            }
          >
            <item.icon size={18} className="shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={`border-t border-white/20 ${collapsed ? 'p-2' : 'p-4'}`}>
        {!collapsed ? (
          <>
            <div className="text-sm mb-2">
              <p className="font-medium truncate">{user?.name}</p>
              <p className="text-xs opacity-70 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={() => { logout(); window.location.hash = '#/login' }}
              className="flex items-center gap-2 text-sm hover:bg-white/10 px-2 py-1 rounded w-full"
            >
              <LogOut size={16} />
              <span>Cerrar sesión</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => { logout(); window.location.hash = '#/login' }}
            title={`Cerrar sesión (${user?.name ?? ''})`}
            className="flex items-center justify-center hover:bg-white/10 p-2 rounded w-full"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>

      <button
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Expandir' : 'Colapsar'}
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        className="border-t border-white/20 py-2 hover:bg-white/10 flex items-center justify-center"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  )
}
