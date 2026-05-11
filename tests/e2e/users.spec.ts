import { test } from '@playwright/test'


/**
 * users-12-1 is covered by auth.spec.ts (admin creates cashier).
 * This file covers the other users-management scenarios.
 */
test.describe('Users management', () => {

  test.fixme('users-12-2 — mismatched PIN confirmation rejects creation (P2)', async () => {
    // Steps: open modal, PIN "222222", confirm "333333", submit.
    // Expected: error in form; user not created.
  })

  test.fixme('users-12-3 — cashier cannot reach /usuarios (P2)', async () => {
    // Steps: cashier logged in.
    // Expected: sidebar has no "Usuarios"; direct nav blocked.
  })

  test.fixme('users-12-4 — deactivating a user removes them from login screen (P3)', async () => {
    // Steps: admin edits cashier, unchecks Activo, saves; logout.
    // Expected: cashier avatar no longer rendered.
  })
})
