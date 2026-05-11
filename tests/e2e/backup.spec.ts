import { test } from '@playwright/test'

const skipOnMac = process.platform === 'darwin'

test.describe('Backup', () => {
  test.skip(skipOnMac, 'Playwright+Electron 39 launch is broken on macOS local')

  test.fixme('backup-13-1 — admin creates a backup and the file appears in the list (P2)', async () => {
    // Steps: /backup → "Crear Backup".
    // Expected: new entry in list with size + timestamp.
  })

  test.fixme('backup-13-2 — restore confirmation gates the destructive action (P2)', async () => {
    // Steps: pick backup → confirm dialog.
    // Expected: confirm proceeds; cancel keeps DB unchanged.
    // NOTE: file picker dialog isn't drivable by Playwright directly — needs a
    // test-mode IPC that bypasses the dialog.
  })

  test.fixme('backup-13-3 — cashier cannot access backup page (P3)', async () => {
    // Expected: sidebar has no "Backup"; direct nav blocked.
  })
})
