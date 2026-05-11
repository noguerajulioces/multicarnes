import { test } from '@playwright/test'

const skipOnMac = process.platform === 'darwin'

test.describe('Auth audit & alerts (US4 of 001)', () => {
  test.skip(skipOnMac, 'Playwright+Electron 39 launch is broken on macOS local')

  test.fixme('audit-15-1 — five rapid blocked attempts raise an alert (P1)', async () => {
    // Steps: cashier calls users:create six times via ipc (each blocked);
    //        admin re-login, open dashboard.
    // Expected: AuthAlertsBanner shows "repeated authorization failures from
    //           {cashier name}".
  })

  test.fixme('audit-15-2 — admin acknowledges the alert and it disappears (P2)', async () => {
    // Continuation of 15-1. Click "Marcar visto" → row removed.
  })
})
