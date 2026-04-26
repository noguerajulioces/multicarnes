import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'
import { useCashStore } from '../../store/cash.store'
import type { User } from '@shared/types'

export default function LoginPage() {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setUser = useAuthStore((s) => s.setUser)
  const setRegister = useCashStore((s) => s.setRegister)
  const navigate = useNavigate()

  useEffect(() => {
    window.api.users.getActive().then(setUsers)
  }, [])

  const handleLogin = async () => {
    if (!selectedUser || !pin) return
    setError('')
    setLoading(true)
    try {
      const result = await window.api.users.login(selectedUser.id, pin)
      if (!result) {
        setError('PIN incorrecto')
        setLoading(false)
        return
      }
      setUser(result)
      const register = await window.api.cash.getCurrent()
      setRegister(register)

      if (!register && result.role !== 'admin') {
        navigate('/caja/apertura')
      } else {
        navigate('/dashboard')
      }
    } catch {
      setError('Error al iniciar sesión')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-brand rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-bold text-text-main">Multicarnes S.R.L.</h1>
          <p className="text-text-muted text-sm">Sistema de Punto de Venta</p>
        </div>

        {!selectedUser ? (
          <div>
            <p className="text-sm text-text-muted mb-4 text-center">Seleccione su usuario</p>
            <div className="grid grid-cols-2 gap-3">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className="flex flex-col items-center p-4 rounded-lg border-2 border-gray-200 hover:border-brand hover:bg-brand-light transition-colors"
                >
                  <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center mb-2">
                    <span className="text-brand font-bold text-lg">{u.name[0]}</span>
                  </div>
                  <span className="text-sm font-medium">{u.name}</span>
                  <span className="text-xs text-text-muted capitalize">{u.role}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={() => { setSelectedUser(null); setPin(''); setError('') }}
              className="text-sm text-brand mb-4 hover:underline"
            >
              ← Cambiar usuario
            </button>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-brand font-bold text-xl">{selectedUser.name[0]}</span>
              </div>
              <p className="font-medium">{selectedUser.name}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full text-center text-2xl tracking-[0.5em] border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="••••"
                  autoFocus
                />
              </div>

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <button
                onClick={handleLogin}
                disabled={loading || pin.length < 4}
                className="w-full bg-brand text-white py-3 rounded-lg font-medium hover:bg-brand-hover disabled:opacity-50 transition-colors"
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
