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
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES categories(id),
      name        TEXT NOT NULL,
      barcode     TEXT UNIQUE,
      price       INTEGER NOT NULL DEFAULT 0,
      price_type  TEXT NOT NULL DEFAULT 'unit' CHECK(price_type IN ('unit','kg')),
      stock       REAL NOT NULL DEFAULT 0,
      min_stock   REAL NOT NULL DEFAULT 0,
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      phone       TEXT,
      address     TEXT,
      is_employee INTEGER NOT NULL DEFAULT 0,
      balance     INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
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
      type        TEXT NOT NULL CHECK(type IN ('income','expense')),
      amount      INTEGER NOT NULL,
      description TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      register_id    INTEGER NOT NULL REFERENCES cash_registers(id),
      customer_id    INTEGER REFERENCES customers(id),
      user_id        INTEGER NOT NULL REFERENCES users(id),
      subtotal       INTEGER NOT NULL,
      discount       INTEGER NOT NULL DEFAULT 0,
      total          INTEGER NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','credit','transfer','mixed')),
      status         TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','cancelled')),
      notes          TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id    INTEGER NOT NULL REFERENCES sales(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity   REAL NOT NULL,
      unit_price INTEGER NOT NULL,
      subtotal   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_payments (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id),
      method  TEXT NOT NULL CHECK(method IN ('cash','credit','transfer')),
      amount  INTEGER NOT NULL
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
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      user_id     INTEGER NOT NULL REFERENCES users(id),
      amount      INTEGER NOT NULL,
      note        TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
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
  `)
}
