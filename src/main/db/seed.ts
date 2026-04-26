import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

export function seedDatabase(db: Database.Database): void {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  if (userCount.count > 0) return

  const pinHash = bcrypt.hashSync('1234', 10)
  db.prepare(
    `INSERT INTO users (name, role, pin_hash) VALUES (?, ?, ?)`
  ).run('Administrador', 'admin', pinHash)

  const categories = ['Vacuno', 'Cerdo', 'Pollo', 'Embutidos', 'Otros']
  const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)')
  for (const cat of categories) {
    insertCat.run(cat)
  }

  const defaults: [string, string][] = [
    ['business_name', 'Multicarnes S.R.L.'],
    ['business_address', 'Encarnación, Paraguay'],
    ['business_phone', ''],
    ['thermal_printer_name', ''],
    ['thermal_printer_width', '80'],
    ['backup_path', ''],
    ['auto_backup', '1'],
    ['backup_schedule_enabled', '0'],
    ['backup_schedule_time', '22:00']
  ]
  const insertSetting = db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)')
  for (const [key, value] of defaults) {
    insertSetting.run(key, value)
  }
}
