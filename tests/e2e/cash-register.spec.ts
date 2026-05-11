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
