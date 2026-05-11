import { test, expect } from '@playwright/test'
import { launchApp, ipc } from './helpers/electron'
import { loginAsSeedAdmin } from './helpers/seed'

interface AppSetting {
  key: string
  value: string
}

test.describe('Settings & profile', () => {
  // -----------------
  // settings-14-1 (P2) — admin changes setting and reads it back
  // -----------------
  test('settings-14-1 — admin can set + getAll a config value', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)

      await ipc(
        window,
        async ([key, value]) => {
          await window.api.settings.set(key as string, value as string)
        },
        ['business_name', 'Multicarnes E2E Test'] as const
      )

      const all = (await ipc(window, () => window.api.settings.getAll())) as AppSetting[]
      const row = all.find((s) => s.key === 'business_name')
      expect(row, 'business_name must be present after set').toBeDefined()
      expect(row!.value).toBe('Multicarnes E2E Test')
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // settings-14-2 (P3) — user changes own PIN via profile
  // -----------------
  test('settings-14-2 — admin can change their own PIN via users:update and login with the new one', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      await ipc(
        window,
        async ([id]) => {
          await window.api.users.update(id as number, { pin: '654321' })
        },
        [admin.id] as const
      )

      // Login with the old PIN must now fail.
      const oldLogin = (await ipc(
        window,
        async ([id]) => window.api.users.login(id as number, '123456'),
        [admin.id] as const
      )) as unknown
      expect(oldLogin).toBeNull()

      const newLogin = (await ipc(
        window,
        async ([id]) => window.api.users.login(id as number, '654321'),
        [admin.id] as const
      )) as { id: number } | null
      expect(newLogin).not.toBeNull()
      expect(newLogin!.id).toBe(admin.id)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // settings-14-3 (P3) — wrong current PIN rejects via login round-trip
  // -----------------
  test('settings-14-3 — users:login returns null on a wrong PIN (used as current-PIN check)', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const bad = (await ipc(
        window,
        async ([id]) => window.api.users.login(id as number, '999999'),
        [admin.id] as const
      )) as unknown
      expect(bad).toBeNull()
    } finally {
      await cleanup()
    }
  })
})
