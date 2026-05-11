import { test, expect } from '@playwright/test'
import { launchApp, ipc } from './helpers/electron'
import { setupAdminViaRecovery, createUserViaIpc } from './helpers/seed'
import { LoginPage } from './pom/LoginPage'
import { SidebarNav } from './pom/SidebarNav'

// Local Mac runs hit a known Playwright + Electron 39 launch flag bug. CI on
// Linux is the authoritative runner. See tests/e2e/README.md.
const skipOnMac = process.platform === 'darwin'

test.describe('Authentication & role gating', () => {
  test.skip(skipOnMac, 'Playwright+Electron 39 launch is broken on macOS local')

  // -----------------
  // auth-1-1 / auth-1-2 — recovery setup (P1)
  // -----------------
  test('auth-1-1 / 1-2 — empty DB surfaces recovery form, completing it creates admin', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const login = new LoginPage(window)
      await login.assertOnRecoveryForm()

      await login.completeRecoverySetup({
        name: 'Admin Test',
        pin: '111111',
        confirm: '111111'
      })

      // After recovery the user-selection screen shows the new admin.
      await expect(window.getByText(/Seleccione su usuario/i)).toBeVisible({ timeout: 10_000 })
      await expect(window.getByRole('button', { name: /Admin Test/i })).toBeVisible()
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // auth-1-3 — admin login lands on dashboard with admin-only sidebar entries (P1)
  // -----------------
  test('auth-1-3 — admin login shows admin-only sidebar entries', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await setupAdminViaRecovery(window)
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
      // Seed an admin to have someone to attempt login as.
      await setupAdminViaRecovery(window)
      const login = new LoginPage(window)
      await login.logout()

      // Wrong PIN — expect to remain on the login screen.
      await login.selectUser('Admin Test')
      await login.enterPin('000000')
      await login.submit()

      await expect(window.getByText(/Seleccione su usuario|PIN/i)).toBeVisible({
        timeout: 5_000
      })
      // The user is NOT navigated away from login (no dashboard route).
      const url = window.url()
      expect(url).toMatch(/login|index\.html/i)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // auth-1-5 — logout clears state (P2)
  // -----------------
  test('auth-1-5 — logout reaches the user-selection screen', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await setupAdminViaRecovery(window)
      // Pre-seed a held ticket so the renderer's held store has data to reset.
      await ipc(window, async () => {
        await window.api.heldTickets.add({
          id: `seed-${Date.now()}`,
          label: 'preexisting',
          payload: '[]',
          discount: 0
        })
      })

      const login = new LoginPage(window)
      await login.logout()

      // The login screen is back; this is what we assert. The in-memory
      // store reset happens in auth.store.ts:logout() — we don't expose
      // the in-memory state from outside the renderer reliably, so we
      // rely on the server-filtered list to validate persistence (covered
      // separately by held-tickets.spec.ts).
      await expect(window.getByRole('button', { name: /Admin Test/i })).toBeVisible()
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // users-12-1 — admin creates cashier; cashier appears on login screen (P1)
  // -----------------
  test('users-12-1 — admin can create cashier, who then appears on the login screen', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await setupAdminViaRecovery(window)
      await createUserViaIpc(window, { name: 'Cajero 1', role: 'cajero', pin: '222222' })

      const login = new LoginPage(window)
      await login.logout()
      await expect(window.getByRole('button', { name: /Cajero 1/i })).toBeVisible()
    } finally {
      await cleanup()
    }
  })
})
