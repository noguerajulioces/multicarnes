import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'
import { useCashStore } from '../../store/cash.store'
import { Button, Input, NumericKeypad } from '../../components/ui'
import type { User, AppSetting } from '@shared/types'
import logo from '../../assets/logo.png'

export default function LoginPage() {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [keypadEnabled, setKeypadEnabled] = useState(false)
  const setUser = useAuthStore((s) => s.setUser)
  const setRegister = useCashStore((s) => s.setRegister)
  const navigate = useNavigate()

  useEffect(() => {
    window.api.users.getActive().then(setUsers)
    window.api.settings.getAll().then((all: AppSetting[]) => {
      const flag = all.find((s) => s.key === 'login_keypad_enabled')?.value
      setKeypadEnabled(flag === '1')
    })
  }, [])

  const handleLogin = async () => {
    if (!selectedUser || !pin) return
    setError('')
    setLoading(true)
    try {
      const result = await window.api.users.login(selectedUser.id, pin)
      if (!result) {
        setError('PIN incorrecto')
        setPin('')
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
    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-brand-light via-bg-secondary to-bg-primary">
      <div
        key={selectedUser?.id ?? 'pick'}
        className="bg-surface rounded-xl shadow-modal border border-border p-8 w-full max-w-md mx-4 animate-[fadeInUp_220ms_ease-out]"
      >
        <div className="text-center mb-6">
          <img
            src={logo}
            alt="Multicarnes"
            className="w-28 h-28 object-contain mx-auto mb-3 drop-shadow-sm"
          />
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
                  type="button"
                  onClick={() => setSelectedUser(u)}
                  className="flex flex-col items-center p-4 rounded-lg border-2 border-border bg-surface hover:border-brand hover:shadow-card hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-2 bg-gradient-to-br from-brand to-brand-hover text-white shadow-sm">
                    <span className="font-bold text-xl">{u.name[0]}</span>
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
              type="button"
              onClick={() => { setSelectedUser(null); setPin(''); setError('') }}
              className="text-sm text-brand mb-4 hover:underline"
            >
              ← Cambiar usuario
            </button>
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full mx-auto mb-2 bg-gradient-to-br from-brand to-brand-hover text-white flex items-center justify-center shadow-card">
                <span className="font-bold text-3xl">{selectedUser.name[0]}</span>
              </div>
              <p className="font-semibold text-lg">{selectedUser.name}</p>
              <p className="text-xs text-text-muted capitalize">{selectedUser.role}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-2 text-center">PIN</label>
                <PinDots length={6} filled={pin.length} />
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  invalid={!!error}
                  className="mt-3 text-center text-xl tracking-[0.5em] h-12"
                  placeholder="••••"
                  autoFocus
                />
              </div>

              {error && <p className="text-danger-500 text-sm text-center">{error}</p>}

              {keypadEnabled && (
                <NumericKeypad
                  value={pin}
                  onChange={setPin}
                  onSubmit={handleLogin}
                  maxLength={6}
                />
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={handleLogin}
                disabled={loading || pin.length < 4}
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PinDots({ length, filled }: { length: number; filled: number }) {
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length }).map((_, i) => (
        <span
          key={i}
          className={`w-3 h-3 rounded-full border-2 transition-colors ${
            i < filled ? 'bg-brand border-brand' : 'border-border'
          }`}
        />
      ))}
    </div>
  )
}
