import { describe, test, expect, beforeEach } from 'vitest'
import type Database from 'better-sqlite3'
import {
  addCustomerPayment,
  updateCustomerPayment,
  deleteCustomerPayment,
  getCustomerPayments,
  getCustomerById
} from '../../src/main/db/queries/customers'
import { closeCashRegister } from '../../src/main/db/queries/cash'
import {
  createTestDb,
  seedUser,
  seedCustomer,
  seedOpenRegister,
  seedClosedRegister,
  countRows,
  type SeededUser,
  type SeededCustomer
} from './_fixtures/db'

interface CustomerRow {
  id: number
  name: string
  balance: number
}

interface PaymentRow {
  id: number
  customer_id: number
  user_id: number
  amount: number
  note: string | null
  affects_cash: number | boolean
  created_at: string
  user_name?: string | null
}

interface CashMovementRow {
  id: number
  register_id: number
  user_id: number
  type: string
  amount: number
  description: string
  created_at: string
}

interface ActionLogRow {
  id: number
  user_id: number | null
  action: string
  details: string | null
}

// Sum of cash income that still counts toward the arqueo — i.e. income rows
// that have NOT been voided (mirrors closeCashRegister's expected calc).
function activeIncomeTotal(db: Database.Database): number {
  return (
    db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS t FROM cash_movements cm
         WHERE cm.type = 'income'
           AND NOT EXISTS (SELECT 1 FROM cash_movements v WHERE v.void_of = cm.id)`
      )
      .get() as { t: number }
  ).t
}

describe('addCustomerPayment — happy paths (1.1)', () => {
  let db: Database.Database
  let cajero: SeededUser
  let customer: SeededCustomer

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero', name: 'Cajero-Cash' })
    customer = seedCustomer(db, { balance: -100_000, name: 'Cliente Deudor' })
  })

  test('T1.1.1 — cash payment with caller register inserts customer_payment + cash_movement + action_log atomically', () => {
    const register = seedOpenRegister(db, cajero.id, 0)

    const result = addCustomerPayment({
      customerId: customer.id,
      userId: cajero.id,
      amount: 30_000,
      note: 'Abono parcial',
      affectsCash: true,
      callerUserId: cajero.id
    }) as CustomerRow

    expect(result.balance).toBe(-70_000)

    const payment = db
      .prepare('SELECT * FROM customer_payments WHERE customer_id = ?')
      .get(customer.id) as PaymentRow
    expect(payment.amount).toBe(30_000)
    expect(payment.affects_cash).toBe(1)
    expect(payment.note).toBe('Abono parcial')
    expect(payment.user_id).toBe(cajero.id)

    // cash_movements has the synthetic opening row + the income row.
    const incomeRow = db
      .prepare(
        `SELECT * FROM cash_movements
         WHERE register_id = ? AND type = 'income'`
      )
      .get(register.id) as CashMovementRow
    expect(incomeRow).toBeDefined()
    expect(incomeRow.amount).toBe(30_000)
    expect(incomeRow.description).toBe('Pago de deuda — Cliente Deudor (Abono parcial)')
    expect(incomeRow.user_id).toBe(cajero.id)
    expect(incomeRow.register_id).toBe(register.id)

    const log = db
      .prepare("SELECT * FROM action_logs WHERE action = 'add_customer_payment'")
      .get() as ActionLogRow
    expect(log.user_id).toBe(cajero.id)
    expect(log.details).not.toBeNull()
    const detail = JSON.parse(log.details as string)
    expect(detail).toMatchObject({
      customer_id: customer.id,
      amount: 30_000,
      affects_cash: true,
      register_id: register.id,
      note: 'Abono parcial'
    })
  })

  test('T1.1.2 — cash payment with no note has description without parenthetical', () => {
    seedOpenRegister(db, cajero.id, 0)

    addCustomerPayment({
      customerId: customer.id,
      userId: cajero.id,
      amount: 10_000,
      affectsCash: true,
      callerUserId: cajero.id
    })

    const row = db
      .prepare("SELECT description FROM cash_movements WHERE type = 'income'")
      .get() as { description: string }
    expect(row.description).toBe('Pago de deuda — Cliente Deudor')
  })

  test('T1.1.3 — salary-deduction with open register does NOT create cash_movement and logs register_id null', () => {
    const register = seedOpenRegister(db, cajero.id, 0)

    addCustomerPayment({
      customerId: customer.id,
      userId: cajero.id,
      amount: 60_000,
      note: 'Acuerdo de descuento',
      affectsCash: false,
      callerUserId: cajero.id
    })

    const payment = db
      .prepare('SELECT * FROM customer_payments WHERE customer_id = ?')
      .get(customer.id) as PaymentRow
    expect(payment.affects_cash).toBe(0)

    const after = getCustomerById(customer.id) as CustomerRow
    expect(after.balance).toBe(-40_000)

    // Only the synthetic opening row exists in cash_movements; no income.
    const incomeCount = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM cash_movements
           WHERE register_id = ? AND type = 'income'`
        )
        .get(register.id) as { c: number }
    ).c
    expect(incomeCount).toBe(0)

    const log = db
      .prepare("SELECT * FROM action_logs WHERE action = 'add_customer_payment'")
      .get() as ActionLogRow
    const detail = JSON.parse(log.details as string)
    expect(detail.register_id).toBeNull()
    expect(detail.affects_cash).toBe(false)
  })

  test('T1.1.4 — salary-deduction with NO open register still succeeds', () => {
    // Intentionally no register seeded.
    expect(() =>
      addCustomerPayment({
        customerId: customer.id,
        userId: cajero.id,
        amount: 60_000,
        affectsCash: false,
        callerUserId: cajero.id
      })
    ).not.toThrow()

    const after = getCustomerById(customer.id) as CustomerRow
    expect(after.balance).toBe(-40_000)
    expect(countRows(db, 'cash_movements')).toBe(0)
  })
})

