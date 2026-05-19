# Contrato de Migración — v10 `customer_payments.affects_cash`

## Versión

`version: 10` — agregar al final del array de migraciones en
`src/main/db/index.ts`. Nunca renumerar ni mutar migraciones aplicadas
(constitución, Principio VI).

## Backup automático

El runner ya ejecuta `preMigrateBackup(dbPath, 10)` antes de aplicar v10.
El backup se guarda como `pre-migrate-v10-<YYYYMMDD-HHmmss>.db` en la
carpeta de backups configurada. **No requiere acción manual.**

## SQL exacto

```sql
ALTER TABLE customer_payments
  ADD COLUMN affects_cash INTEGER NOT NULL DEFAULT 1;
```

Una sola sentencia, idempotente vía el chequeo del runner (cada migración
corre máximo una vez según `schema_migrations`).

## Idempotencia y compatibilidad con fresh installs

`schema.ts` (que corre **antes** de las migraciones en una instalación
fresca) debe declarar la columna desde el principio para evitar el
problema visto en v9 con `payment_processor`:

```sql
CREATE TABLE IF NOT EXISTS customer_payments (
  ...,
  affects_cash INTEGER NOT NULL DEFAULT 1,
  ...
);
```

En una DB nueva, `createTables()` crea la tabla con la columna y la
migración v10 detecta (a) que la columna ya existe y la salta, o (b)
queda registrada como aplicada gracias al wrapper del runner. Para
máxima seguridad, el body de la migración chequea PRAGMA antes de
ejecutar:

```ts
{
  version: 10,
  description: '008-debt-payment-types: add affects_cash to customer_payments',
  run: (db) => {
    const cols = db.prepare(`PRAGMA table_info(customer_payments)`).all() as Array<{ name: string }>
    const has = cols.some((c) => c.name === 'affects_cash')
    if (!has) {
      db.exec(`ALTER TABLE customer_payments ADD COLUMN affects_cash INTEGER NOT NULL DEFAULT 1`)
    }
  }
}
```

Patrón ya usado en migraciones v2 y v8 del proyecto.

## Datos preexistentes

Todas las filas de `customer_payments` previas a la migración quedan con
`affects_cash = 1` por el DEFAULT del ALTER. Esto se traduce en el
Historial de Pagos como un badge "Efectivo" — decisión consciente
(Opción A acordada).

**No se hace backfill** de `cash_movements` retroactivos. Los cierres de
caja históricos quedan exactamente como están.

## Rollback (informativo, no automatizado)

SQLite no soporta `DROP COLUMN` previo a 3.35. better-sqlite3 sí lo
soporta en versiones recientes, pero el proyecto evita drops por
Principio VI. Si fuera necesario revertir:

1. Restaurar el backup `pre-migrate-v10-*.db`.
2. Eliminar la entrada de `schema_migrations` correspondiente.

No se incluye un rollback automatizado: el riesgo de pérdida de datos
es mayor que el costo de revertir manualmente.

## Verificación post-migración

Después de aplicar la migración, los siguientes invariantes deben
sostener (verificable en quickstart):

- `PRAGMA table_info(customer_payments)` muestra `affects_cash` con
  type `INTEGER`, notnull `1`, dflt_value `1`.
- `SELECT COUNT(*) FROM customer_payments WHERE affects_cash IS NULL`
  retorna `0`.
- `SELECT COUNT(*) FROM customer_payments WHERE affects_cash NOT IN (0, 1)`
  retorna `0`.

## Cambios en `schema_migrations`

Una fila nueva se inserta automáticamente al completar:

```
version | applied_at
   10   | 2026-05-19 11:xx:xx
```
