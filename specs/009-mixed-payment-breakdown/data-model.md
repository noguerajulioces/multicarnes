# Data Model — 009 Visibilidad y desglose de ventas mixtas

**Cambio de esquema SQLite: NINGUNO.** Esta feature es lectura sobre datos
existentes (`sale_payments` ya guarda el desglose de toda mixta). No se agregan
columnas, tablas ni índices; no hay migración ni backfill (FR-011/SC-007). El
único cambio de write-path es una **validación** (FR-013), que no toca el
esquema. Lo que sigue documenta las entidades existentes que esta feature lee y
los shapes (tipos TS) que se amplían de forma aditiva.

## Entidades existentes (sin cambios de tabla)

### `sales` (fuente de la etiqueta y el total)
- `payment_method ∈ ('cash','card','credit','transfer','mixed')` — etiqueta.
- `total` (post-descuento), `status ∈ ('completed','cancelled')`, `customer_id`,
  `register_id`, `created_at`.
- Para mixtas, `payment_processor`/`payment_reference` quedan NULL (el detalle
  vive por porción en `sale_payments`).

### `sale_payments` (fuente del desglose — clave de la feature)
- `sale_id`, `method ∈ ('cash','card','credit','transfer')` (CHECK garantiza que
  nunca es `'mixed'`), `amount`, `processor`, `reference`.
- Invariante (asegurado en `createSale`): `Σ amount` de una mixta `=== sales.total`.
- **Sólo existe para ventas mixtas.** Una venta de método único no escribe filas:
  su método/monto se derivan de `sales.payment_method` + `sales.total`.

### `customers` (fuente de verdad de la deuda)
- `balance` (entero; negativo = deuda). Ya refleja correctamente la porción de
  crédito de las mixtas. **No se recalcula ni se divide por origen.**

### `customer_payments` (contexto; no se modifica)
- Pagos de deuda. **No tiene `sale_id`** → la deuda es un pool fungible; por eso
  el origen del *saldo vivo* no es divisible (fuera de alcance). Esta feature usa
  el flujo de generación, no la imputación de pagos.

## Shapes (tipos TS) — todos aditivos y retrocompatibles

### `SalesSummaryResult` (`preload/index.d.ts` + espejo en `ReportesPage.tsx`)
```
byMethod: { method: 'cash'|'card'|'credit'|'transfer'; sales_count: number; total: number }[]
          // method ya NUNCA es 'mixed'; cada porción de mixta cae en su bucket real.
          // sales_count = conteo de movimientos por método (no de ventas).
mixedCount: number   // NUEVO — # de ventas mixtas del período (informativo, sin dinero)
totals / byDay / byCardProcessor / byUser   // sin cambios
```
Invariante: `Σ byMethod.total === totals.total` (período). `byMethod['card'] ===
Σ byCardProcessor.total`. `byMethod['cash'] ===` efectivo de la Caja.

### `PendingCreditRow` (`preload/index.d.ts` + espejo en `ReportesPage.tsx`)
```
{ id, name, phone, is_employee, balance, last_credit_sale_at, last_payment_at,
  credit_generated: number,        // NUEVO — Σ total de ventas credit puro (lifetime, bruto)
  mixed_credit_generated: number } // NUEVO — Σ porciones credit de mixtas (lifetime, bruto)
```
Semántica: `balance` = STOCK (saldo vivo, fuente de verdad). Los dos `*_generated`
= FLUJO bruto histórico (no descuentan pagos). **No deben cuadrar entre sí** —
se rotulan como magnitudes distintas.

### `Sale` (`shared/types.ts`)
```
payments?: SalePayment[]   // YA EXISTE — ahora también poblado por getAllSales (listado)
credit_portion?: number    // NUEVO — porción fiada agregada (Σ payments.method='credit'); 0/undef si no hay
```

### `SalePayment` (`shared/types.ts`) — sin cambios
```
{ id, sale_id, method: 'cash'|'card'|'credit'|'transfer', amount, processor?, reference? }
```

### `getAllSales` opts (`preload/index.d.ts`)
```
{ from?, to?, paymentMethod?, userId?, creditOnly?: boolean, page?, perPage? }
                                        // creditOnly NUEVO — incluye credit puro + mixtas con porción credit
```

## Reglas de validación (write-path — FR-013)

- En `createSale`: si la porción de crédito (`creditAmount`) `> 0` y no hay
  `customerId` → rechazar (throw, revierte la transacción). Aplica a crédito puro
  y a mixta con porción crédito. Resultado: **no existe fiado sin cliente** (SC-009).

## Transiciones de estado

- Ninguna nueva. Las ventas siguen `completed → cancelled` (anulación, fuera de
  alcance de esta feature). Todos los desgloses excluyen `cancelled` (FR-012).
