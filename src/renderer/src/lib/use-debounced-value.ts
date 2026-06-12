import { useEffect, useState } from 'react'

// Devuelve una copia "retrasada" de `value` que solo se actualiza tras `delayMs`
// sin cambios. Pensado para buscadores: el <input> sigue controlado por el valor
// crudo (tecleo responsivo) y la copia debounced alimenta el efecto que dispara
// el query a la DB, evitando una llamada IPC por tecla.
//
// Replica el patrón inline ya probado en VentasPage (setTimeout + cleanup).
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