describe('addCustomerPayment — rejections (1.2)', () => {
  let db: Database.Database
  let cajero: SeededUser
  let otherUser: SeededUser
  let customer: SeededCustomer

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero', name: 'Caja-Activa' })
    otherUser = seedUser(db, { role: 'cajero', name: 'Caja-Otra' })
    customer = seedCustomer(db, { balance: -50_000 })
  })

  const expectNoSideEffects = (): void => {
    expect(countRows(db, 'customer_payments')).toBe(0)
    expect(
      (
        db.prepare("SELECT COUNT(*) as c FROM cash_movements WHERE type = 'income'").get() as {
          c: number
        }
      ).c
    ).toBe(0)
    expect(
      (
        db
          .prepare("SELECT COUNT(*) as c FROM action_logs WHERE action = 'add_customer_payment'")
          .get() as { c: number }
      ).c
    ).toBe(0)
    const after = getCustomerById(customer.id) as CustomerRow
    expect(after.balance).toBe(-50_000)
  }

  test('T1.2.1 — cash payment without any open register rejects with the spec message', () => {
    expect(() =>
      addCustomerPayment({
        customerId: customer.id,
        userId: cajero.id,
        amount: 10_000,
        affectsCash: true,
        callerUserId: cajero.id
      })
    ).toThrow('Necesitás una caja abierta para registrar pagos en efectivo.')
    expectNoSideEffects()
  })

  test('T1.2.2 — cash payment when only ANOTHER user owns an open register also rejects', () => {
    seedOpenRegister(db, otherUser.id, 0)

    expect(() =>
      addCustomerPayment({
        customerId: customer.id,
        userId: cajero.id,
        amount: 10_000,
        affectsCash: true,
        callerUserId: cajero.id
      })
    ).toThrow('Necesitás una caja abierta para registrar pagos en efectivo.')
    expectNoSideEffects()
  })

  test('T1.2.3 — cash payment when caller has a CLOSED register rejects', () => {
    seedClosedRegister(db, cajero.id, 0)

    expect(() =>
      addCustomerPayment({
        customerId: customer.id,
        userId: cajero.id,
        amount: 10_000,
        affectsCash: true,
        callerUserId: cajero.id
      })
    ).toThrow('Necesitás una caja abierta para registrar pagos en efectivo.')
    expectNoSideEffects()
  })

  test('T1.2.4 — amount = 0 rejects with the spec message', () => {
    seedOpenRegister(db, cajero.id, 0)
    expect(() =>
      addCustomerPayment({
        customerId: customer.id,
        userId: cajero.id,
        amount: 0,
        affectsCash: true,
        callerUserId: cajero.id
      })
    ).toThrow('El monto debe ser mayor a cero.')
    expectNoSideEffects()
  })

  test('T1.2.5 — amount < 0 rejects with the same message', () => {
    seedOpenRegister(db, cajero.id, 0)
    expect(() =>
      addCustomerPayment({
        customerId: customer.id,
        userId: cajero.id,
        amount: -1,
        affectsCash: true,
        callerUserId: cajero.id
      })
    ).toThrow('El monto debe ser mayor a cero.')
    expectNoSideEffects()
  })

  test('T1.2.6 — non-existent customer rejects with the spec message', () => {
    seedOpenRegister(db, cajero.id, 0)
    expect(() =>
      addCustomerPayment({
        customerId: 99_999,
        userId: cajero.id,
        amount: 10_000,
        affectsCash: true,
        callerUserId: cajero.id
      })
    ).toThrow('Cliente no encontrado.')
    expect(countRows(db, 'customer_payments')).toBe(0)
  })
})

