import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CashRegister } from '@shared/types'
import { useAuthStore } from '../store/auth.store'
import { useCashStore } from '../store/cash.store'

// 004-logout-cash-close: every UI path that ends the session MUST call
// requestLogout() from this hook instead of useAuthStore.logout() directly.
// Adding a new entry point (idle timeout, switch-user, etc.) means routing it
// through here — otherwise the open-register guard can be bypassed (FR-007).

export type LogoutGuardState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'block'; openRegister: CashRegister }
  | { kind: 'error'; message: string }

interface LogoutGuard {
  state: LogoutGuardState
  requestLogout: () => Promise<void>
  proceedToClose: () => void
  dismiss: () => void
  retry: () => Promise<void>
}

export function useLogoutGuard(): LogoutGuard {
  const navigate = useNavigate()
  const [state, setState] = useState<LogoutGuardState>({ kind: 'idle' })

  const runCheck = useCallback(async (): Promise<void> => {
    setState({ kind: 'checking' })
    try {
      const openRegister = await window.api.cash.getMyOpenRegister()
      if (openRegister) {
        setState({ kind: 'block', openRegister })
        return
      }
      // Allow path: tear down the session and route to login.
      useAuthStore.getState().logout()
      setState({ kind: 'idle' })
      window.location.hash = '#/login'
    } catch (err) {
      // FR-008: never allow logout on indeterminate state.
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'No se pudo verificar el estado de la caja.'
      })
    }
  }, [])

  const requestLogout = useCallback((): Promise<void> => runCheck(), [runCheck])

  const proceedToClose = useCallback((): void => {
    if (state.kind !== 'block') return
    useCashStore.getState().setRegister(state.openRegister)
    setState({ kind: 'idle' })
    navigate('/caja/cierre')
  }, [navigate, state])

  const dismiss = useCallback((): void => {
    setState({ kind: 'idle' })
  }, [])

  const retry = useCallback((): Promise<void> => runCheck(), [runCheck])

  return { state, requestLogout, proceedToClose, dismiss, retry }
}
