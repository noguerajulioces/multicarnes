// Serializa llamadas async: mientras una task está en vuelo, las invocaciones
// concurrentes se ignoran (retornan undefined). El flag `running` muta de forma
// síncrona dentro de runExclusive, así que cierra la carrera de doble-submit del
// MISMO tick (doble-click / doble-tap / click+Enter) que un estado de React no
// puede cerrar: `disabled={loading}` y `if (loading) return` dependen del valor
// del closure del render, y en una ráfaga del mismo frame ambos handlers cerraron
// sobre el valor viejo. Un guard basado en este flag es inmune a ese timing.
//
// Lógica pura (sin React) a propósito, para poder testearla con el Vitest node-env.
// El hook fino useInFlightGuard (src/renderer/src/hooks/use-in-flight-guard.ts)
// le da identidad estable entre renders vía useRef.
export function createInFlightGuard() {
  let running = false
  return async function runExclusive<T>(task: () => Promise<T>): Promise<T | undefined> {
    if (running) return undefined
    running = true
    try {
      return await task()
    } finally {
      running = false
    }
  }
}
