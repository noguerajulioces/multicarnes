import { test, expect } from '@playwright/test'
import { launchApp, ipc } from './helpers/electron'
import { loginAsSeedAdmin, createUserViaIpc, openCashRegisterViaIpc } from './helpers/seed'
import { LoginPage } from './pom/LoginPage'

interface CashRegister {
  id: number
  user_id: number
  opening_amount: number
  closed_at: string | null
  status: string
}

interface CashMovement {
  id: number
  type: string
  amount: number
  description: string
}

interface CashSummary {
  register: { opening_amount: number }
  cashSales: number
  incomes: number
  expenses: number
}

test.describe('Cash register', () => {
  // -----------------
  // cash-7-1 (P1) — open register with ₲0
  // -----------------
  test('cash-7-1 — register can be opened with opening_amount = 0', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      // The renderer guards ₲0 with a confirm dialog (UI-side); the IPC layer
      // accepts the value directly. We verify the data-layer behaviour: a
      // register with opening_amount = 0 is created and is the active one.
      const register = await openCashRegisterViaIpc(window, admin.id, 0)
      expect(register.id).toBeGreaterThan(0)

      const current = (await ipc(window, () => window.api.cash.getCurrent())) as CashRegister | null
      expect(current).not.toBeNull()
      expect(current!.opening_amount).toBe(0)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // cash-7-2 (P2) — cashier closes their own register
  // -----------------
  test('cash-7-2 — cashier-opened register can be closed by the same cashier', async () => {
    const { window, cleanup } = await launchApp()
    try {
      await loginAsSeedAdmin(window)
      const cashier = await createUserViaIpc(window, {
        name: 'Caja Self-Close',
        role: 'cajero',
        pin: '222222'
      })

      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja Self-Close', '222222')

      const register = await openCashRegisterViaIpc(window, cashier.id, 50_000)

      const result = await ipc(
        window,
        async ([id, amount, userId]) => {
          try {
            await window.api.cash.close(id, amount, '', userId)
            return { ok: true }
          } catch (err) {
            return { ok: false, message: err instanceof Error ? err.message : String(err) }
          }
        },
        [register.id, 50_000, cashier.id] as const
      )
      expect(result.ok, 'cashier should close their OWN register').toBe(true)

      // Reading back: no current active register, the closed one is recorded.
      const current = await ipc(window, () => window.api.cash.getCurrent())
      expect(current).toBeNull()
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // cash-7-3 (P2) — cashier cannot close another cashier's register
  // -----------------
  test('cash-7-3 — cashier-self exception: B cannot close A register', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const cashierA = await createUserViaIpc(window, {
        name: 'Caja Owner',
        role: 'cajero',
        pin: '222222'
      })
      const cashierB = await createUserViaIpc(window, {
        name: 'Caja Intruder',
        role: 'cajero',
        pin: '333333'
      })

      // Admin opens a register attributed to cashier A.
      const register = await openCashRegisterViaIpc(window, cashierA.id, 0)

      // Cashier B logs in and attempts to close it.
      const login = new LoginPage(window)
      await login.logout()
      await login.loginAs('Caja Intruder', '333333')

      const result = await ipc(
        window,
        async ([id, amount, userId]) => {
          try {
            await window.api.cash.close(id, amount, '', userId)
            return { ok: true }
          } catch (err) {
            return { ok: false, message: err instanceof Error ? err.message : String(err) }
          }
        },
        [register.id, 0, cashierB.id] as const
      )
      expect(result.ok, 'cashier B must NOT be able to close A register').toBe(false)

      void admin
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // cash-7-4 (P2) — movement updates the summary
  // -----------------
  test('cash-7-4 — income movement increases the expected cash total', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const register = await openCashRegisterViaIpc(window, admin.id, 100_000)

      // Add an income movement.
      await ipc(
        window,
        async ([registerId, userId]) => {
          await window.api.cash.addMovement(
            registerId,
            userId,
            'income',
            50_000,
            'Ajuste de prueba'
          )
        },
        [register.id, admin.id] as const
      )

      const movements = (await ipc(
        window,
        (id) => window.api.cash.getMovements(id),
        register.id
      )) as CashMovement[]
      const income = movements.find((m) => m.description === 'Ajuste de prueba')
      expect(income, 'movement must persist').toBeDefined()
      expect(income!.amount).toBe(50_000)

      const summary = (await ipc(
        window,
        (id) => window.api.cash.getSummary(id),
        register.id
      )) as CashSummary
      expect(summary.incomes).toBe(50_000)
      // Computed expected_cash matches: opening + cashSales + incomes - expenses
      // = 100k + 0 + 50k - 0 = 150k.
      const expected =
        summary.register.opening_amount + summary.cashSales + summary.incomes - summary.expenses
      expect(expected).toBe(150_000)
    } finally {
      await cleanup()
    }
  })

  test('cash-7-6 — current turn movements are paginated', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      const register = await openCashRegisterViaIpc(window, admin.id, 100_000)

      await ipc(
        window,
        async ([registerId, userId]) => {
          for (let i = 1; i <= 30; i++) {
            await window.api.cash.addMovement(
              registerId,
              userId,
              'income',
              i * 1_000,
              `Movimiento paginado ${i}`
            )
          }
          const current = await window.api.cash.getCurrent()
          localStorage.setItem('cash.register', JSON.stringify(current))
        },
        [register.id, admin.id] as const
      )

      await window.reload()
      await window.evaluate(() => {
        window.location.hash = '/caja'
      })

      await expect(window.getByRole('heading', { name: 'Movimientos del Turno' })).toBeVisible()
      await expect(window.getByText('31 movimientos registrados')).toBeVisible()
      await expect(window.getByText('Mostrando 1-25 de 31')).toBeVisible()
      await expect(window.getByText('Movimiento paginado 30', { exact: true })).toBeVisible()
      await expect(window.getByText('Movimiento paginado 1', { exact: true })).not.toBeVisible()

      await window.getByRole('button', { name: 'Siguiente' }).click()

      await expect(window.getByText('Mostrando 26-31 de 31')).toBeVisible()
      await expect(window.getByText('Movimiento paginado 1', { exact: true })).toBeVisible()
      await expect(window.getByText('Apertura de caja')).toBeVisible()
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // cash-7-7 (010-cash-float-close) — the float left in the drawer travels
  // through the IPC layer: validated server-side, persisted, fed back to the
  // opening screen via cash:getLastClosed. The arqueo stays untouched.
  // -----------------
  test('cash-7-7 — close persists kept_amount via IPC, rejects kept > counted, feeds getLastClosed', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      await ipc(window, () => window.api.settings.set('cash_float_default', '600000'))
      const register = await openCashRegisterViaIpc(window, admin.id, 600_000)
      await ipc(
        window,
        ([registerId, userId]) =>
          window.api.cash.addMovement(registerId, userId, 'income', 590_000, 'Cobros del día'),
        [register.id, admin.id] as const
      )

      // kept > counted is refused by the server, not only by the UI.
      const rejected = await ipc(
        window,
        async ([id, userId]) => {
          try {
            await window.api.cash.close(id, 400_000, '', userId, 600_000)
            return { ok: true, message: '' }
          } catch (err) {
            return { ok: false, message: err instanceof Error ? err.message : String(err) }
          }
        },
        [register.id, admin.id] as const
      )
      expect(rejected.ok).toBe(false)
      expect(rejected.message).toMatch(/no puede superar el monto contado/)

      // Valid split: counted 1.190.000, kept 600.000 → withdrawal 590.000 (derived).
      const closed = (await ipc(
        window,
        ([id, userId]) => window.api.cash.close(id, 1_190_000, 'Quedó 600.000', userId, 600_000),
        [register.id, admin.id] as const
      )) as {
        status: string
        closing_amount: number
        expected_amount: number
        difference: number
        kept_amount: number | null
        notes: string | null
      }
      expect(closed.status).toBe('closed')
      expect(closed.kept_amount).toBe(600_000)
      expect(closed.closing_amount).toBe(1_190_000)
      expect(closed.expected_amount).toBe(1_190_000) // 600k apertura + 590k income
      expect(closed.difference).toBe(0) // the float never enters the arqueo
      expect(closed.notes).toBe('Quedó 600.000')

      const last = (await ipc(window, () => window.api.cash.getLastClosed())) as {
        id: number
        closing_amount: number | null
        kept_amount: number | null
      }
      expect(last.id).toBe(register.id)
      expect(last.kept_amount).toBe(600_000)
      expect(last.closing_amount).toBe(1_190_000)
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // cash-7-8 (010-cash-float-close) — the cierre screen prefills the float,
  // shows the live withdrawal, blocks kept > counted, and the post-close view
  // shows both amounts.
  // -----------------
  test('cash-7-8 — cierre screen prefills the float and shows the live withdrawal', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      await ipc(window, () => window.api.settings.set('cash_float_default', '600000'))
      const register = await openCashRegisterViaIpc(window, admin.id, 600_000)
      await ipc(
        window,
        async ([registerId, userId]) => {
          await window.api.cash.addMovement(registerId, userId, 'income', 590_000, 'Cobros del día')
          const current = await window.api.cash.getCurrent()
          localStorage.setItem('cash.register', JSON.stringify(current))
          // The guided tour would cover the form on first visit; mark it as seen.
          localStorage.setItem('tour:seen:caja-cierre', '1')
        },
        [register.id, admin.id] as const
      )

      await window.reload()
      await window.evaluate(() => {
        window.location.hash = '/caja/cierre'
      })

      const counted = window.locator('[data-tour="caja-cierre-counted"] input')
      const kept = window.locator('[data-tour="caja-cierre-kept"] input')
      await expect(kept).toHaveValue('600.000')

      await counted.fill('1190000')
      await expect(window.getByText('A retirar / entregar')).toBeVisible()
      await expect(window.getByText('Gs. 590.000', { exact: true })).toBeVisible()

      // A float larger than the counted cash blocks the confirm button.
      await counted.fill('400000')
      await expect(window.getByText(/No puede quedar en caja más de lo contado/)).toBeVisible()
      await expect(window.getByRole('button', { name: 'Confirmar Cierre' })).toBeDisabled()

      // Valid split again → confirm → post-close tiles show fondo and retiro.
      await counted.fill('1190000')
      await window.getByRole('button', { name: 'Confirmar Cierre' }).click()
      await expect(window.getByRole('heading', { name: 'Caja cerrada' })).toBeVisible()
      await expect(window.getByText('Queda en caja (fondo)')).toBeVisible()
      await expect(window.getByText('Retiro / entrega')).toBeVisible()
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // cash-7-9 (010-cash-float-close) — the apertura screen proposes the float:
  // the default float while nothing was closed yet, then whatever the last
  // close left in the drawer. Always editable (the field is a plain input).
  // -----------------
  test('cash-7-9 — apertura prefills the default float, then the float left by the last close', async () => {
    const { window, cleanup } = await launchApp()
    try {
      const admin = await loginAsSeedAdmin(window)
      await ipc(window, () => {
        localStorage.setItem('tour:seen:caja-apertura', '1')
        return window.api.settings.set('cash_float_default', '600000')
      })
      // Leave and re-enter so the screen mounts after the setting exists.
      const reopenApertura = async (): Promise<void> => {
        await window.evaluate(() => {
          window.location.hash = '/configuracion'
        })
        await window.evaluate(() => {
          window.location.hash = '/caja/apertura'
        })
      }
      await reopenApertura()
      const amount = window.locator('[data-tour="caja-apertura-amount"] input')
      await expect(amount).toHaveValue('600.000')
      await expect(window.getByText(/Fondo de caja por defecto: Gs\. 600\.000/)).toBeVisible()

      // A close that leaves 620.000 in the drawer wins over the default.
      const register = await openCashRegisterViaIpc(window, admin.id, 600_000)
      await ipc(window, ([id, userId]) => window.api.cash.close(id, 700_000, '', userId, 620_000), [
        register.id,
        admin.id
      ] as const)
      await reopenApertura()
      await expect(amount).toHaveValue('620.000')
      await expect(window.getByText(/Quedó del cierre anterior/)).toBeVisible()
    } finally {
      await cleanup()
    }
  })

  // -----------------
  // cash-7-5 (P3) — stale close requires a note (FIXME — needs time travel)
  // -----------------
  test.fixme('cash-7-5 — stale-close (>24h) requires a note', async () => {
    // Needs a way to backdate `opened_at` on the register. Either:
    //   - run a direct SQL UPDATE via a test-mode IPC, or
    //   - extend the seed helper to accept a specific opened_at value.
    // Will land once one of those exists; meanwhile the UI guard is
    // covered by the manual quickstart.
  })
})