describe('addCustomerPayment — atomicity (1.3)', () => {
  let db: Database.Database
  let cajero: SeededUser
  let customer: SeededCustomer

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero' })
    customer = seedCustomer(db, { balance: -50_000 })
  })

  test('T1.3.1 — if cash_movements INSERT fails, NEITHER customer_payments NOR balance updates persist', () => {
    seedOpenRegister(db, cajero.id, 0)

    // Force cash_movements to be unusable mid-transaction by renaming it. The
    // db.transaction wrapper should roll the entire batch back.
    db.exec('ALTER TABLE cash_movements RENAME TO cash_movements_tmp')

    expect(() =>
      addCustomerPayment({
        customerId: customer.id,
        userId: cajero.id,
        amount: 10_000,
        affectsCash: true,
        callerUserId: cajero.id
      })
    ).toThrow()

    db.exec('ALTER TABLE cash_movements_tmp RENAME TO cash_movements')

    expect(countRows(db, 'customer_payments')).toBe(0)
    expect(
      (
        db
          .prepare("SELECT COUNT(*) as c FROM action_logs WHERE action = 'add_customer_payment'")
          .get() as { c: number }
      ).c
    ).toBe(0)
    const after = getCustomerById(customer.id) as CustomerRow
    expect(after.balance).toBe(-50_000)
  })

  test('T1.3.2 — two sequential cash payments to the same customer both persist; balance sums', () => {
    const register = seedOpenRegister(db, cajero.id, 0)

    addCustomerPayment({
      customerId: customer.id,
      userId: cajero.id,
      amount: 20_000,
      affectsCash: true,
      callerUserId: cajero.id
    })
    addCustomerPayment({
      customerId: customer.id,
      userId: cajero.id,
      amount: 30_000,
      affectsCash: true,
      callerUserId: cajero.id
    })

    expect(countRows(db, 'customer_payments')).toBe(2)
    const incomes = db
      .prepare(
        `SELECT amount FROM cash_movements
         WHERE register_id = ? AND type = 'income'
         ORDER BY id`
      )
      .all(register.id) as { amount: number }[]
    expect(incomes.map((r) => r.amount)).toEqual([20_000, 30_000])

    const after = getCustomerById(customer.id) as CustomerRow
    expect(after.balance).toBe(0)
  })
})

