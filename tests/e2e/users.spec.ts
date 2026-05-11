import { test, expect } from '@playwright/test'
import { launchApp, ipc } from './helpers/electron'
import { loginAsSeedAdmin, createUserViaIpc } from './helpers/seed'
import { LoginPage } from './pom/LoginPage'
import { SidebarNav } from './pom/SidebarNav'

interface UserRow {
  id: number
  name: string
  role: string
  active: number
}

test.describe('Users management', () => {
  // -----------------
  // users-12-2 (P2) — PIN length validation rejects creation
  // -----------------
  test('users-12-2 — users:create rejects a 5-digit PIN (PIN_LENGTH=6 invariant)', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      const result = await ipc(window, async () => {
        try {
          await window.api.users.create({ name: 'Bad', role: 'cajero', pin: '12345' })
          return { ok: true }
        } catch (err) {
          return { ok: false, message: err instanceof Error ? err.message : String(err) }
        }
      })
      expect(result.ok).toBe(false)
      expect(result.message ?? '').toMatch(/6 d.gitos/i)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // users-12-3 (P2) — cashier cannot open users management
  // -----------------
  test('users-12-3 — cashier sees no "Usuarios" sidebar link and users:getAll is blocked', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      await createUserViaIpc(window, {
        name: 'Caja Users',
        role: 'cajero',
        pin: '222222'
      })

      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja Users', '222222')

      const nav = new SidebarNav(window)
      await nav.assertNoLink(/^Usuarios$/i)

      const result = await ipc(window, async () => {
        try {
          await window.api.users.getAll()
          return { ok: true }
        } catch (err) {
          return { ok: false, message: err instanceof Error ? err.message : String(err) }
        }
      })
      expect(result.ok, 'cashier must NOT be able to list users').toBe(false)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // users-12-4 (P3) — deactivated user disappears from the login screen
  // -----------------
  test('users-12-4 — deactivating a user removes it from getActive results', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      const cashier = await createUserViaIpc(window, {
        name: 'Caja Deactivate',
        role: 'cajero',
        pin: '222222'
      })

      await ipc(
        window,
        (id) => window.api.users.update(id, { active: false }),
        cashier.id
      )

      const active = (await ipc(window, () => window.api.users.getActive())) as UserRow[]
      expect(active.find((u) => u.id === cashier.id)).toBeUndefined()
    } finally {
      await cleanup()
    }
  })
})
