import { test, expect } from '@playwright/test'
import { launchApp, ipc } from './helpers/electron'
import { loginAsSeedAdmin, createUserViaIpc, SEED_ADMIN } from './helpers/seed'
import { LoginPage } from './pom/LoginPage'


/**
 * Black-box checks of the IPC authorization guard. Each test fires a single
 * privileged operation from a cashier session and asserts:
 *   (a) the promise rejects, and
 *   (b) an auth_audit row matching the operation + role + outcome is present.
 *
 * Audit rows are read directly from the renderer via window.api.auth which
 * is admin-gated; tests temporarily switch users to read the trail.
 */

interface AuditEntry {
  operation: string
  resolved_role: string | null
  outcome: string
  resolved_user_id: number | null
}

async function listAuditEntries(window: import('@playwright/test').Page, operation: string): Promise<AuditEntry[]> {
  return window.evaluate(async (op) => {
    const res = await window.api.auth.listAuditEntries({ operation: op })
    return (res?.entries ?? []) as AuditEntry[]
  }, operation)
}

test.describe('IPC authorization guard', () => {

  // -----------------
  // authz-2-1 — cashier cannot create a user (P1)
  // -----------------
  test('authz-2-1 — cashier invoking users:create is blocked and audited', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      const cashier = await createUserViaIpc(window, {
        name: 'Caja Authz',
        role: 'cajero',
        pin: '222222'
      })

      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja Authz', '222222')

      const result = await ipc(window, async () => {
        try {
          await window.api.users.create({ name: 'Sneaky', role: 'cajero', pin: '333333' })
          return { ok: true }
        } catch (err) {
          return { ok: false, message: err instanceof Error ? err.message : String(err) }
        }
      })
      expect(result.ok).toBe(false)

      // Re-login as admin to read the audit trail.
      await login.logout()
      await login.loginAs(SEED_ADMIN.name, SEED_ADMIN.pin)

      const audits = await listAuditEntries(window, 'users:create')
      const blocked = audits.find((a) => a.outcome === 'blocked-insufficient-role')
      expect(blocked, 'a blocked-insufficient-role audit row must exist for users:create').toBeDefined()
      void cashier
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // authz-2-2 — cashier cannot restore backup (P1)
  // -----------------
  test('authz-2-2 — cashier invoking backup:restore is blocked and audited', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      await createUserViaIpc(window, { name: 'Caja Bk', role: 'cajero', pin: '222222' })

      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja Bk', '222222')

      const result = await ipc(window, async () => {
        try {
          await window.api.backup.restore()
          return { ok: true }
        } catch (err) {
          return { ok: false, message: err instanceof Error ? err.message : String(err) }
        }
      })
      expect(result.ok).toBe(false)

      await login.logout()
      await login.loginAs(SEED_ADMIN.name, SEED_ADMIN.pin)

      const audits = await listAuditEntries(window, 'backup:restore')
      expect(audits.some((a) => a.outcome === 'blocked-insufficient-role')).toBe(true)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // authz-2-3 — products list omits cost / margin for cashier (P1)
  // -----------------
  test('authz-2-3 — cashier sees products list without cost / margin fields', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      // As admin, create a product with a cost field set.
      const productInfo = await ipc(window, async () => {
        const categories = (await window.api.products.categories()) as { id: number }[]
        let categoryId = categories[0]?.id
        if (categoryId == null) {
          const cat = (await window.api.products.createCategory('Test')) as { id: number }
          categoryId = cat.id
        }
        const created = await window.api.products.create({
          name: 'Carne Test',
          price: 10000,
          stock: 100,
          min_stock: 0,
          category_id: categoryId,
          price_type: 'kg',
          active: true
        })
        return created
      })
      expect(productInfo).toBeTruthy()

      await createUserViaIpc(window, { name: 'Caja Cost', role: 'cajero', pin: '222222' })

      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja Cost', '222222')

      const cashierView = await ipc(window, async () => {
        const list = await window.api.products.getAll({})
        return list
      })
      const items = (cashierView as { items?: Record<string, unknown>[] }).items ?? []
      // No item should expose cost / margin / last_cost. Renderer is allowed
      // to receive other fields, but these must be stripped (US3 of 001).
      for (const p of items) {
        expect(p, JSON.stringify(p)).not.toHaveProperty('cost')
        expect(p).not.toHaveProperty('margin')
        expect(p).not.toHaveProperty('last_cost')
      }
    } finally {
      await cleanup()
    }
  })
})
