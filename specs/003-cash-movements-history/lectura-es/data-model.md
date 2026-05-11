# Modelo de Datos: Historial de Movimientos de Caja

**Feature**: 003-cash-movements-history
**Fecha**: 2026-05-11

Este documento captura el diff a nivel columna que aplica la migración v7, la forma de las filas sintéticas de backfill, el linkage de anulación, y las formas esperadas de query para `listMovements` y `voidMovement`.

## Tabla `cash_movements` existente

Como referencia, el schema v6 es ([src/main/db/schema.ts:69-77](../../../src/main/db/schema.ts#L69-L77)):

```sql
CREATE TABLE cash_movements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  register_id INTEGER NOT NULL REFERENCES cash_registers(id),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL CHECK(type IN ('income','expense')),
  amount      INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
```

`amount` se guarda como guaraníes enteros (sin decimales — misma convención que `sales.total`, `cash_registers.opening_amount`, etc.). `created_at` es un string en hora local (consistente con el resto del schema; ver la convención que avala la Constitución).

## Diff de schema (v7)

Dos cambios:

### Diff 1 — Ampliar el CHECK de `type`

**Desde:** `CHECK(type IN ('income','expense'))`
**Hacia:** `CHECK(type IN ('income','expense','opening','closing','void'))`

Implementado vía el patrón de recrear-y-swappear documentado en [contracts/migration-v7.md](contracts/migration-v7.md). Las filas existentes se preservan bit a bit (solo cambia el constraint).

### Diff 2 — Agregar `void_of` (FK nullable)

```sql
ALTER TABLE cash_movements ADD COLUMN void_of INTEGER NULL REFERENCES cash_movements(id);
```

- `void_of` es `NULL` para cada fila regular (ingreso manual, egreso manual, apertura, cierre).
- `void_of` se setea exactamente una vez, al insert, cuando la fila es de tipo `'void'`. Apunta al `cash_movements.id` original que se está cancelando.
- Los originales nunca se actualizan. El flag "¿esta fila está anulada?" se computa al leer como `EXISTS (SELECT 1 FROM cash_movements v WHERE v.void_of = m.id)`. Esto mantiene la tabla estrictamente append-only y evita un booleano denormalizado que podría desincronizarse.

### Diff 3 — Índice compuesto

```sql
CREATE INDEX IF NOT EXISTS idx_cash_movements_register_created
  ON cash_movements(register_id, created_at DESC);
```

Justificación en [research.md §4](research.md#4-estrategia-de-indexación).

## Schema final (post-v7)

```sql
CREATE TABLE cash_movements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  register_id INTEGER NOT NULL REFERENCES cash_registers(id),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  type        TEXT NOT NULL CHECK(type IN ('income','expense','opening','closing','void')),
  amount      INTEGER NOT NULL,
  description TEXT NOT NULL,
  void_of     INTEGER NULL REFERENCES cash_movements(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_cash_movements_register_created
  ON cash_movements(register_id, created_at DESC);
```

`src/main/db/schema.ts` se actualiza para que una instalación nueva aterrice directo en la forma v7 sin pasar por la migración (coincide con el precedente sentado por [held_tickets.user_id](../../../src/main/db/schema.ts#L172) para la feature 002).

## Filas sintéticas de apertura/cierre

La migración v7 hace backfill de filas sintéticas desde `cash_registers` para que la página sea útil para sesiones históricas el día uno.

### Fila de apertura (una por cada fila de `cash_registers`)

| Columna       | Valor                                                                  |
|---------------|------------------------------------------------------------------------|
| `register_id` | `cash_registers.id`                                                    |
| `user_id`     | `cash_registers.user_id` (el cajero que abrió la sesión)               |
| `type`        | `'opening'`                                                            |
| `amount`      | `cash_registers.opening_amount` (siempre positivo)                     |
| `description` | `'Apertura de caja'`                                                   |
| `void_of`     | `NULL`                                                                 |
| `created_at`  | `cash_registers.opened_at` (preserva el timestamp original)            |

### Fila de cierre (una por cada fila *cerrada* de `cash_registers`)

| Columna       | Valor                                                                                              |
|---------------|----------------------------------------------------------------------------------------------------|
| `register_id` | `cash_registers.id`                                                                                |
| `user_id`     | `cash_registers.user_id`                                                                           |
| `type`        | `'closing'`                                                                                        |
| `amount`      | `cash_registers.closing_amount` (efectivo contado al cerrar)                                       |
| `description` | `'Cierre de caja'` + nota opcional de diferencia si `cash_registers.difference <> 0`                |
| `void_of`     | `NULL`                                                                                             |
| `created_at`  | `cash_registers.closed_at`                                                                         |

Las filas sintéticas se insertan solo cuando no existe ya una fila de ese tipo para esa caja (guard de idempotencia en re-ejecución — ver contrato de migración).

## Emisión sintética ongoing

Después de v7, el módulo de query de caja emite filas sintéticas directamente desde el flujo operativo:

- [`openCashRegister(userId, openingAmount)`](../../../src/main/db/queries/cash.ts#L3-L12) — después de insertar la fila en `cash_registers`, inserta una fila correspondiente `'opening'` en `cash_movements` en la misma transacción.
- [`closeCashRegister(id, closingAmount, ...)`](../../../src/main/db/queries/cash.ts#L43-L126) — después del `UPDATE cash_registers SET status='closed'`, inserta una fila `'closing'` en `cash_movements` en la misma transacción.

Las dos funciones ya están en la capa de query (Principio III), así que el cambio es invisible para los llamadores. Ninguna firma pública de función cambia.

## Formas de query

### `listMovements(opts, ctx)`

Ubicada en el archivo nuevo `src/main/db/queries/cash-movements.ts`.

**Forma de input:**

```ts
interface ListOpts {
  from?: string        // fecha ISO 'YYYY-MM-DD', inclusivo
  to?: string          // fecha ISO 'YYYY-MM-DD', inclusivo
  types?: CashMovementType[]  // subset de ['income','expense','opening','closing','void']
  userId?: number      // filtro por cajero (honrado cuando ctx.role es admin/supervisor)
  registerId?: number  // filtro por sesión
  search?: string      // substring case-insensitive en description
  page?: number        // 1-indexado; default 1
  perPage?: number     // default 25, max 100
}
interface ListCtx {
  callerUserId: number
  callerRole: 'admin' | 'supervisor' | 'cajero'
}
```

**Scoping de autorización dentro de la query (FR-015, FR-017):**

```ts
// Cuando el llamador es cajero, forzar user_id = callerUserId sin importar opts.userId.
const effectiveUserId = ctx.callerRole === 'cajero' ? ctx.callerUserId : opts.userId
```

Esta lógica vive en la función de query, no en el handler IPC, así que cualquier llamador futuro (incluyendo tests) no puede bypasearla salteando el handler.

**Forma de retorno:**

```ts
interface CashMovementRow {
  id: number
  registerId: number
  userId: number
  userName: string          // joineado desde users
  type: CashMovementType
  amount: number            // Gs. enteros; el signo sigue el significado de la fila
  description: string
  createdAt: string
  isVoided: boolean         // computado: EXISTS inversa con void_of = id
  voidedBy: number | null   // id de la inversa si fue anulado; si no, null
  voidOf: number | null     // para filas de type='void': id del original
  registerStatus: 'open' | 'closed'  // joineado desde cash_registers, usado para destino de navegación
}

interface CashMovementListResult {
  items: CashMovementRow[]
  total: number
  page: number
  perPage: number
}
```

La forma es intencionalmente idéntica a `getAllSales` para que el control de paginación del renderer construido para ventas-listado sea reusable.

**Esqueleto SQL:**

```sql
SELECT
  cm.id, cm.register_id, cm.user_id, u.name AS user_name,
  cm.type, cm.amount, cm.description, cm.created_at,
  cm.void_of,
  EXISTS (SELECT 1 FROM cash_movements v WHERE v.void_of = cm.id) AS is_voided,
  (SELECT v.id FROM cash_movements v WHERE v.void_of = cm.id LIMIT 1) AS voided_by,
  cr.status AS register_status
FROM cash_movements cm
LEFT JOIN users u ON cm.user_id = u.id
LEFT JOIN cash_registers cr ON cm.register_id = cr.id
WHERE 1=1
  /* cláusulas condicionales para from/to/types/userId/registerId/search */
ORDER BY cm.created_at DESC
LIMIT ? OFFSET ?;
```

La query de COUNT espeja el mismo WHERE sin `ORDER BY` / `LIMIT`.

### `voidMovement(originalId, actorUserId)`

Ubicada en el archivo nuevo `src/main/db/queries/cash-movements.ts`.

**Validaciones (en orden):**

1. Cargar la fila original. Si no existe → lanzar `'Movimiento no encontrado.'`.
2. Si `original.type IN ('opening','closing')` → lanzar `'Las aperturas y cierres no se anulan desde esta página. Editá el cierre de caja.'` (FR-022).
3. Si `original.type = 'void'` → lanzar `'No se puede anular una anulación.'` (FR-023).
4. Si ya existe una inversa (`SELECT 1 FROM cash_movements WHERE void_of = ?`) → lanzar `'Este movimiento ya fue anulado.'` (FR-025).
5. Dentro de una sola transacción:
   - Insertar una fila con `type = 'void'`, `void_of = originalId`, `amount = original.amount`, `description = '[ANULACIÓN] ' || original.description`, `register_id = original.register_id`, `user_id = actorUserId`, `created_at` defaultea a `datetime('now','localtime')`.
   - Insertar en `auth_audit` (`operation='cashMovements:void'`, `resolved_user_id=actorUserId`, `resolved_role`, `outcome='allowed'`).
   - Insertar en `action_logs` (`user_id=actorUserId`, `action='void_cash_movement'`, `details=JSON.stringify({ original_id, inverse_id })`).
6. Retornar la fila recién insertada en la misma forma que `CashMovementRow`.

**Atomicidad.** Los pasos 5.1–5.3 comparten una sola llamada `db.transaction(...)`; el estado parcial (inversa sin auditoría, auditoría sin inversa) no puede existir.

**Efecto sobre los totales de `cash_registers`.** Ninguno directo. La anulación afecta el resumen de caja indirectamente a través de la misma ruta de código que ya usan los consumidores ([getCashRegisterSummary](../../../src/main/db/queries/cash.ts#L157-L203)): el resumen suma `income - expense` desde `cash_movements`. Una anulación de un ingreso produce una fila con `type='void'` que *no* la cuenta la query de resumen existente. Para mantener invariantes los totales históricos de sesiones ya cerradas (FR-022, escenario 3 de US3), la suma del resumen se actualiza para incluir filas void con el signo opuesto de su original anulado — ese ajuste es parte del trabajo capturado en las tareas de esta feature.

## Aliases de tipos

Agregados a `src/shared/types.ts`:

```ts
export type CashMovementType = 'income' | 'expense' | 'opening' | 'closing' | 'void'

export interface CashMovementRow { /* forma arriba */ }
export interface CashMovementListResult { /* forma arriba */ }
export interface CashMovementListOpts { /* forma arriba */ }
```

Los importan tanto el renderer (para tipar la UI de filtros y las props de la tabla) como el proceso main (para la función de query y el handler IPC).

## Reglas de validación (referenciadas por los FRs)

| Regla | Origen | Punto de aplicación |
|---|---|---|
| `amount > 0` | existente (sin movimientos en cero o negativos) | `addCashMovement` (existente); la ruta de anulación lo hereda vía `original.amount` |
| `description` no vacío | existente | `addCashMovement` (existente) |
| Solo `income`/`expense` manuales son anulables | FR-022, FR-023 | `voidMovement` paso 2 + 3 |
| Un movimiento se anula a lo sumo una vez | FR-025 | `voidMovement` paso 4; protegido por la ausencia de constraint UNIQUE en `void_of` que **no** garantiza unicidad — el check en runtime es la fuente de verdad, la transacción previene la race, y la carga productiva (clicks manuales de anular) hace que inserts concurrentes en el mismo `void_of` no sean una race realista fuera del test suite. |
| El cajero ve solo sus propias filas | FR-015, FR-017 | Override de parámetros en la query `listMovements` |
| Anular requiere admin/supervisor | FR-018 | Entrada de matriz `cashMovements:void` (`privileged`, roles=admin/supervisor) |

## Transiciones de estado

Una fila de `cash_movements` tiene dos estados efectivos desde la perspectiva de la lógica de negocio:

```
CREATED ──(admin anula)──> VOIDED
   │
   └──(nunca)──> DELETED   ← prohibido (Principio VI, FR-021)
```

La transición es unidireccional; una vez anulada, la fila queda anulada. Un segundo intento de anular sobre el mismo original es rechazado. La condición "anulado" se computa desde la existencia de una fila inversa, así que la transición se expresa completamente insertando esa inversa — sin UPDATE sobre el original.

## Preocupaciones de schema fuera de scope

- **Cierre de una caja abierta que ya tiene una anulación.** La lógica de cierre no cambia; la anulación afecta la ruta de lectura del resumen de caja, no el cómputo del cierre.
- **Reconciliación de crédito de cliente cuando un ingreso que abonó un fiado es anulado.** Fuera de esta feature; el módulo de crédito de cliente no se ve afectado porque anular un movimiento manual de caja es independiente de `customer_payments`.
- **Migrar movimientos ya-anulados-vía-hack-en-DB** (ej.: alguien borró una fila en el pasado). Esas filas simplemente no van a aparecer; la página reporta el estado actual.
