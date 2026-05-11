import { test, expect } from '@playwright/test'
import { launchApp } from './helpers/electron'
import { loginAsSeedAdmin, createUserViaIpc, SEED_ADMIN } from './helpers/seed'
import { LoginPage } from './pom/LoginPage'
import { SidebarNav } from './pom/SidebarNav'

test.describe('Authentication & role gating', () => {
  // -----------------
  // auth-1-3 — admin login lands on dashboard with admin-only sidebar entries (P1)
  // -----------------
  test('auth-1-3 — seeded admin can log in and sees the admin-only sidebar entries', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      const nav = new SidebarNav(window)

      // Admin sees the full sidebar.
      await nav.assertHasLink(/Usuarios/i)
      await nav.assertHasLink(/Configuración|Configuracion/i)
      await nav.assertHasLink(/Backup/i)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // auth-1-4 — wrong PIN rejects login (P1)
  // -----------------
  test('auth-1-4 — wrong PIN keeps the user on the login screen with an error', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const login = new LoginPage(window)

      // Wrong PIN — expect an error and to remain on the login screen.
      await login.selectUser(SEED_ADMIN.name)
      await login.enterPin('000000')
      await login.submit()

      // The renderer surfaces "PIN incorrecto" in a danger banner.
      await expect(window.getByText(/PIN incorrecto/i)).toBeVisible({ timeout: 5_000 })

      // We're still on the PIN entry view (the Ingresar button is rendered).
      await expect(window.getByRole('button', { name: /Ingresar/i })).toBeVisible()
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // auth-1-5 — logout (P2)
  // -----------------
  test('auth-1-5 — logout returns to the user-selection screen', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      const login = new LoginPage(window)
      await login.logout()

      // The seeded admin is selectable again.
      await expect(window.getByRole('button', { name: /Administrador/i })).toBeVisible()
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // users-12-1 — admin creates a cashier; cashier appears on login screen (P1)
  // -----------------
  test('users-12-1 — admin creates a cashier and the cashier appears on the login screen', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      await createUserViaIpc(window, { name: 'Cajero 1', role: 'cajero', pin: '222222' })

      const login = new LoginPage(window)
      await login.logout()
      await expect(window.getByRole('button', { name: /Cajero 1/i })).toBeVisible()
    } finally {
      await cleanup()
    }
  })
})

test.describe('Recovery flow (FIXME — needs empty DB)', () => {
  // The auto-seeded admin makes the recovery flow unreachable in the standard
  // test setup. To restore coverage we'd need either:
  //   - a build-time hook to skip seedDatabase() in tests, or
  //   - a UI flow that deactivates the seeded admin and triggers recovery
  //     (the seeded admin is the only one; deactivating self requires another
  //      admin, so this is a chicken-and-egg situation).
  // For now the recovery scenario is covered by the smoke test
  // (scripts/auth-smoke.ts Section 9 / FR-012).
  test.fixme('auth-1-1 / 1-2 — recovery setup on empty DB (needs seed bypass)', async () => {})
})
