import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useCashStore } from '../../store/cash.store'
import { Button, Input, NumericKeypad } from '../../components/ui'
import { cn } from '../../lib/utils'
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

  const handleLogin = async (): Promise<void> => {
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

  const initialsOf = (name: string): string =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('') || name.charAt(0).toUpperCase()

  return (
    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-brand-light via-bg-secondary to-bg-primary p-4">
      <div
        key={selectedUser?.id ?? 'pick'}
        className="bg-surface rounded-2xl border border-border p-8 w-full max-w-md animate-[fadeInUp_220ms_ease-out]"
        style={{ boxShadow: 'var(--shadow-card-soft)' }}
      >
        <div className="text-center mb-7">
          <img src={logo} alt="Multicarnes" className="w-20 h-20 object-contain mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-text-main tracking-tight">Multicarnes S.R.L.</h1>
          <p className="text-text-muted text-sm mt-0.5">Sistema de Punto de Venta</p>
        </div>

        {!selectedUser ? (
          <div>
            <p className="text-sm text-text-muted mb-4 text-center">Seleccione su usuario</p>
            <div className={cn('grid gap-3', users.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUser(u)}
                  style={{ boxShadow: 'var(--shadow-card-soft)' }}
                  className="flex flex-col items-center p-4 rounded-xl border border-border bg-surface hover:border-brand hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-2 text-white"
                    style={{ background: 'var(--gradient-kpi-purple)' }}
                  >
                    <span className="font-bold text-base">{initialsOf(u.name)}</span>
                  </div>
                  <span className="text-sm font-medium text-text-main capitalize truncate max-w-full">
                    {u.name}
                  </span>
                  <span className="text-xs text-text-muted capitalize">{u.role}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => {
                setSelectedUser(null)
                setPin('')
                setError('')
              }}
              className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-brand transition-colors mb-5"
            >
              <ArrowLeft size={14} />
              Cambiar usuario
            </button>

            <div className="text-center mb-6">
              <div
                className="w-20 h-20 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white"
                style={{ background: 'var(--gradient-kpi-purple)' }}
              >
                <span className="font-bold text-2xl">{initialsOf(selectedUser.name)}</span>
              </div>
              <p className="font-semibold text-lg text-text-main capitalize">{selectedUser.name}</p>
              <p className="text-xs text-text-muted capitalize">{selectedUser.role}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-3 text-center">PIN</label>
                {keypadEnabled ? (
                  <>
                    <PinDots length={6} filled={pin.length} size="lg" />
                    {/* Captura keyboard físico aunque el keypad sea el método principal */}
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      className="sr-only"
                      autoFocus
                      aria-label="PIN"
                    />
                  </>
                ) : (
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    invalid={!!error}
                    className="text-center text-xl tracking-[0.5em] h-12 rounded-xl"
                    placeholder="••••••"
                    autoFocus
                  />
                )}
              </div>

              {error && (
                <div className="px-3 py-2 bg-danger-50 text-danger-700 rounded-lg text-sm text-center">
                  {error}
                </div>
              )}

              {keypadEnabled ? (
                <NumericKeypad value={pin} onChange={setPin} onSubmit={handleLogin} maxLength={6} />
              ) : (
                <Button
                  className="w-full rounded-xl"
                  size="lg"
                  onClick={handleLogin}
                  disabled={loading || pin.length !== 6}
                >
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PinDots({
  length,
  filled,
  size = 'md'
}: {
  length: number
  filled: number
  size?: 'md' | 'lg'
}): React.ReactElement {
  const dot = size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'
  const gap = size === 'lg' ? 'gap-3' : 'gap-2'
  return (
    <div className={`flex justify-center ${gap}`}>
      {Array.from({ length }).map((_, i) => (
        <span
          key={i}
          className={`${dot} rounded-full border-2 transition-colors ${
            i < filled ? 'bg-brand border-brand' : 'border-border'
          }`}
        />
      ))}
    </div>
  )
}
