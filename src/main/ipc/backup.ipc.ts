import { dialog, app, Notification } from 'electron'
import iconPng from '../../../resources/icon.png?asset'
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { rm } from 'node:fs/promises'
import { basename, join } from 'path'
import { closeDatabase, CURRENT_SCHEMA_VERSION, getDb, initDatabase } from '../db'
import {
  BackupValidationError,
  createDatabaseSnapshot,
  replaceDatabaseFile,
  stageRestoreCandidate
} from '../db/backup-service'
import { registerAuthorized, listRegisteredChannels } from '../auth/guard'
import { getRule } from '../auth/matrix'

// Whitelist of app_settings keys that the public settings:getAll handler may
// return. Anything not on this list is filtered out before reaching the
// renderer; new sensitive keys default to "not exposed".
const PUBLIC_SETTING_KEYS = new Set([
  'business_name',
  'business_address',
  'business_phone',
  'thermal_printer_name',
  'thermal_printer_width',
  'thermal_printer_mode',
  'login_keypad_enabled',
  'backup_path',
  'auto_backup',
  'backup_schedule_enabled',
  'backup_schedule_time'
])

function getBackupDir(): string {
  const db = getDb()
  const setting = db.prepare("SELECT value FROM app_settings WHERE key = 'backup_path'").get() as
    | { value: string }
    | undefined
  const backupPath = setting?.value || join(app.getPath('userData'), 'backups')
  if (!existsSync(backupPath)) mkdirSync(backupPath, { recursive: true })
  return backupPath
}

export async function createBackup(): Promise<string> {
  const backupDir = getBackupDir()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFile = join(backupDir, `backup_${timestamp}.db`)
  return createDatabaseSnapshot(getDb(), backupFile)
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null
let lastBackupDate: string | null = null
let restoreInProgress = false

function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value || null
}

function startBackupScheduler(): void {
  if (schedulerInterval) clearInterval(schedulerInterval)

  // Check every 60 seconds if it's time to backup
  schedulerInterval = setInterval(async () => {
    if (restoreInProgress) return
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
        const file = await createBackup()
        console.log(`[Backup] Backup programado ejecutado a las ${currentTime}`)
        if (Notification.isSupported()) {
          new Notification({
            title: 'Backup programado',
            body: `Se guardó ${basename(file)}`,
            icon: iconPng,
            silent: false
          }).show()
        }
      } catch (err) {
        console.error('[Backup] Error en backup programado:', err)
        if (Notification.isSupported()) {
          new Notification({
            title: 'Error en backup programado',
            body: err instanceof Error ? err.message : 'Error desconocido',
            icon: iconPng,
            silent: false
          }).show()
        }
      }
    }
  }, 60_000)
}

export function registerBackupIpc(): string[] {
  // Start the scheduler
  startBackupScheduler()

  const before = listRegisteredChannels().length

  registerAuthorized('backup:create', getRule('backup:create'), () => {
    if (restoreInProgress) {
      throw new Error('Hay una restauración en curso. Esperá a que la aplicación se reinicie.')
    }
    return createBackup()
  })

  registerAuthorized('backup:list', getRule('backup:list'), () => {
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

  registerAuthorized(
    'backup:restore',
    getRule('backup:restore'),
    async (_event, _ctx, filePath?: string) => {
      if (restoreInProgress) {
        throw new Error('Ya hay una restauración en curso.')
      }

      let restorePath = filePath
      if (!restorePath) {
        const result = await dialog.showOpenDialog({
          filters: [{ name: 'Database', extensions: ['db'] }],
          properties: ['openFile']
        })
        if (result.canceled || !result.filePaths[0]) return null
        restorePath = result.filePaths[0]
      }

      restoreInProgress = true
      const userDataDir = app.getPath('userData')
      const dbPath = join(userDataDir, 'pos.db')
      let stagingPath: string | null = null
      let databaseClosed = false
      let databaseReplaced = false

      try {
        stagingPath = await stageRestoreCandidate(restorePath, userDataDir, CURRENT_SCHEMA_VERSION)

        // Do not touch the live database unless its recovery snapshot completed.
        await createBackup()

        closeDatabase()
        databaseClosed = true

        try {
          await replaceDatabaseFile(stagingPath, dbPath)
          stagingPath = null
          databaseReplaced = true
        } catch (error) {
          await initDatabase()
          databaseClosed = false
          throw error
        }

        // Let the IPC response reach the renderer so it can show the final
        // status before the process exits. The new process opens only the
        // restored database and runs any pending migrations normally.
        setTimeout(() => {
          app.relaunch()
          app.exit(0)
        }, 750)

        return restorePath
      } catch (error) {
        if (databaseClosed && !databaseReplaced) {
          await initDatabase().catch((reopenError) => {
            console.error('[Backup] No se pudo reabrir la base original:', reopenError)
          })
        }

        if (error instanceof BackupValidationError) throw error
        const code = (error as NodeJS.ErrnoException).code
        if (code === 'EACCES' || code === 'EPERM') {
          throw new Error(
            'Windows no permitió acceder al archivo o a la carpeta seleccionada. La base actual no fue modificada.'
          )
        }
        const detail = error instanceof Error ? ` ${error.message}` : ''
        throw new Error(
          `No se pudo restaurar el backup. La base actual no fue modificada.${detail}`
        )
      } finally {
        if (stagingPath) await rm(stagingPath, { force: true }).catch(() => {})
        if (!databaseReplaced) restoreInProgress = false
      }
    }
  )

  registerAuthorized('backup:selectFolder', getRule('backup:selectFolder'), async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  registerAuthorized('settings:getAll', getRule('settings:getAll'), () => {
    // Public channel: filter to display-safe keys only (T013).
    const all = getDb().prepare('SELECT key, value FROM app_settings').all() as {
      key: string
      value: string
    }[]
    return all.filter((row) => PUBLIC_SETTING_KEYS.has(row.key))
  })

  registerAuthorized(
    'settings:set',
    getRule('settings:set'),
    (_event, _ctx, key: string, value: string) => {
      getDb()
        .prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)')
        .run(key, value)
      return true
    }
  )

  return listRegisteredChannels().slice(before)
}
