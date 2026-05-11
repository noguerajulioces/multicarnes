import { test, expect } from '@playwright/test'
import { launchApp } from './helpers/electron'

test.describe('App boot', () => {
  test('packaged app boots and shows the user-selection login screen on a fresh database', async () => {
    const { window, cleanup } = await launchApp()

    try {
      // On a fresh userData dir the app's seed creates the default
      // "Administrador" user, so the login screen lands on user selection.
      await expect(window.getByText(/Seleccione su usuario/i)).toBeVisible({
        timeout: 15_000
      })

      // The seeded admin's avatar button must be present.
      await expect(window.getByRole('button', { name: /Administrador/i })).toBeVisible()
    } finally {
      await cleanup()
    }
  })
})
