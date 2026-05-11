import { test } from '@playwright/test'

const skipOnMac = process.platform === 'darwin'

test.describe('Settings & profile', () => {
  test.skip(skipOnMac, 'Playwright+Electron 39 launch is broken on macOS local')

  test.fixme('settings-14-1 — admin changes business name and it persists (P2)', async () => {
    // Steps: /configuracion → set "Nombre del negocio" → relaunch.
    // Expected: setting persists across cold start.
    // NOTE: relaunch requires extending launchApp() to reuse a userDataDir.
  })

  test.fixme('settings-14-2 — user changes own PIN via profile (P3)', async () => {
    // Steps: /perfil → "Cambiar PIN" → old/new/confirm → submit.
    // Expected: logout + login with new PIN succeeds.
  })

  test.fixme('settings-14-3 — wrong current PIN rejects change (P3)', async () => {
    // Steps: as above with wrong current PIN.
    // Expected: error toast; PIN unchanged.
  })
})
