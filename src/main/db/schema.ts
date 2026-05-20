import Database from 'better-sqlite3'

export function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      role       TEXT NOT NULL CHECK(role IN ('admin','supervisor','cajero')),
      pin_hash   TEXT NOT NULL,
      active     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS products (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id   INTEGER REFERENCES categories(id),
      name          TEXT NOT NULL,
      barcode       TEXT UNIQUE,
      price         INTEGER NOT NULL DEFAULT 0,
      price_type    TEXT NOT NULL DEFAULT 'unit',
      stock         REAL NOT NULL DEFAULT 0,
      min_stock     REAL NOT NULL DEFAULT 0,
      image         TEXT,
      active        INTEGER NOT NULL DEFAULT 1,
      promo_enabled INTEGER NOT NULL DEFAULT 0,
      promo_type    TEXT,
      promo_value   INTEGER,
      promo_from    TEXT,
      promo_to      TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      phone         TEXT,
      address       TEXT,
      document      TEXT,
      document_type TEXT,
      is_employee   INTEGER NOT NULL DEFAULT 0,
      balance       INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      phone      TEXT,
      email      TEXT,
      address    TEXT,
      active     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS cash_registers (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER NOT NULL REFERENCES users(id),
      opened_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      closed_at      TEXT,
      opening_amount INTEGER NOT NULL DEFAULT 0,
      closing_amount INTEGER,
      expected_amount INTEGER,
      difference     INTEGER,
      notes          TEXT,
      status         TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed'))
    );

    CREATE TABLE IF NOT EXISTS cash_movements (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      register_id INTEGER NOT NULL REFERENCES cash_registers(id),
      user_id     INTEGER NOT NULL REFERENCES users(id),
      type        TEXT NOT NULL CHECK(type IN ('income','expense','opening','closing','void')),
      amount      INTEGER NOT NULL,
      description TEXT NOT NULL,
      void_of     INTEGER NULL REFERENCES cash_movements(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_cash_movements_register_created
      ON cash_movements(register_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS sales (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      register_id       INTEGER NOT NULL REFERENCES cash_registers(id),
      customer_id       INTEGER REFERENCES customers(id),
      user_id           INTEGER NOT NULL REFERENCES users(id),
      subtotal          INTEGER NOT NULL,
      discount          INTEGER NOT NULL DEFAULT 0,
      total             INTEGER NOT NULL,
      payment_method    TEXT NOT NULL CHECK(payment_method IN ('cash','card','credit','transfer','mixed')),
      payment_processor TEXT CHECK(payment_processor IN ('bancard','dinelco','upay') OR payment_processor IS NULL),
      payment_reference TEXT,
      status            TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','cancelled')),
      notes             TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    -- idx_sales_processor lives in migration v9, not here: createTables() runs
    -- before migrations and an existing pre-v9 DB has no payment_processor
    -- column yet, so referencing it in a partial-index predicate would fail
    -- before the migration gets a chance to add the column.

    CREATE TABLE IF NOT EXISTS sale_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id    INTEGER NOT NULL REFERENCES sales(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity   REAL NOT NULL,
      unit_price INTEGER NOT NULL,
      subtotal   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_payments (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id   INTEGER NOT NULL REFERENCES sales(id),
      method    TEXT NOT NULL CHECK(method IN ('cash','card','credit','transfer')),
      amount    INTEGER NOT NULL,
      processor TEXT CHECK(processor IN ('bancard','dinelco','upay') OR processor IS NULL),
      reference TEXT
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER REFERENCES suppliers(id),
      user_id     INTEGER NOT NULL REFERENCES users(id),
      total       INTEGER NOT NULL DEFAULT 0,
      status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','received','cancelled')),
      notes       TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      received_at TEXT
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   INTEGER NOT NULL REFERENCES purchase_orders(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity   REAL NOT NULL,
      unit_cost  INTEGER NOT NULL,
      subtotal   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id       INTEGER NOT NULL REFERENCES products(id),
      user_id          INTEGER NOT NULL REFERENCES users(id),
      quantity_before  REAL NOT NULL,
      quantity_after   REAL NOT NULL,
      reason           TEXT NOT NULL,
      created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS customer_payments (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id      INTEGER NOT NULL REFERENCES customers(id),
      user_id          INTEGER NOT NULL REFERENCES users(id),
      amount           INTEGER NOT NULL,
      note             TEXT,
      affects_cash     INTEGER NOT NULL DEFAULT 1,
      cash_movement_id INTEGER NULL REFERENCES cash_movements(id),
      void_of          INTEGER NULL REFERENCES customer_payments(id),
      created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS action_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER REFERENCES users(id),
      action     TEXT NOT NULL,
      details    TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS held_tickets (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      payload    TEXT NOT NULL,
      discount   INTEGER NOT NULL DEFAULT 0,
      user_id    INTEGER NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS auth_audit (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      operation          TEXT    NOT NULL,
      claimed_user_id    INTEGER,
      resolved_user_id   INTEGER,
      resolved_role      TEXT,
      outcome            TEXT    NOT NULL CHECK(outcome IN
                           ('allowed',
                            'blocked-no-user',
                            'blocked-inactive',
                            'blocked-insufficient-role')),
      sender_id          INTEGER,
      created_at         TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_auth_audit_user_time_outcome
      ON auth_audit(claimed_user_id, created_at, outcome);

    CREATE TABLE IF NOT EXISTS auth_alert_acks (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          INTEGER NOT NULL REFERENCES users(id),
      window_start     TEXT    NOT NULL,
      acknowledged_at  TEXT,
      acknowledged_by  INTEGER REFERENCES users(id),
      UNIQUE(user_id, window_start)
    );
  `)
}
