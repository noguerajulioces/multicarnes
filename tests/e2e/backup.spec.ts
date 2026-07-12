import { test, expect } from '@playwright/test'
import { launchApp, ipc } from './helpers/electron'
import { loginAsSeedAdmin, createUserViaIpc } from './helpers/seed'
import { LoginPage } from './pom/LoginPage'
import { SidebarNav } from './pom/SidebarNav'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

interface BackupFile {
  name: string
  path: string
  size: number
  created_at: string
}

test.describe('Backup', () => {
  // -----------------
  // backup-13-1 (P2) — admin creates a backup and it appears in the list
  // -----------------
  test('backup-13-1 — backup:create produces a file that backup:list returns', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      const created = (await ipc(window, () => window.api.backup.create())) as string
      expect(typeof created).toBe('string')
      expect(created.length).toBeGreaterThan(0)

      const list = (await ipc(window, () => window.api.backup.list())) as BackupFile[]
      expect(Array.isArray(list)).toBe(true)
      expect(list.length).toBeGreaterThanOrEqual(1)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // backup-13-2 (P2) — restore confirmation gates the native file dialog
  // -----------------
  test('backup-13-2 — restore confirmation gates the destructive action', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      await new SidebarNav(window).goToBackup()

      await window.getByRole('button', { name: 'Restaurar Backup' }).click()
      await expect(window.getByRole('heading', { name: 'Restaurar backup' })).toBeVisible()
      await window.getByRole('button', { name: 'Cancelar' }).click()

      await expect(window.getByRole('heading', { name: 'Restaurar backup' })).toBeHidden()
      await expect(window.getByRole('button', { name: 'Restaurar Backup' })).toBeEnabled()
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // backup-13-3 (P3) — cashier blocked from backup channels
  // -----------------
  test('backup-13-3 — cashier sees no "Backup" sidebar link and backup:create is blocked', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      await createUserViaIpc(window, { name: 'Caja Bk', role: 'cajero', pin: '222222' })

      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja Bk', '222222')

      const nav = new SidebarNav(window)
      await nav.assertNoLink(/^Backup$/i)

      const result = await ipc(window, async () => {
        try {
          await window.api.backup.create()
          return { ok: true }
        } catch (err) {
          return { ok: false, message: err instanceof Error ? err.message : String(err) }
        }
      })
      expect(result.ok, 'cashier must NOT be able to create backups').toBe(false)
    } finally {
      await cleanup()
    }
  })

  test('backup-13-4 — invalid restore file is rejected and the live database stays usable', async () => {
    const { window, userDataDir, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      const invalidPath = join(userDataDir, 'invalid.db')
      await writeFile(invalidPath, 'not a sqlite database')

      const result = await ipc(
        window,
        async (path) => {
          try {
            await window.api.backup.restore(path)
            return { ok: true, message: '' }
          } catch (err) {
            return { ok: false, message: err instanceof Error ? err.message : String(err) }
          }
        },
        invalidPath
      )

      expect(result.ok).toBe(false)
      expect(result.message).toMatch(/SQLite válida|backup está dañado/i)
      const users = await ipc(window, () => window.api.users.getAll())
      expect(Array.isArray(users)).toBe(true)
    } finally {
      await cleanup()
    }
  })
})
