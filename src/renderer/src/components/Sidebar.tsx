import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import {
  LayoutDashboard, ShoppingCart, Package, DollarSign,
  Users, FileText, Settings, LogOut, Truck, UserCheck, HardDrive
} from 'lucide-react'

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

export default function Sidebar() {
  const { user, logout } = useAuthStore()

  const filtered = navItems.filter((item) => user && item.roles.includes(user.role))

  return (
    <aside className="w-56 bg-brand text-white flex flex-col h-screen shrink-0">
      <div className="p-4 text-center border-b border-white/20">
        <h1 className="text-lg font-bold">Multicarnes</h1>
        <p className="text-xs opacity-80">S.R.L.</p>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {filtered.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                isActive ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/20">
        <div className="text-sm mb-2">
          <p className="font-medium">{user?.name}</p>
          <p className="text-xs opacity-70 capitalize">{user?.role}</p>
        </div>
        <button
          onClick={() => { logout(); window.location.hash = '#/login' }}
          className="flex items-center gap-2 text-sm hover:bg-white/10 px-2 py-1 rounded w-full"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
