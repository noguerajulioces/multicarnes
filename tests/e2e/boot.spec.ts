import { test, expect } from '@playwright/test'
import { launchApp } from './helpers/electron'

// TODO(e2e-macos): Playwright 1.59 + Electron 39 currently rejects the
// injected --remote-debugging-port flag on macOS arm64 (the Electron binary
// reports "bad option"). Tracking upstream; expected to be fixed by either a
// Playwright bump or an Electron 39.x patch release.
// The same test should run fine under CI on ubuntu-latest, which is where the
// suite is meant to be authoritative. Local Mac developers can fall back to
// `npm run smoke:auth` for logic-level coverage of the same invariants.
const skipOnMac = process.platform === 'darwin'

test.describe('App boot', () => {
  test.skip(skipOnMac, 'Playwright+Electron 39 local launch is broken on macOS — see TODO above')

  test('packaged app boots, splash fades, and shows the recovery setup form on a fresh database', async () => {
    const { window, cleanup } = await launchApp()

    try {
      // A fresh userData directory means no users exist, so the login screen
      // surfaces the "create first admin" recovery flow per US5 of feature 001.
      await expect(window.getByText(/Configurar primer administrador/i)).toBeVisible({
        timeout: 15_000
      })

      // The form must expose name + pin + confirm so a real user can finish setup.
      await expect(window.getByLabel(/Nombre/i)).toBeVisible()
      await expect(window.getByText(/Crear administrador/i)).toBeVisible()
    } finally {
      await cleanup()
    }
  })
})
