import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readdir, rename, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

export const RESTORE_STAGING_PREFIX = '.restore-pending-'

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupValidationError'
  }
}

let snapshotQueue: Promise<void> = Promise.resolve()

async function writeSnapshot(db: Database.Database, destination: string): Promise<void> {
  await mkdir(dirname(destination), { recursive: true })
  const temporary = join(dirname(destination), `.${basename(destination)}.${randomUUID()}.tmp`)

  try {
    await db.backup(temporary)
    await rename(temporary, destination)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {})
    throw error
  }
}

/**
 * Creates a transactionally consistent SQLite snapshot, including committed
 * pages that still live in WAL. Calls are serialized because better-sqlite3's
 * online backup worker operates on the same live connection.
 */
export function createDatabaseSnapshot(
  db: Database.Database,
  destination: string
): Promise<string> {
  const task = snapshotQueue.then(() => writeSnapshot(db, destination))
  snapshotQueue = task.then(
    () => undefined,
    () => undefined
  )
  return task.then(() => destination)
}

function validationFailure(error: unknown): BackupValidationError {
  if (error instanceof BackupValidationError) return error
  return new BackupValidationError('El archivo seleccionado no es una base de datos SQLite válida.')
}

export function validateBackupFile(filePath: string, supportedSchemaVersion: number): void {
  let candidate: Database.Database | null = null

  try {
    candidate = new Database(filePath, { readonly: true, fileMustExist: true })

    const quickCheck = candidate.pragma('quick_check') as Record<string, unknown>[]
    if (quickCheck.length !== 1 || quickCheck[0]?.quick_check !== 'ok') {
      throw new BackupValidationError(
        'El backup está dañado y no puede restaurarse. La base actual no fue modificada.'
      )
    }

    const rows = candidate.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name: string
    }[]
    const tables = new Set(rows.map((row) => row.name))
    const requiredTables = ['users', 'products', 'sales', 'app_settings']
    if (requiredTables.some((table) => !tables.has(table))) {
      throw new BackupValidationError(
        'El archivo seleccionado no corresponde a una base de datos de Multicarnes.'
      )
    }

    if (tables.has('schema_migrations')) {
      const row = candidate
        .prepare('SELECT MAX(version) AS version FROM schema_migrations')
        .get() as { version: number | null }
      if (row.version != null && row.version > supportedSchemaVersion) {
        throw new BackupValidationError(
          'Este backup fue creado con una versión más nueva de Multicarnes. Actualizá la aplicación antes de restaurarlo.'
        )
      }
    }
  } catch (error) {
    throw validationFailure(error)
  } finally {
    candidate?.close()
  }
}

export async function stageRestoreCandidate(
  sourcePath: string,
  userDataDir: string,
  supportedSchemaVersion: number
): Promise<string> {
  await mkdir(userDataDir, { recursive: true })
  const stagingPath = join(userDataDir, `${RESTORE_STAGING_PREFIX}${randomUUID()}.db`)

  try {
    await copyFile(sourcePath, stagingPath)
    validateBackupFile(stagingPath, supportedSchemaVersion)
    return stagingPath
  } catch (error) {
    await rm(stagingPath, { force: true }).catch(() => {})
    throw error
  }
}

/**
 * Replaces the closed live database with a validated staging file. Staging is
 * created in userData so the rename stays on the same volume and is atomic on
 * supported platforms, including Windows.
 */
export async function replaceDatabaseFile(stagingPath: string, livePath: string): Promise<void> {
  await rm(`${livePath}-wal`, { force: true })
  await rm(`${livePath}-shm`, { force: true })
  await rename(stagingPath, livePath)
}

export async function cleanupRestoreStaging(userDataDir: string): Promise<void> {
  let entries
  try {
    entries = await readdir(userDataDir, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(RESTORE_STAGING_PREFIX))
      .map((entry) => rm(join(userDataDir, entry.name), { force: true }))
  )
}
