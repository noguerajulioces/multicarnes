# Migración v7: ampliación de cash_movements + linkage de anulación + backfill sintético

**Feature**: 003-cash-movements-history
**Fecha**: 2026-05-11
**Versión**: 7
**Idempotente**: sí (re-ejecutable, no-op en segunda invocación)
**Destructiva**: no (ninguna columna se dropea, ningún dato se pierde — las filas originales de `cash_movements` se preservan bit a bit)
**Salvaguarda de backup**: sí — corre a través de `preMigrateBackup(dbPath, 7)` como cada migración previa, según [src/main/db/index.ts:157](../../../../src/main/db/index.ts#L157)

## Qué hace

1. **Amplía** el CHECK de `cash_movements.type` de `IN ('income','expense')` a `IN ('income','expense','opening','closing','void')`.
2. **Agrega** la columna `void_of INTEGER NULL REFERENCES cash_movements(id)`.
3. **Crea** el índice `idx_cash_movements_register_created` sobre `(register_id, created_at DESC)`.
4. **Hace backfill** de filas sintéticas `'opening'` por cada fila existente en `cash_registers`.
5. **Hace backfill** de filas sintéticas `'closing'` por cada fila cerrada de `cash_registers`.

Los cinco pasos corren dentro de una sola transacción SQLite. Una falla parcial deja la base en v6.

## Idempotencia

El cuerpo de la migración abre con:

```ts
const cols = db.prepare('PRAGMA table_info(cash_movements)').all() as { name: string }[]
const hasVoidOf = !!cols.find((c) => c.name === 'void_of')

const tableSql = (db
  .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='cash_movements'")
  .get() as { sql: string }).sql
const hasBroadenedCheck = tableSql.includes("'opening'") && tableSql.includes("'void'")

if (hasVoidOf && hasBroadenedCheck) {
  // Ya aplicada — saltear cambios de schema. Igual verificar idempotencia del backfill abajo.
}
```

Los inserts de filas sintéticas usan guards `NOT EXISTS` (ver "Paso 4 / 5" abajo), así que una re-ejecución sobre una DB parcialmente backfilleada saltea las filas que ya existen.

## SQL — cuerpo completo

```sql
BEGIN TRANSACTION;

-- Paso 1+2: recrear-y-swappear para ampliar CHECK y agregar void_of.
-- SQLite no puede ALTERar un CHECK ni dropear uno, así que copiamos a través de una tabla nueva.
CREATE TABLE cash_movements_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  register_id INTEGER NOT NULL REFERENCES cash_registers(id),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL CHECK(type IN ('income','expense','opening','closing','void')),
  amount      INTEGER NOT NULL,
  description TEXT NOT NULL,
  void_of     INTEGER NULL REFERENCES cash_movements(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

INSERT INTO cash_movements_new
  (id, register_id, user_id, type, amount, description, void_of, created_at)
SELECT
  id, register_id, user_id, type, amount, description, NULL, created_at
FROM cash_movements;

DROP TABLE cash_movements;
ALTER TABLE cash_movements_new RENAME TO cash_movements;

-- Paso 3: índice para la query paginada del timeline.
CREATE INDEX IF NOT EXISTS idx_cash_movements_register_created
  ON cash_movements(register_id, created_at DESC);

-- Paso 4: filas sintéticas de apertura para cada caja existente.
-- Saltear cajas que ya tienen una fila de apertura (defensivo, por si la
-- migración se re-corre tras limpieza manual o un intento anterior parcial).
INSERT INTO cash_movements (register_id, user_id, type, amount, description, created_at)
SELECT
  cr.id,
  cr.user_id,
  'opening',
  cr.opening_amount,
  'Apertura de caja',
  cr.opened_at
FROM cash_registers cr
WHERE NOT EXISTS (
  SELECT 1 FROM cash_movements cm
  WHERE cm.register_id = cr.id AND cm.type = 'opening'
);

-- Paso 5: filas sintéticas de cierre para cada caja CERRADA.
INSERT INTO cash_movements (register_id, user_id, type, amount, description, created_at)
SELECT
  cr.id,
  cr.user_id,
  'closing',
  cr.closing_amount,
  CASE
    WHEN cr.difference = 0 OR cr.difference IS NULL THEN 'Cierre de caja'
    WHEN cr.difference > 0 THEN 'Cierre de caja (sobrante ' || cr.difference || ')'
    ELSE 'Cierre de caja (faltante ' || ABS(cr.difference) || ')'
  END,
  cr.closed_at
FROM cash_registers cr
WHERE cr.status = 'closed'
  AND cr.closing_amount IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM cash_movements cm
    WHERE cm.register_id = cr.id AND cm.type = 'closing'
  );

COMMIT;
```

## Entrada de Migrations (a appendear en `src/main/db/index.ts`)

```ts
{
  version: 7,
  name: 'cash_movements_broaden_and_void',
  up: (db) => {
    const cols = db.prepare('PRAGMA table_info(cash_movements)').all() as { name: string }[]
    const hasVoidOf = !!cols.find((c) => c.name === 'void_of')

    const tableSql = (
      db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='cash_movements'")
        .get() as { sql: string }
    ).sql
    const hasBroadenedCheck = tableSql.includes("'opening'") && tableSql.includes("'void'")

    if (!(hasVoidOf && hasBroadenedCheck)) {
      // Parte de schema. Recrear-y-swappear.
      db.exec(`
        CREATE TABLE cash_movements_new (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          register_id INTEGER NOT NULL REFERENCES cash_registers(id),
          user_id     INTEGER NOT NULL REFERENCES users(id),
          type        TEXT NOT NULL CHECK(type IN ('income','expense','opening','closing','void')),
          amount      INTEGER NOT NULL,
          description TEXT NOT NULL,
          void_of     INTEGER NULL REFERENCES cash_movements(id),
          created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        );
        INSERT INTO cash_movements_new
          (id, register_id, user_id, type, amount, description, void_of, created_at)
        SELECT id, register_id, user_id, type, amount, description, NULL, created_at
        FROM cash_movements;
        DROP TABLE cash_movements;
        ALTER TABLE cash_movements_new RENAME TO cash_movements;
      `)
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_cash_movements_register_created
        ON cash_movements(register_id, created_at DESC);
    `)

    // Backfill — guardado con NOT EXISTS así es seguro en re-ejecución.
    db.exec(`
      INSERT INTO cash_movements (register_id, user_id, type, amount, description, created_at)
      SELECT cr.id, cr.user_id, 'opening', cr.opening_amount, 'Apertura de caja', cr.opened_at
      FROM cash_registers cr
      WHERE NOT EXISTS (
        SELECT 1 FROM cash_movements cm
        WHERE cm.register_id = cr.id AND cm.type = 'opening'
      );

      INSERT INTO cash_movements (register_id, user_id, type, amount, description, created_at)
      SELECT
        cr.id, cr.user_id, 'closing', cr.closing_amount,
        CASE
          WHEN cr.difference = 0 OR cr.difference IS NULL THEN 'Cierre de caja'
          WHEN cr.difference > 0 THEN 'Cierre de caja (sobrante ' || cr.difference || ')'
          ELSE 'Cierre de caja (faltante ' || ABS(cr.difference) || ')'
        END,
        cr.closed_at
      FROM cash_registers cr
      WHERE cr.status = 'closed'
        AND cr.closing_amount IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM cash_movements cm
          WHERE cm.register_id = cr.id AND cm.type = 'closing'
        );
    `)
  }
}
```

El envolver-en-transacción lo maneja el runner de migraciones existente ([src/main/db/index.ts](../../../../src/main/db/index.ts)), que corre cada cuerpo de migración dentro de `db.transaction(...)`. El recrear-y-swappear queda por lo tanto atómico.

## Rollback

El rollback de schema a v6 **no** está soportado por el framework de migraciones (las migraciones son solo hacia adelante). Ruta de rollback operacional si se descubre un bug real en producción:

1. Restaurar el snapshot de backup pre-migración creado por `preMigrateBackup(dbPath, 7)`.
2. La aplicación carga contra el schema v6 y saltea la entrada de sidebar nueva / los canales IPC nuevos hasta el próximo deploy.

Una migración fallida durante la transacción hace rollback automáticamente; la base queda en v6 y el próximo arranque de la app re-intenta.

## Verificación (manual, quickstart §2)

Tras correr la migración contra una base real existente:

```sql
-- 1. El schema está en v7.
SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;
-- → 7

