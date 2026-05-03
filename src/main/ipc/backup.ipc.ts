import { ipcMain, dialog, app, Notification } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { basename, join } from 'path'
import { getDb } from '../db'

function getBackupDir(): string {
  const db = getDb()
  const setting = db.prepare("SELECT value FROM app_settings WHERE key = 'backup_path'").get() as
    | { value: string }
    | undefined
  const backupPath = setting?.value || join(app.getPath('userData'), 'backups')
  if (!existsSync(backupPath)) mkdirSync(backupPath, { recursive: true })
  return backupPath
}

export function createBackup(): string {
  const dbPath = join(app.getPath('userData'), 'pos.db')
  const backupDir = getBackupDir()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupFile = join(backupDir, `backup_${timestamp}.db`)
  copyFileSync(dbPath, backupFile)
  return backupFile
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null
let lastBackupDate: string | null = null

function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value || null
}

function startBackupScheduler(): void {
  if (schedulerInterval) clearInterval(schedulerInterval)

  // Check every 60 seconds if it's time to backup
  schedulerInterval = setInterval(() => {
    const enabled = getSetting('backup_schedule_enabled')
    if (enabled !== '1') return

    const scheduleTime = getSetting('backup_schedule_time')
    if (!scheduleTime) return

    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const today = now.toISOString().slice(0, 10)

    if (currentTime === scheduleTime && lastBackupDate !== today) {
      lastBackupDate = today
      try {
        const file = createBackup()
        console.log(`[Backup] Backup programado ejecutado a las ${currentTime}`)
        if (Notification.isSupported()) {
          new Notification({
            title: 'Backup programado',
            body: `Se guardó ${basename(file)}`,
            silent: false
          }).show()
        }
      } catch (err) {
        console.error('[Backup] Error en backup programado:', err)
        if (Notification.isSupported()) {
          new Notification({
            title: 'Error en backup programado',
            body: err instanceof Error ? err.message : 'Error desconocido',
            silent: false
          }).show()
        }
      }
    }
  }, 60_000)
}

export function registerBackupIpc(): void {
  // Start the scheduler
  startBackupScheduler()

  ipcMain.handle('backup:create', () => createBackup())

  ipcMain.handle('backup:list', () => {
    const dir = getBackupDir()
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const fullPath = join(dir, f)
        const stat = statSync(fullPath)
        return { name: f, path: fullPath, size: stat.size, date: stat.mtime.toISOString() }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  })

  ipcMain.handle('backup:restore', async (_event, filePath?: string) => {
    let restorePath = filePath
    if (!restorePath) {
      const result = await dialog.showOpenDialog({
        filters: [{ name: 'Database', extensions: ['db'] }],
        properties: ['openFile']
      })
      if (result.canceled || !result.filePaths[0]) return null
      restorePath = result.filePaths[0]
    }
    const dbPath = join(app.getPath('userData'), 'pos.db')
    createBackup()
    copyFileSync(restorePath, dbPath)
    return restorePath
  })

  ipcMain.handle('backup:selectFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle('settings:getAll', () => {
    return getDb().prepare('SELECT * FROM app_settings').all()
  })

  ipcMain.handle('settings:set', (_, key: string, value: string) => {
    getDb()
      .prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)')
      .run(key, value)
    return true
  })
}
