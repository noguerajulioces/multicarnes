# Data Model — 008 Tipos de pago en la cobranza de deuda

## Tablas afectadas

### `customer_payments` (modificada por v10)

Tabla existente que registra cada cobranza realizada contra la deuda de
un cliente. La feature 008 agrega una sola columna nueva.

| Columna       | Tipo    | Nulo | Default | Origen      | Notas                                                                      |
|---------------|---------|------|---------|-------------|----------------------------------------------------------------------------|
| `id`          | INTEGER | NO   | PK auto | preexistente|                                                                            |
| `customer_id` | INTEGER | NO   | —       | preexistente| FK → `customers(id)`                                                        |
| `user_id`     | INTEGER | NO   | —       | preexistente| FK → `users(id)`. Usuario que cobró/registró.                              |
| `amount`      | INTEGER | NO   | —       | preexistente| Guaraníes, entero positivo.                                                |
| `note`        | TEXT    | SÍ   | NULL    | preexistente| Nota opcional del cobrador.                                                |
| `affects_cash`| INTEGER | NO   | `1`     | **v10**     | `1` = pago en efectivo que tocó caja; `0` = descuento de sueldo / fuera de caja. |
| `created_at`  | TEXT    | NO   | now     | preexistente| Timestamp local.                                                           |

Reglas:

- `affects_cash` se trata como booleano en TypeScript (`boolean`) y
  como `INTEGER 0/1` en SQLite.
- En INSERT: lo decide el cobrador (radio en el modal). Por defecto el
  modal pre-selecciona "Efectivo" (1) para no romper la cadencia del
  flujo más frecuente.
- En SELECT: el shape de `CustomerPayment` en `src/shared/types.ts` gana
  `affects_cash: boolean`. El mapeo es `row.affects_cash === 1`.
- Pagos previos a v10 quedan con `affects_cash = 1` por el DEFAULT
  declarado en la migración.

### `cash_movements` (sin cambio de schema)

Tabla existente. La feature 008 sólo agrega un patrón de uso: cuando se
inserta un `customer_payment` con `affects_cash = 1`, se inserta también,
dentro de la misma transacción, una fila aquí con:

| Columna       | Valor                                                         |
|---------------|---------------------------------------------------------------|
| `register_id` | `getOpenCashRegisterByUserId(ctx.userId).id`                 |
| `user_id`     | `ctx.userId`                                                  |
| `type`        | `'income'`                                                    |
| `amount`      | El mismo `amount` del `customer_payment` (entero positivo).   |
| `description` | `'Pago de deuda — <customer.name>'` + ` (note)` si hay nota.  |
| `void_of`     | `NULL`                                                        |
| `created_at`  | now (default de la tabla)                                     |

Restricciones:

- No hay FK directo entre `customer_payments` y `cash_movements`. La
  relación es por monto/fecha/usuario/descripción. **Trade-off conocido**:
  si en el futuro hay que cruzar "qué `cash_movements` corresponde a qué
  `customer_payment`" será necesaria una migración v11 con FK. Hoy no es
  necesario (los reportes no requieren la unión).
- La inserción es **condicional**: si `affects_cash = 0` no hay fila aquí.

### `customers` (sin cambios estructurales)

Sigue actualizándose con `UPDATE customers SET balance = balance + ?` —
el balance se mueve igual en ambos modos. La única diferencia es que
en el modo "Descuento de sueldo" no se toca caja.

### `action_logs` (sin cambio de schema)

Se reusa para auditar la acción. Cada `addCustomerPayment` agrega una
fila con `action = 'add_customer_payment'` y `details` JSON:

```json
{
  "customer_id": 42,
  "amount": 60000,
  "affects_cash": true,
  "register_id": 17,        // null si affects_cash=false
  "note": "Acuerdo del lunes" // o null
}
```

## Estado de la transacción

La operación atómica es:

```
BEGIN;
  INSERT INTO customer_payments (customer_id, user_id, amount, note, affects_cash) VALUES (?, ?, ?, ?, ?);
  UPDATE customers SET balance = balance + ? WHERE id = ?;
  -- Sólo si affects_cash = 1:
  INSERT INTO cash_movements (register_id, user_id, type, amount, description) VALUES (?, ?, 'income', ?, ?);
  INSERT INTO action_logs (user_id, action, details) VALUES (?, 'add_customer_payment', ?);
COMMIT;
```

Pre-checks que ocurren antes del BEGIN:

1. `amount > 0` — validación de saneamiento.
2. Cliente existe — `getCustomerById(customerId)` para el nombre y para
   asegurar la FK.
3. Si `affects_cash = 1`: existe una caja abierta para `ctx.userId`
   (vía `getOpenCashRegisterByUserId`). Si no, throw antes del BEGIN.

## Entidades compartidas (TypeScript)

`src/shared/types.ts` — `CustomerPayment`:

```ts
export interface CustomerPayment {
  id: number
  customer_id: number
  user_id: number
  user_name?: string
  amount: number
  note: string | null
  affects_cash: boolean   // ← nuevo en 008
  created_at: string
}
```

El shape `Customer` no cambia. El shape `CashMovement` tampoco.
