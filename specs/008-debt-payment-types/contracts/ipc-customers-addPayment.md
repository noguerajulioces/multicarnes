# Contrato IPC — `customers:addPayment` (extendido en 008)

Canal IPC existente. La feature 008 extiende su firma con un parámetro
booleano `affectsCash` y endurece las validaciones del handler.

## Firma actual (pre-008)

```ts
addPayment(
  customerId: number,
  userId: number,
  amount: number,
  note?: string
): Promise<Customer>
```

## Firma nueva (post-008)

```ts
addPayment(
  customerId: number,
  userId: number,
  amount: number,
  note: string | undefined,
  affectsCash: boolean   // ← nuevo, obligatorio
): Promise<Customer>
```

El parámetro `affectsCash` se posiciona al final para mantener la
posición de `note` y minimizar el churn en los call-sites. El renderer
SIEMPRE debe enviarlo explícitamente — no hay default en el handler.

## Lugar de declaración

- **Main**: `src/main/ipc/customers.ipc.ts` — handler registrado vía
  `registerAuthorized('customers:addPayment', getRule('customers:addPayment'), ...)`.
- **Preload**: `src/preload/index.ts` y `src/preload/index.d.ts` —
  `window.api.customers.addPayment(...)`.
- **Shared types**: el booleano no requiere nuevo tipo; queda inline en
  la firma.

## Permisos (auth/matrix.ts)

```ts
'customers:addPayment': {
  kind: 'privileged',
  roles: ['admin', 'supervisor', 'cajero']  // ← cajero agregado en 008
}
```

`customers:updatePayment` y `customers:deletePayment` **no se modifican**
(siguen `['admin', 'supervisor']`).

## Validaciones del handler

Antes de cualquier escritura, el handler MUST:

1. `amount > 0` → si no, throw `Error('El monto debe ser mayor a cero.')`.
2. El cliente existe (`getCustomerById(customerId)` retorna no-null) →
   si no, throw `Error('Cliente no encontrado.')`.
3. Si `affectsCash === true`:
   a. Consultar `getOpenCashRegisterByUserId(ctx.userId)`.
   b. Si retorna null/undefined, throw
      `Error('Necesitás una caja abierta para registrar pagos en efectivo.')`.
   c. Conservar el `register.id` para usarlo en el INSERT a
      `cash_movements`.

Ninguna de estas validaciones tiene que ocurrir si la guard de
`registerAuthorized` ya rechazó al usuario por rol — pero la lógica
defensiva sigue presente para el caso en que un canal venga desde un
binding fuera del UI estándar (tests, debug).

## Comportamiento del handler

```ts
registerAuthorized(
  'customers:addPayment',
  getRule('customers:addPayment'),
  (_e, ctx, customerId: number, userId: number, amount: number, note: string | undefined, affectsCash: boolean) => {
    return customersQuery.addCustomerPayment({
      customerId,
      userId,
      amount,
      note,
      affectsCash,
      callerUserId: ctx.userId,   // necesario para resolver la caja abierta del cobrador
    })
  }
)
```

Notas:

- El parámetro legacy `userId` (segundo posicional) se conserva por
  compatibilidad con el renderer que pasa el id desde `auth.store.user`.
  El handler **prefiere `ctx.userId`** (asignado por el guard) para
  resolver la caja abierta — esto cierra una superficie en la que un
  renderer comprometido podría intentar cobrar a nombre de otro
  cajero. El `userId` posicional sigue siendo el `user_id` del
  `customer_payments` (auditable: quién registró el pago) y en
  condiciones normales coincide con `ctx.userId`.

## Errores que el cliente debe manejar

| Error message                                                                    | Caso                                              | Acción UI                                            |
|----------------------------------------------------------------------------------|---------------------------------------------------|------------------------------------------------------|
| `El monto debe ser mayor a cero.`                                                | El cliente puso 0 o negativo (defensa adicional). | Toast de error; modal abierto.                       |
| `Cliente no encontrado.`                                                          | Race: cliente borrado en otra sesión.            | Toast + redirigir a Clientes.                        |
| `Necesitás una caja abierta para registrar pagos en efectivo.`                   | Caja se cerró mientras el modal estaba abierto.   | Toast + cambiar selector a "Descuento de sueldo" o cerrar modal. |
| Cualquier otro error                                                              | Inesperado.                                       | `handleApiError(err)` ya existente.                  |

## Retorno

El handler devuelve el `Customer` actualizado (con el `balance` nuevo) —
igual que hoy. El cliente ya consume ese retorno para refrescar la UI
local sin un segundo round-trip.
