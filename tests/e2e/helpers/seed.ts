import type { Page } from '@playwright/test'
import { LoginPage } from '../pom/LoginPage'

/**
 * Test seeding utilities.
 *
 * The app's `initDatabase()` auto-seeds a default admin user
 * ("Administrador" / PIN "123456") plus 5 categories and the default
 * settings on every fresh database — this is production behaviour and
 * the e2e suite uses it as the starting state.
 *
 *   1. `loginAsSeedAdmin(window)` — logs in as the seeded Administrador.
 *      Mandatory at the top of any test that wants an admin session.
 *
 *   2. `seedDirect.*` — fast, IPC-driven helpers that run inside the
 *      renderer to create downstream entities (cashiers, products,
 *      customers, ...) without navigating through every page.
 */

export const SEED_ADMIN = { name: 'Administrador', pin: '123456' } as const

interface SeededUser {
  id: number
  name: string
  role: 'admin' | 'supervisor' | 'cajero'
}

/**
 * Logs in as the auto-seeded admin user. The seed runs as part of
 * initDatabase() so this is always available on a fresh userData dir.
 *
 * Returns the admin's user record after login.
 */
export async function loginAsSeedAdmin(window: Page): Promise<SeededUser> {
  const login = new LoginPage(window)
  await login.loginAs(SEED_ADMIN.name, SEED_ADMIN.pin)

  const list = (await window.evaluate(() => window.api.users.getAll())) as SeededUser[]
  const admin = list.find((u) => u.name === SEED_ADMIN.name)
  if (!admin) {
    throw new Error(`loginAsSeedAdmin: expected user "${SEED_ADMIN.name}" not found after login`)
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
 * Creates a product (and the category if missing) in one IPC round-trip.
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
    const categoryName = p.categoryName ?? 'Vacuno' // a seeded category
    let categoryId = categories.find((c) => c.name === categoryName)?.id
    if (categoryId == null) {
      const created = (await window.api.products.createCategory(categoryName)) as { id: number }
      categoryId = created.id
    }
    const result = (await window.api.products.create({
      name: p.name,
      price: p.price,
      stock: p.stock,
      min_stock: 0,
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

/**
 * Closes a cash register via IPC. Needed in tests that open a register and
 * then log the same user out — feature 004-logout-cash-close blocks the
 * logout flow with a modal while the signed-in user still owns an open
 * register, so the register must be closed first.
 */
export async function closeCashRegisterViaIpc(
  window: Page,
  registerId: number,
  closingAmount: number,
  userId: number
): Promise<void> {
  await window.evaluate(
    async ([id, amount, uid]) => {
      await window.api.cash.close(id as number, amount as number, '', uid as number)
    },
    [registerId, closingAmount, userId]
  )
}