-- 2. El CHECK está ampliado.
SELECT sql FROM sqlite_master WHERE type='table' AND name='cash_movements';
-- → ... CHECK(type IN ('income','expense','opening','closing','void')) ...

-- 3. void_of existe.
PRAGMA table_info(cash_movements);
-- → ... void_of | INTEGER | 0 | NULL | 0

-- 4. Consistencia del backfill: cada caja existente tiene exactamente una fila de apertura.
SELECT cr.id, COUNT(cm.id) AS opens
FROM cash_registers cr
LEFT JOIN cash_movements cm
  ON cm.register_id = cr.id AND cm.type = 'opening'
GROUP BY cr.id
HAVING opens <> 1;
-- → 0 filas

-- 5. Consistencia del backfill: cada caja cerrada tiene exactamente una fila de cierre.
SELECT cr.id, COUNT(cm.id) AS closes
FROM cash_registers cr
LEFT JOIN cash_movements cm
  ON cm.register_id = cr.id AND cm.type = 'closing'
WHERE cr.status = 'closed' AND cr.closing_amount IS NOT NULL
GROUP BY cr.id
HAVING closes <> 1;
-- → 0 filas

-- 6. Ninguna fila de income/expense fue dropeada o duplicada.
-- Comparar contra un snapshot de conteo de filas pre-migración.
SELECT COUNT(*) FROM cash_movements WHERE type IN ('income','expense');
```