describe('addCustomerPayment — balance semantics (1.4)', () => {
  let db: Database.Database
  let cajero: SeededUser

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero' })
  })

  test('T1.4.1 — overpayment leaves the customer with a positive balance (anticipo)', () => {
    const c = seedCustomer(db, { balance: -60_000 })
    seedOpenRegister(db, cajero.id, 0)

    addCustomerPayment({
      customerId: c.id,
      userId: cajero.id,
      amount: 100_000,
      affectsCash: true,
      callerUserId: cajero.id
    })

    const after = getCustomerById(c.id) as CustomerRow
    expect(after.balance).toBe(40_000)
  })

  test('T1.4.2 — cash payment on a zero-balance customer leaves +amount and creates the cash_movement', () => {
    const c = seedCustomer(db, { balance: 0 })
    const register = seedOpenRegister(db, cajero.id, 0)

    addCustomerPayment({
      customerId: c.id,
      userId: cajero.id,
      amount: 50_000,
      affectsCash: true,
      callerUserId: cajero.id
    })

    const after = getCustomerById(c.id) as CustomerRow
    expect(after.balance).toBe(50_000)

    const incomes = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM cash_movements
           WHERE register_id = ? AND type = 'income'`
        )
        .get(register.id) as { c: number }
    ).c
    expect(incomes).toBe(1)
  })

  test('T1.4.3 — exact payment zeroes the balance', () => {
    const c = seedCustomer(db, { balance: -30_000 })
    seedOpenRegister(db, cajero.id, 0)

    addCustomerPayment({
      customerId: c.id,
      userId: cajero.id,
      amount: 30_000,
      affectsCash: true,
      callerUserId: cajero.id
    })

    const after = getCustomerById(c.id) as CustomerRow
    expect(after.balance).toBe(0)
  })
})

describe('getCustomerPayments (1.5)', () => {
  let db: Database.Database
  let cajero: SeededUser
  let customer: SeededCustomer

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero', name: 'Caja-1' })
    customer = seedCustomer(db, { balance: -100_000 })
    seedOpenRegister(db, cajero.id, 0)
  })

  test('T1.5.1 — affects_cash is normalized to a boolean (not 0/1)', () => {
    addCustomerPayment({
      customerId: customer.id,
      userId: cajero.id,
      amount: 10_000,
      affectsCash: true,
      callerUserId: cajero.id
    })
    addCustomerPayment({
      customerId: customer.id,
      userId: cajero.id,
      amount: 20_000,
      affectsCash: false,
      callerUserId: cajero.id
    })

    const rows = getCustomerPayments(customer.id) as PaymentRow[]
    expect(rows.length).toBe(2)
    for (const r of rows) {
      expect(typeof r.affects_cash).toBe('boolean')
    }
    const sorted = [...rows].sort((a, b) => a.amount - b.amount)
    expect(sorted[0].affects_cash).toBe(true) // amount 10k was cash
    expect(sorted[1].affects_cash).toBe(false) // amount 20k was salary-deduction
  })

  test('T1.5.2 — pre-release rows (legacy default DEFAULT 1) appear as affects_cash: true', () => {
    // Simulate a pre-008 payment by inserting without the column being set
    // explicitly — the schema default of 1 should kick in.
    db.prepare('INSERT INTO customer_payments (customer_id, user_id, amount) VALUES (?, ?, ?)').run(
      customer.id,
      cajero.id,
      15_000
    )

    const rows = getCustomerPayments(customer.id) as PaymentRow[]
    expect(rows.length).toBe(1)
    expect(rows[0].affects_cash).toBe(true)
  })

  test('T1.5.3 — returned rows are ordered DESC by created_at', () => {
    // Insert with explicit, increasing timestamps to make ordering
    // deterministic — datetime('now','localtime') has 1-second resolution and
    // adjacent inserts can collide.
    db.prepare(
      "INSERT INTO customer_payments (customer_id, user_id, amount, created_at) VALUES (?, ?, ?, '2026-05-19 09:00:00')"
    ).run(customer.id, cajero.id, 11_000)
    db.prepare(
      "INSERT INTO customer_payments (customer_id, user_id, amount, created_at) VALUES (?, ?, ?, '2026-05-19 09:00:05')"
    ).run(customer.id, cajero.id, 22_000)
    db.prepare(
      "INSERT INTO customer_payments (customer_id, user_id, amount, created_at) VALUES (?, ?, ?, '2026-05-19 09:00:10')"
    ).run(customer.id, cajero.id, 33_000)

    const rows = getCustomerPayments(customer.id) as PaymentRow[]
    expect(rows.map((r) => r.amount)).toEqual([33_000, 22_000, 11_000])
  })

  test('T1.5.4 — user_name falls back to null when the user row was deleted (LEFT JOIN)', () => {
    // Insert a payment then delete the user (FKs are deferred during testing
    // since users.id has no enforced cascade rule on customer_payments).
    addCustomerPayment({
      customerId: customer.id,
      userId: cajero.id,
      amount: 5_000,
      affectsCash: false,
      callerUserId: cajero.id
    })
    db.pragma('foreign_keys = OFF')
    db.prepare('DELETE FROM users WHERE id = ?').run(cajero.id)
    db.pragma('foreign_keys = ON')

    const rows = getCustomerPayments(customer.id) as PaymentRow[]
    expect(rows[0].user_name).toBeNull()
  })
})

describe('updateCustomerPayment (1.6) — reverses + re-issues the linked cash income (#1)', () => {
  let db: Database.Database
  let cajero: SeededUser
  let customer: SeededCustomer

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero' })
    customer = seedCustomer(db, { balance: -100_000 })
    seedOpenRegister(db, cajero.id, 0)
  })

  test('T1.6.1 — changing the amount adjusts the balance AND voids+reissues the cash income', () => {
    addCustomerPayment({
      customerId: customer.id,
      userId: cajero.id,
      amount: 40_000,
      affectsCash: true,
      callerUserId: cajero.id
    })
    const payment = db.prepare('SELECT id FROM customer_payments').get() as { id: number }
    expect(activeIncomeTotal(db)).toBe(40_000)

    updateCustomerPayment(payment.id, 25_000, 'edited', cajero.id)

    const after = getCustomerById(customer.id) as CustomerRow
    // Original delta was +40k from -100k → -60k. New delta is +25k → -75k.
    expect(after.balance).toBe(-75_000)

    // The arqueo now sees 25_000: the old income is voided, a new one issued.
    expect(activeIncomeTotal(db)).toBe(25_000)
    const row = db
      .prepare('SELECT cash_movement_id FROM customer_payments WHERE id = ?')
      .get(payment.id) as { cash_movement_id: number }
    const linked = db
      .prepare('SELECT amount FROM cash_movements WHERE id = ?')
      .get(row.cash_movement_id) as { amount: number }
    expect(linked.amount).toBe(25_000)
  })

  test('T1.6.2 — changing only the note of a NON-cash payment does not move the balance', () => {
    addCustomerPayment({
      customerId: customer.id,
      userId: cajero.id,
      amount: 30_000,
      affectsCash: false,
      callerUserId: cajero.id
    })
    const payment = db.prepare('SELECT id FROM customer_payments').get() as { id: number }
    const before = getCustomerById(customer.id) as CustomerRow

    updateCustomerPayment(payment.id, 30_000, 'corregido', cajero.id)

    const after = getCustomerById(customer.id) as CustomerRow
    expect(after.balance).toBe(before.balance)
    const row = db.prepare('SELECT note FROM customer_payments WHERE id = ?').get(payment.id) as {
      note: string
    }
    expect(row.note).toBe('corregido')
  })

  test('T1.6.3 — nonexistent payment id throws', () => {
    expect(() => updateCustomerPayment(99_999, 1, null, cajero.id)).toThrow('Pago no encontrado')
  })

  test('T1.6.4 — editing a cash payment whose register is already closed is blocked (#2)', () => {
    addCustomerPayment({
      customerId: customer.id,
      userId: cajero.id,
      amount: 40_000,
      affectsCash: true,
      callerUserId: cajero.id
    })
    const payment = db.prepare('SELECT id FROM customer_payments').get() as { id: number }
    const reg = db.prepare("SELECT id FROM cash_registers WHERE status = 'open'").get() as {
      id: number
    }
    closeCashRegister(reg.id, 0, undefined, cajero.id)

    expect(() => updateCustomerPayment(payment.id, 25_000, null, cajero.id)).toThrow(
      /caja ya cerrada/
    )
    // nothing moved: balance still reflects the original payment
    expect((getCustomerById(customer.id) as CustomerRow).balance).toBe(-60_000)
  })
})

describe('deleteCustomerPayment (1.7) — voids the linked cash income (#1)', () => {
  let db: Database.Database
  let cajero: SeededUser
  let customer: SeededCustomer

  beforeEach(() => {
    db = createTestDb()
    cajero = seedUser(db, { role: 'cajero' })
    customer = seedCustomer(db, { balance: -50_000 })
    seedOpenRegister(db, cajero.id, 0)
  })

  test('T1.7.1 — deleting a cash payment reverts the balance AND voids the income', () => {
    addCustomerPayment({
      customerId: customer.id,
      userId: cajero.id,
      amount: 20_000,
      affectsCash: true,
      callerUserId: cajero.id
    })
    const payment = db.prepare('SELECT id FROM customer_payments').get() as { id: number }
    expect(activeIncomeTotal(db)).toBe(20_000)

    deleteCustomerPayment(payment.id, cajero.id)

    expect(countRows(db, 'customer_payments')).toBe(0)
    expect((getCustomerById(customer.id) as CustomerRow).balance).toBe(-50_000)

    // Append-only: original income row stays, but a void cancels it out so the
    // arqueo no longer counts it.
    expect(activeIncomeTotal(db)).toBe(0)
    const incomeCount = (
      db.prepare("SELECT COUNT(*) as c FROM cash_movements WHERE type = 'income'").get() as {
        c: number
      }
    ).c
    expect(incomeCount).toBe(1)
    const voidCount = (
      db.prepare("SELECT COUNT(*) as c FROM cash_movements WHERE type = 'void'").get() as {
        c: number
      }
    ).c
    expect(voidCount).toBe(1)
  })

  test('T1.7.2 — deleting a NON-cash payment reverts balance without touching cash', () => {
    addCustomerPayment({
      customerId: customer.id,
      userId: cajero.id,
      amount: 30_000,
      affectsCash: false,
      callerUserId: cajero.id
    })
    const payment = db.prepare('SELECT id FROM customer_payments').get() as { id: number }

    deleteCustomerPayment(payment.id, cajero.id)

    expect((getCustomerById(customer.id) as CustomerRow).balance).toBe(-50_000)
    expect(activeIncomeTotal(db)).toBe(0)
    const voidCount = (
      db.prepare("SELECT COUNT(*) as c FROM cash_movements WHERE type = 'void'").get() as {
        c: number
      }
    ).c
    expect(voidCount).toBe(0)
  })

  test('T1.7.3 — deleting a nonexistent payment id throws', () => {
    expect(() => deleteCustomerPayment(99_999, cajero.id)).toThrow('Pago no encontrado')
  })

  test('T1.7.4 — deleting a cash payment from a closed register is blocked (#2)', () => {
    addCustomerPayment({
      customerId: customer.id,
      userId: cajero.id,
      amount: 20_000,
      affectsCash: true,
      callerUserId: cajero.id
    })
    const payment = db.prepare('SELECT id FROM customer_payments').get() as { id: number }
    const reg = db.prepare("SELECT id FROM cash_registers WHERE status = 'open'").get() as {
      id: number
    }
    closeCashRegister(reg.id, 0, undefined, cajero.id)

    expect(() => deleteCustomerPayment(payment.id, cajero.id)).toThrow(/caja ya cerrada/)
    expect(countRows(db, 'customer_payments')).toBe(1)
  })

  test('T1.7.5 — deleting a legacy cash payment (unlinked) is blocked', () => {
    // Simulate a pre-v11 row: affects_cash = 1 but no linked cash_movement_id.
    const info = db
      .prepare(
        'INSERT INTO customer_payments (customer_id, user_id, amount, affects_cash, cash_movement_id) VALUES (?, ?, ?, 1, NULL)'
      )
      .run(customer.id, cajero.id, 10_000)
    const pid = info.lastInsertRowid as number

    expect(() => deleteCustomerPayment(pid, cajero.id)).toThrow(/antes de esta versión/)
  })
})

describe('Migration v10 — affects_cash column (1.8)', () => {
  test('T1.8.1 — pre-existing rows inserted before v10 are backfilled to affects_cash = 1 (via column default)', async () => {
    // Build a database that ONLY has migrations v1..v9 applied, insert legacy
    // rows, then run v10 manually. v10 is a pure ADD COLUMN with DEFAULT 1,
    // so legacy rows must surface as 1 (true).
    const Database = (await import('better-sqlite3')).default
    const db = new Database(':memory:')

    // Apply v1..v9 manually by simulating the migration runner up to v9.
    const { TEST_MIGRATIONS, runMigrationsForTesting } = await import('../../src/main/db')

    // Lazy approach: run the full ledger, then strip the affects_cash column
    // and the v10 ledger row, simulating the pre-v10 world.
    runMigrationsForTesting(db)

    // Recreate customer_payments without affects_cash to simulate pre-v10.
    db.exec(`
      CREATE TABLE customer_payments_legacy (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id  INTEGER NOT NULL,
        user_id      INTEGER NOT NULL,
        amount       INTEGER NOT NULL,
        note         TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
      DROP TABLE customer_payments;
      ALTER TABLE customer_payments_legacy RENAME TO customer_payments;
      DELETE FROM schema_migrations WHERE version = 10;
    `)

    // Seed a user + customer + a legacy payment (no affects_cash column yet).
    const uInfo = db
      .prepare("INSERT INTO users (name, role, pin_hash) VALUES ('u', 'cajero', 'x')")
      .run()
    const cInfo = db.prepare("INSERT INTO customers (name) VALUES ('c')").run()
    db.prepare(
      'INSERT INTO customer_payments (customer_id, user_id, amount, note) VALUES (?, ?, ?, ?)'
    ).run(cInfo.lastInsertRowid as number, uInfo.lastInsertRowid as number, 12_345, 'legacy')

    // Now re-apply v10 specifically.
    const v10 = TEST_MIGRATIONS.find((m) => m.version === 10)
    if (!v10) throw new Error('expected v10 migration in ledger')
    db.transaction(() => v10.up(db))()

    const cols = db.prepare('PRAGMA table_info(customer_payments)').all() as { name: string }[]
    expect(cols.find((c) => c.name === 'affects_cash')).toBeDefined()

    const legacy = db
      .prepare('SELECT affects_cash FROM customer_payments WHERE amount = 12345')
      .get() as { affects_cash: number }
    expect(legacy.affects_cash).toBe(1)
  })

  test('T1.8.2 — fresh ledger ends with the affects_cash column and DEFAULT 1', () => {
    const db = createTestDb()
    const cols = db.prepare('PRAGMA table_info(customer_payments)').all() as {
      name: string
      dflt_value: string | null
      notnull: number
    }[]
    const col = cols.find((c) => c.name === 'affects_cash')
    expect(col).toBeDefined()
    expect(col?.notnull).toBe(1)
    expect(col?.dflt_value).toBe('1')

    // And a row inserted without the column defaults to 1.
    const u = db
      .prepare("INSERT INTO users (name, role, pin_hash) VALUES ('u', 'cajero', 'x')")
      .run()
    const c = db.prepare("INSERT INTO customers (name) VALUES ('c')").run()
    db.prepare('INSERT INTO customer_payments (customer_id, user_id, amount) VALUES (?, ?, ?)').run(
      c.lastInsertRowid as number,
      u.lastInsertRowid as number,
      9_999
    )
    const row = db
      .prepare('SELECT affects_cash FROM customer_payments WHERE amount = 9999')
      .get() as { affects_cash: number }
    expect(row.affects_cash).toBe(1)
  })

  test('T1.8.3 — re-running the migration runner is idempotent (no duplicate column, no error)', async () => {
    const db = createTestDb()
    // createTestDb already invoked runMigrationsForTesting once.
    const { runMigrationsForTesting } = await import('../../src/main/db')

    expect(() => runMigrationsForTesting(db)).not.toThrow()

    const cols = db.prepare('PRAGMA table_info(customer_payments)').all() as { name: string }[]
    const affectsCols = cols.filter((c) => c.name === 'affects_cash')
    expect(affectsCols.length).toBe(1)
  })
})
