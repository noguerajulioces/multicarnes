import { useEffect } from 'react'

export function useHotkey(
  key: string | string[],
  handler: (e: KeyboardEvent) => void,
  deps: unknown[] = []
): void {
  useEffect(() => {
    const keys = Array.isArray(key) ? key : [key]
    const fn = (e: KeyboardEvent) => {
      if (keys.includes(e.key)) handler(e)
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
