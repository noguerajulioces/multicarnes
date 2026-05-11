import { test, expect } from '@playwright/test'
import { launchApp, ipc } from './helpers/electron'
import { loginAsSeedAdmin, createUserViaIpc, SEED_ADMIN } from './helpers/seed'
import { LoginPage } from './pom/LoginPage'

interface AuthAlert {
  id: number
  userId: number
  failureCount: number
  acknowledgedAt: string | null
}

test.describe('Auth audit & alerts (US4 of 001)', () => {
  // -----------------
  // audit-15-1 (P1) — five rapid blocked attempts raise an alert
  // -----------------
  test('audit-15-1 — 5+ blocked attempts in 10 min raise an alert visible to admin', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      const cashier = await createUserViaIpc(window, {
        name: 'Caja Spammer',
        role: 'cajero',
        pin: '222222'
      })

      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja Spammer', '222222')

      // Fire six blocked privileged calls — backup:restore is admin-only.
      await ipc(window, async () => {
        for (let i = 0; i < 6; i++) {
          try {
            await window.api.backup.restore()
          } catch {
            /* expected */
          }
        }
      })

      // Re-login as admin to read the alerts API.
      await login.logout()
      await login.loginAs(SEED_ADMIN.name, SEED_ADMIN.pin)

      const alerts = (await ipc(window, () => window.api.auth.listAlerts())) as AuthAlert[]
      const spam = alerts.find((a) => a.userId === cashier.id)
      expect(spam, `alert row for cashier #${cashier.id} not found`).toBeDefined()
      expect(spam!.failureCount).toBeGreaterThanOrEqual(5)
      expect(spam!.acknowledgedAt).toBeNull()
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // audit-15-2 (P2) — admin acknowledges the alert
  // -----------------
  test('audit-15-2 — acknowledged alert disappears from the open list', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      const cashier = await createUserViaIpc(window, {
        name: 'Caja Spammer',
        role: 'cajero',
        pin: '222222'
      })

      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja Spammer', '222222')

      await ipc(window, async () => {
        for (let i = 0; i < 6; i++) {
          try {
            await window.api.backup.restore()
          } catch {
            /* expected */
          }
        }
      })

      await login.logout()
      await login.loginAs(SEED_ADMIN.name, SEED_ADMIN.pin)

      const before = (await ipc(window, () => window.api.auth.listAlerts())) as AuthAlert[]
      const alert = before.find((a) => a.userId === cashier.id)
      expect(alert).toBeDefined()

      await ipc(window, (id) => window.api.auth.acknowledgeAlert(id), alert!.id)

      const after = (await ipc(window, () => window.api.auth.listAlerts())) as AuthAlert[]
      const still = after.find((a) => a.userId === cashier.id && a.acknowledgedAt == null)
      expect(still, 'no open alert should remain for the cashier after ack').toBeUndefined()
    } finally {
      await cleanup()
    }
  })
})
