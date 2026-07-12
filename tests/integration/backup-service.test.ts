import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BackupValidationError,
  createDatabaseSnapshot,
  replaceDatabaseFile,
  RESTORE_STAGING_PREFIX,
  stageRestoreCandidate,
  validateBackupFile
} from '../../src/main/db/backup-service'
import { CURRENT_SCHEMA_VERSION, runMigrationsForTesting } from '../../src/main/db'
import { createTables } from '../../src/main/db/schema'

function createAppDatabase(filePath: string, marker: string, version?: number): Database.Database {
  const db = new Database(filePath)
  createTables(db)
  db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('test_marker', ?)").run(
    marker
  )
  if (version != null) {
    db.prepare(
      "INSERT INTO schema_migrations (version, name) VALUES (?, 'backup-test-version')"
    ).run(version)
  }
  return db
}

describe('backup service', () => {
  let directory: string
  const openDatabases: Database.Database[] = []

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'multicarnes-backup-'))
  })

  afterEach(async () => {
    for (const db of openDatabases.splice(0)) {
      if (db.open) db.close()
    }
    await rm(directory, { recursive: true, force: true })
  })

  test('snapshot includes committed pages that are still in WAL', async () => {
    const livePath = join(directory, 'live.db')
    const snapshotPath = join(directory, 'snapshot.db')
    const live = new Database(livePath)
    openDatabases.push(live)
    live.pragma('journal_mode = WAL')
    live.pragma('wal_autocheckpoint = 0')
    live.exec("CREATE TABLE probe(value TEXT); INSERT INTO probe VALUES ('latest')")

    await createDatabaseSnapshot(live, snapshotPath)

    const snapshot = new Database(snapshotPath, { readonly: true })
    openDatabases.push(snapshot)
    expect(snapshot.prepare('SELECT value FROM probe').pluck().get()).toBe('latest')
  })

  test('concurrent snapshots are serialized and produce independent valid files', async () => {
    const live = createAppDatabase(join(directory, 'live.db'), 'original')
    openDatabases.push(live)
    const first = join(directory, 'backup-first.db')
    const second = join(directory, 'backup-second.db')

    await Promise.all([createDatabaseSnapshot(live, first), createDatabaseSnapshot(live, second)])

    validateBackupFile(first, CURRENT_SCHEMA_VERSION)
    validateBackupFile(second, CURRENT_SCHEMA_VERSION)
  })

  test('valid staged backup atomically replaces the closed live database', async () => {
    const livePath = join(directory, 'pos.db')
    const sourcePath = join(directory, 'source.db')
    const live = createAppDatabase(livePath, 'before')
    const source = createAppDatabase(sourcePath, 'restored')
    live.close()
    source.close()

    const staging = await stageRestoreCandidate(sourcePath, directory, CURRENT_SCHEMA_VERSION)
    await replaceDatabaseFile(staging, livePath)

    const restored = new Database(livePath, { readonly: true })
    openDatabases.push(restored)
    expect(
      restored.prepare("SELECT value FROM app_settings WHERE key = 'test_marker'").pluck().get()
    ).toBe('restored')
  })

  test('legacy app database without a migration ledger is accepted and upgraded', () => {
    const legacyPath = join(directory, 'legacy.db')
    const legacy = createAppDatabase(legacyPath, 'legacy')
    openDatabases.push(legacy)

    validateBackupFile(legacyPath, CURRENT_SCHEMA_VERSION)
    runMigrationsForTesting(legacy)

    expect(legacy.prepare('SELECT MAX(version) FROM schema_migrations').pluck().get()).toBe(
      CURRENT_SCHEMA_VERSION
    )
  })

  test('corrupt, foreign, and future databases are rejected without changing live data', async () => {
    const livePath = join(directory, 'pos.db')
    const live = createAppDatabase(livePath, 'untouched')
    openDatabases.push(live)

    const corruptPath = join(directory, 'corrupt.db')
    await writeFile(corruptPath, 'not sqlite')

    const foreignPath = join(directory, 'foreign.db')
    const foreign = new Database(foreignPath)
    foreign.exec('CREATE TABLE unrelated(id INTEGER)')
    foreign.close()

    const futurePath = join(directory, 'future.db')
    const future = createAppDatabase(futurePath, 'future', CURRENT_SCHEMA_VERSION + 1)
    future.close()

    for (const candidate of [corruptPath, foreignPath, futurePath]) {
      await expect(
        stageRestoreCandidate(candidate, directory, CURRENT_SCHEMA_VERSION)
      ).rejects.toBeInstanceOf(BackupValidationError)
    }

    expect(
      live.prepare("SELECT value FROM app_settings WHERE key = 'test_marker'").pluck().get()
    ).toBe('untouched')
    expect((await readdir(directory)).some((name) => name.startsWith(RESTORE_STAGING_PREFIX))).toBe(
      false
    )
  })

  test('failed replacement leaves the original main database in place', async () => {
    const livePath = join(directory, 'pos.db')
    const live = createAppDatabase(livePath, 'untouched')
    live.close()

    await expect(
      replaceDatabaseFile(join(directory, 'missing-staging.db'), livePath)
    ).rejects.toThrow()

    const reopened = new Database(livePath, { readonly: true })
    openDatabases.push(reopened)
    expect(
      reopened.prepare("SELECT value FROM app_settings WHERE key = 'test_marker'").pluck().get()
    ).toBe('untouched')
  })
})
