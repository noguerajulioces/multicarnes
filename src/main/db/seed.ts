import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

export function seedDatabase(db: Database.Database): void {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  if (userCount.count > 0) return

  const pinHash = bcrypt.hashSync('123456', 10)
  db.prepare(`INSERT INTO users (name, role, pin_hash) VALUES (?, ?, ?)`).run(
    'Administrador',
    'admin',
    pinHash
  )

  const categories = ['Vacuno', 'Cerdo', 'Pollo', 'Embutidos', 'Otros']
  const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)')
  for (const cat of categories) {
    insertCat.run(cat)
  }

  const defaults: [string, string][] = [
    ['business_name', 'Multicarnes S.R.L.'],
    ['business_address', 'Encarnación, Paraguay'],
    ['business_city', ''],
    ['business_ruc', ''],
    ['business_phone', ''],
    // Seeded only on a brand-new database (this function early-returns when
    // users already exist). Upgrades leave these keys absent, which is why the
    // renderer falls back with `??` rather than relying on a backfill.
    ['receipt_extra_message', ''],
    ['receipt_thanks_message', '¡Gracias por su compra!'],
    ['thermal_printer_name', ''],
    ['thermal_printer_width', '80'],
    ['thermal_printer_mode', 'escpos'],
    ['backup_path', ''],
    ['auto_backup', '1'],
    ['backup_schedule_enabled', '0'],
    ['backup_schedule_time', '22:00'],
    // 010-cash-float-close: the float the business keeps in the drawer between
    // shifts (decision 2026-09-07: 600.000 Gs). Upgrades get it from migration
    // v19; Admin can change it or set 0 to disable the prefill.
    ['cash_float_default', '600000']
  ]
  const insertSetting = db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)')
  for (const [key, value] of defaults) {
    insertSetting.run(key, value)
  }
}
