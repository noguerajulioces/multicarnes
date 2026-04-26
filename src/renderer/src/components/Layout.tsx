import { Outlet, Navigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuthStore } from '../store/auth.store'

export default function Layout() {
  const user = useAuthStore((s) => s.user)

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-bg-secondary p-6">
        <Outlet />
      </main>
    </div>
  )
}
