import { Outlet, Navigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuthStore } from '../store/auth.store'
import isotipo from '../assets/isotipo.png'

export default function Layout() {
  const user = useAuthStore((s) => s.user)

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden relative">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-bg-secondary p-6">
        <Outlet />
      </main>
      <img
        src={isotipo}
        alt=""
        className="absolute bottom-0 right-0 w-80 opacity-20 pointer-events-none select-none"
      />
    </div>
  )
}
