import { useToastStore } from '../store/toast.store'

export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().push('success', message, duration),
  error: (message: string, duration?: number) =>
    useToastStore.getState().push('error', message, duration),
  info: (message: string, duration?: number) =>
    useToastStore.getState().push('info', message, duration),
  warning: (message: string, duration?: number) =>
    useToastStore.getState().push('warning', message, duration),
  dismiss: (id: string) => useToastStore.getState().remove(id),
  clear: () => useToastStore.getState().clear()
}
