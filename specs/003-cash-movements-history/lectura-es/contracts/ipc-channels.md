# Canales IPC: Historial de Movimientos de Caja

**Feature**: 003-cash-movements-history
**Fecha**: 2026-05-11

Esta feature agrega dos canales IPC nuevos. Ningún canal existente cambia su firma. Los dos se registran a través del flujo estándar `registerAuthorized` ([src/main/auth/guard.ts](../../../../src/main/auth/guard.ts)) y se entran en [src/main/auth/matrix.ts](../../../../src/main/auth/matrix.ts).

## Canal: `cashMovements:list`

**Propósito.** Retornar una slice paginada y filtrada de movimientos de caja visibles para el llamador. Usado por la nueva página "Movimientos de Caja".

**Entrada en la matriz de autorización:**

```ts
'cashMovements:list': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] }
```

Los tres roles pueden llamar al canal. El scoping del cajero-a-sí-mismo (FR-015) se aplica **dentro del handler** antes de construir la query — la misma forma que usa `cash:close` en [cash.ipc.ts:21-38](../../../../src/main/ipc/cash.ipc.ts#L21-L38).

**Payload de request:**

```ts
interface CashMovementListOpts {
  from?: string                // 'YYYY-MM-DD' inclusivo; default = hoy
  to?: string                  // 'YYYY-MM-DD' inclusivo; default = hoy
  types?: CashMovementType[]   // subset de {income, expense, opening, closing, void}; default = todos
  userId?: number              // ignorado cuando el llamador es cajero (forzado al id del llamador)
  registerId?: number          // opcional, restringe a una sesión de caja
  search?: string              // substring opcional case-insensitive en description
  page?: number                // 1-indexado; default 1
  perPage?: number             // default 25; clamped a [10, 100]
}
```

**Payload de respuesta:**

```ts
interface CashMovementListResult {
  items: CashMovementRow[]
  total: number
  page: number
  perPage: number
}

interface CashMovementRow {
  id: number
  registerId: number
  userId: number
  userName: string
  type: 'income' | 'expense' | 'opening' | 'closing' | 'void'
  amount: number           // Gs. enteros
  description: string
  createdAt: string        // 'YYYY-MM-DD HH:MM:SS' hora local
  isVoided: boolean
  voidedBy: number | null  // id del movimiento inverso si esta fila fue anulada
  voidOf: number | null    // id del original si esta fila ES la anulación
  registerStatus: 'open' | 'closed'
}
```

**Esqueleto del handler:**

```ts
registerAuthorized(
  'cashMovements:list',
  getRule('cashMovements:list'),
  (_event, ctx, opts: CashMovementListOpts) => {
    return cashMovementsQuery.listMovements(opts, {
      callerUserId: ctx.userId,
      callerRole: ctx.role
    })
  }
)
```

**Errores (surfaceados como `Error.message`, sin código especial):**

| Condición | Mensaje |
|---|---|
| `perPage` fuera de [10, 100] | `'perPage debe estar entre 10 y 100.'` |
| `from > to` | `'El rango de fechas es inválido.'` |
| `types` contiene un valor desconocido | `'Tipo de movimiento inválido.'` |

Las fallas de autorización (llamador no autenticado, rol faltante) se surface a través de la ruta estándar de falla de `registerAuthorized` y se registran en `auth_audit` automáticamente.

**Binding en preload** ([src/preload/index.ts](../../../../src/preload/index.ts)):

```ts
cashMovements: {
  list: (opts: CashMovementListOpts): Promise<CashMovementListResult> =>
    ipcRenderer.invoke('cashMovements:list', opts),
  // ... void abajo
}
```

**Definición de tipos** ([src/preload/index.d.ts](../../../../src/preload/index.d.ts)):

```ts
cashMovements: {
  list: (opts: CashMovementListOpts) => Promise<CashMovementListResult>
  void: (originalId: number) => Promise<CashMovementRow>
}
```

---

## Canal: `cashMovements:void`

**Propósito.** Anular un movimiento manual previamente registrado, insertando una fila inversa (`type='void'`) linkeada al original vía `void_of`. El original sobrevive intacto.

**Entrada en la matriz de autorización:**

```ts
'cashMovements:void': { kind: 'privileged', roles: ['admin', 'supervisor'] }
```

El rol cajero queda excluido por la matriz; no se necesita ningún chequeo adicional del lado del handler para gating de rol (FR-018).

**Payload de request:**

```ts
number  // el id del movimiento original a anular
```

Un solo argumento posicional mantiene la firma del canal consistente con cómo están moldeadas otras mutaciones de un solo id (`sales:cancel`, `purchases:cancel`).

**Payload de respuesta:**

```ts
CashMovementRow  // la fila inversa recién creada
```

El renderer aplica la fila retornada agregándola a su lista (o invalidando + re-fetcheando la primera página). Se espera que el llamador también re-fetchee el estado del original para que la UI flippee el original de no-anulado a anulado.

**Esqueleto del handler:**

```ts
registerAuthorized(
  'cashMovements:void',
  getRule('cashMovements:void'),
  (_event, ctx, originalId: number) => {
    return cashMovementsQuery.voidMovement(originalId, ctx.userId)
  }
)
```

**Errores:**

| Condición | Mensaje | Constraint |
|---|---|---|
| Original no encontrado | `'Movimiento no encontrado.'` | — |
| Original es apertura o cierre | `'Las aperturas y cierres no se anulan desde esta página. Editá el cierre de caja.'` | FR-022 |
| Original ya es anulación | `'No se puede anular una anulación.'` | FR-023 |
| Original ya anulado | `'Este movimiento ya fue anulado.'` | FR-025 |

Los cuatro son legibles por el usuario (español para el toast del renderer) y llegan al renderer a través del pipeline de api-error existente en [src/renderer/src/lib/api-error.ts](../../../../src/renderer/src/lib/api-error.ts).

**Huella de auditoría:**

- Una fila en `auth_audit` con `operation = 'cashMovements:void'`, `resolved_user_id = ctx.userId`, `resolved_role = ctx.role`, `outcome = 'allowed'`. El guard la escribe automáticamente.
- Una fila en `action_logs` con `action = 'void_cash_movement'`, `details = JSON.stringify({ original_id, inverse_id })`. La función de query la escribe explícitamente dentro de la misma transacción que el insert de la inversa.

---

## Canales existentes tocados

Ninguno cambia su firma. Listados solo para visibilidad:

- `cash:open` — handler sin cambios; la función de query `openCashRegister` ahora también inserta una fila sintética `opening` en `cash_movements` (data-model §"Emisión sintética ongoing"). El contrato IPC de `cash:open` no se ve afectado.
- `cash:close` — igual que arriba, para la fila `closing`.
- `cash:getMovements` — sin cambios; sigue retornando movimientos de una caja. La página "Movimientos de Caja" no llama este canal; llama al nuevo `cashMovements:list` con scope cross-caja paginado.
- `cash:getSummary` — firma sin cambios. El SQL interno se actualiza para tener en cuenta las filas void de modo que los totales de sesiones históricas no se desvíen silenciosamente cuando se agrega una anulación (data-model §"Efecto sobre los totales de cash_registers").

## Diff de la superficie de preload

Las únicas adiciones visibles del lado renderer son las dos funciones en el objeto `cashMovements`. El objeto `cash` existente en el puente preload queda intacto.

```ts
// Antes (extracto):
window.api.cash.open(...)
window.api.cash.getCurrent()
window.api.cash.close(...)
window.api.cash.addMovement(...)
window.api.cash.getMovements(...)
window.api.cash.getSummary(...)
window.api.cash.getAll()

// Después (solo agregados):
window.api.cashMovements.list(opts)
window.api.cashMovements.void(originalId)
```

La separación (`cash.*` vs `cashMovements.*`) espeja el split ya usado entre `customers.*` y los canales tipo `customers:addPayment`: las superficies de lectura a nivel página obtienen su propio namespace para mantener imports compactos.
