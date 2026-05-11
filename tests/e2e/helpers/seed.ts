import type { Page } from '@playwright/test'
import { LoginPage } from '../pom/LoginPage'

/**
 * Test seeding utilities. Two layers:
 *
 *   1. `setupAdminViaRecovery(window, ...)` — drives the first-admin flow
 *      through the real UI on a fresh DB. Mandatory once per test, because
 *      the app cannot operate without at least one user.
 *
 *   2. `seedDirect.*` — fast, IPC-driven helpers that run inside the renderer
 *      to create downstream entities (users, products, customers, ...) without
 *      navigating through every page. Use these to set up scenario state.
 *
 * After step 1, the seeded admin is logged IN (the recovery flow lands you
 * on the dashboard). To switch users, use the LoginPage helper to logout +
 * login as the target user.
 */

interface SeededUser {
  id: number
  name: string
  role: 'admin' | 'supervisor' | 'cajero'
}

/**
 * Walks the recovery setup form to create the first admin. The app then
 * shows the user-selection login screen; this helper continues by selecting
 * the new admin and entering the PIN so the test starts logged in.
 *
 * @returns the seeded admin record.
 */
export async function setupAdminViaRecovery(
  window: Page,
  options: { name?: string; pin?: string } = {}
): Promise<SeededUser> {
  const name = options.name ?? 'Admin Test'
  const pin = options.pin ?? '111111'

  const loginPage = new LoginPage(window)

  await loginPage.assertOnRecoveryForm()
  await loginPage.completeRecoverySetup({ name, pin, confirm: pin })

  // After recovery, the login screen shows the new user. Click in.
  await loginPage.selectUser(name)
  await loginPage.enterPin(pin)
  await loginPage.submit()

  // Wait for the dashboard / main app to mount.
  await window.waitForURL(/#?\/(dashboard|caja|ventas)?$/, { timeout: 15_000 }).catch(() => {})

  const list = await window.evaluate(() => window.api.users.getAll())
  const admin = (list as SeededUser[]).find((u) => u.name === name)
  if (!admin) {
    throw new Error(`setupAdminViaRecovery: created user "${name}" not found in users:getAll`)
  }
  return admin
}

/**
 * Creates a user via the IPC layer (bypassing the admin UI). Requires that
 * an admin is currently logged in — otherwise the auth guard rejects the
 * call.
 */
export async function createUserViaIpc(
  window: Page,
  user: { name: string; role: 'admin' | 'supervisor' | 'cajero'; pin: string }
): Promise<SeededUser> {
  return window.evaluate(async (u) => {
    const created = await window.api.users.create(u)
    return created as SeededUser
  }, user)
}

/**
 * Creates a category + product in one IPC roundtrip. Useful when a test only
 * cares that "some product exists with N stock at price P".
 */
export async function createProductViaIpc(
  window: Page,
  product: {
    name: string
    price: number
    stock: number
    categoryName?: string
    priceType?: 'unit' | 'kg'
  }
): Promise<{ id: number; name: string }> {
  return window.evaluate(async (p) => {
    const categories = (await window.api.products.categories()) as { id: number; name: string }[]
    const categoryName = p.categoryName ?? 'Test Cat'
    let categoryId = categories.find((c) => c.name === categoryName)?.id
    if (categoryId == null) {
      const created = (await window.api.products.createCategory(categoryName)) as { id: number }
      categoryId = created.id
    }
    const result = (await window.api.products.create({
      name: p.name,
      price: p.price,
      stock: p.stock,
      category_id: categoryId,
      price_type: p.priceType ?? 'unit',
      active: true
    })) as { id: number; name: string }
    return result
  }, product)
}

/**
 * Creates a customer via IPC.
 */
export async function createCustomerViaIpc(
  window: Page,
  customer: { name: string; isEmployee?: boolean }
): Promise<{ id: number; name: string; balance: number }> {
  return window.evaluate(async (c) => {
    const result = (await window.api.customers.create({
      name: c.name,
      is_employee: c.isEmployee ?? false
    })) as { id: number; name: string; balance: number }
    return result
  }, customer)
}

/**
 * Opens a cash register for the currently-logged-in user with the given
 * opening amount. Useful before any sales test.
 */
export async function openCashRegisterViaIpc(
  window: Page,
  userId: number,
  openingAmount = 0
): Promise<{ id: number }> {
  return window.evaluate(
    async ([uid, amount]) => {
      const result = (await window.api.cash.open(uid as number, amount as number)) as {
        id: number
      }
      return result
    },
    [userId, openingAmount]
  )
}
