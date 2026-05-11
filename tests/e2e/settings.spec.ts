import { test } from '@playwright/test'


test.describe('Settings & profile', () => {

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
