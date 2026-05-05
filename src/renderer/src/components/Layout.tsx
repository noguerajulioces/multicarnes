import { Outlet, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useAuthStore } from '../store/auth.store'
import { useCashStore } from '../store/cash.store'
import { isRegisterStale } from '../lib/utils'

export default function Layout() {
  const user = useAuthStore((s) => s.user)
  const register = useCashStore((s) => s.register)
  const location = useLocation()

  if (!user) return <Navigate to="/login" replace />

  if (isRegisterStale(register) && location.pathname !== '/caja/cierre') {
    return <Navigate to="/caja/cierre" replace />
  }

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto bg-bg-secondary p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
