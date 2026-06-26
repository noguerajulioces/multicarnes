import { describe, test, expect, vi } from 'vitest'
import { createInFlightGuard } from '../../src/renderer/src/lib/in-flight-guard'

// ---------------------------------------------------------------------------
// Regresión del Escenario 1 (doble-submit): un doble-click / doble-tap dispara
// el handler dos veces ANTES de que React re-renderice el botón deshabilitado,
// llamando al IPC mutante (sales:create, customers:addPayment, …) dos veces.
// createInFlightGuard serializa con un flag síncrono, así que la segunda llamada
// en vuelo se ignora. Se testea la mecánica pura (sin DOM/React, que no está
// configurado): el guard es la única defensa, así que esto cubre el corazón del fix.
// ---------------------------------------------------------------------------

describe('createInFlightGuard', () => {
  test('ignora un segundo submit mientras el primero está en vuelo (carrera del mismo tick)', async () => {
    const guard = createInFlightGuard()
    let resolveTask: (v: string) => void = () => {}
    const task = vi.fn(() => new Promise<string>((resolve) => (resolveTask = resolve)))

    // Dos invocaciones SÍNCRONAS, antes de que la primera resuelva — replica el
    // doble-click del mismo frame.
    const first = guard(task)
    const second = guard(task)

    expect(task).toHaveBeenCalledTimes(1)

    resolveTask('ok')
    expect(await first).toBe('ok')
    expect(await second).toBeUndefined() // la segunda se descartó sin ejecutar la task
  })

  test('permite una nueva ejecución una vez que la anterior terminó', async () => {
    const guard = createInFlightGuard()
    const task = vi.fn(async () => 'ok')

    await guard(task)
    await guard(task)

    expect(task).toHaveBeenCalledTimes(2)
  })

  test('resetea el guard aunque la task lance (finally), permitiendo reintentar', async () => {
    const guard = createInFlightGuard()

    await expect(
      guard(async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')

    const task = vi.fn(async () => 'ok')
    await guard(task)
    expect(task).toHaveBeenCalledTimes(1)
  })
})
