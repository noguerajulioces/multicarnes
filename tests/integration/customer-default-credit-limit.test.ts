import { describe, test, expect } from 'vitest'
import Database from 'better-sqlite3'
import { createTables } from '../../src/main/db/schema'
import { TEST_MIGRATIONS } from '../../src/main/db'

interface CreditRow {
  e: number
  a: number | null
}

function creditOf(db: Database.Database, id: number): CreditRow {
  return db
    .prepare(
      'SELECT credit_limit_enabled AS e, credit_limit_amount AS a FROM customers WHERE id = ?'
    )
    .get(id) as CreditRow
}

// ---------------------------------------------------------------------------
// Migration v17 (default_credit_limit_all_customers): every existing customer
// is backfilled to an enabled 400.000 Gs fiado limit. Blanket overwrite — it
// clobbers custom limits set before this release too. Applied in isolation
// here (schema + v17.up only) because the standard createTestDb() helper runs
// the FULL ledger, which would apply v17 before we can seed a "legacy" row.
// ---------------------------------------------------------------------------
describe('migration v17 — default_credit_limit_all_customers', () => {
  test('sets enabled=1 and amount=400000 on every customer, overwriting custom limits', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    // Base schema. The credit columns exist here with their schema.ts defaults
    // (enabled DEFAULT 0, amount NULL) — the pre-v17 world for legacy installs.
    createTables(db)

    // Legacy customer: limit disabled (the default state before this feature).
    const legacy = db.prepare('INSERT INTO customers (name) VALUES (?)').run('Legacy')
      .lastInsertRowid as number
    // Customer with a custom limit already configured — must be overwritten.
    const custom = db
      .prepare(
        'INSERT INTO customers (name, credit_limit_enabled, credit_limit_amount) VALUES (?, 1, ?)'
      )
      .run('Custom', 999_000).lastInsertRowid as number

    // Sanity: the legacy row starts disabled with no amount.
    const before = creditOf(db, legacy)
    expect(before.e).toBe(0)
    expect(before.a).toBeNull()

    // Apply ONLY migration v17 against the pre-seeded rows.
    const v17 = TEST_MIGRATIONS.find((m) => m.version === 17)
    if (!v17) throw new Error('migration v17 not found in TEST_MIGRATIONS')
    v17.up(db)

    for (const id of [legacy, custom]) {
      const row = creditOf(db, id)
      expect(row.e).toBe(1)
      expect(row.a).toBe(400000)
    }

    db.close()
  })
})
