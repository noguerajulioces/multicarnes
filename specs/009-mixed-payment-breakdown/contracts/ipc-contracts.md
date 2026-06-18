# Contracts — 009 Visibilidad y desglose de ventas mixtas

Superficie de interfaz entre `renderer` y `main`. **Cero canales IPC nuevos.**
Los cuatro canales involucrados mantienen su firma; los shapes de salida crecen
de forma **aditiva** (los consumidores viejos siguen compilando). Toda nueva pieza
de datos cruza el boundary por preload con tipo (constitución §IV).

Convención del repo: los handlers se registran con `registerAuthorized(channel,
rule, fn)`; las reglas viven en `src/main/auth/matrix.ts`. Ninguna regla cambia.

---

## 1. `reports:salesSummary(from: string, to: string)` → `SalesSummaryResult`

- **Firma**: sin cambios. Handler `reports.ipc.ts:36-39` delega a
  `salesSummary(from, to)`.
- **Autorización** (`matrix.ts`): admin / supervisor / cajero — sin cambios.
- **Cambio de shape (aditivo)**:
  - `byMethod[].method`: la unión deja de incluir `'mixed'`; ahora siempre
    `'cash'|'card'|'credit'|'transfer'` (cada porción de mixta distribuida).
  - `byMethod[].sales_count`: pasa a contar **movimientos por método**, no ventas.
  - **`mixedCount: number`** (NUEVO): # de ventas mixtas del período. Informativo;
    no suma dinero a ningún bucket.
- **Invariantes de salida**:
  - `Σ byMethod[].total === totals.total` (mismo período) → diferencia 0 Gs.
  - `byMethod['card'].total === Σ byCardProcessor[].total`.
  - `byMethod['cash'].total ===` efectivo que la Caja usa para el arqueo del
    mismo conjunto de ventas.
- **Productor**: `src/main/db/queries/reports.ts` `salesSummary` (byMethod
  reescrito con UNION ALL + cálculo `mixedCount`).
- **Consumidor**: `ReportesPage.tsx` (Resumen "Por método de pago").

## 2. `reports:pendingCredits()` → `PendingCreditRow[]`

- **Firma**: sin cambios (sin params; sigue siendo lifetime/stock).
- **Autorización**: admin / supervisor — sin cambios.
- **Cambio de shape (aditivo)** por fila:
  - **`credit_generated: number`** (NUEVO): Σ `sales.total` de ventas
    `payment_method='credit'` completadas del cliente (flujo bruto histórico).
  - **`mixed_credit_generated: number`** (NUEVO): Σ `sale_payments.amount` de
    porciones `method='credit'` de ventas mixtas completadas del cliente.
- **Semántica**: `balance` = STOCK (saldo vivo, fuente de verdad). Los
  `*_generated` = FLUJO bruto (no descuentan pagos). No deben cuadrar entre sí.
- **Productor**: `reports.ts` `pendingCredits` (dos sub-SELECT correlacionados por
  `customer_id`, mismo idioma que los `MAX()` actuales).
- **Consumidor**: `ReportesPage.tsx` (tabla CxC + su export).

## 3. `sales:getAll(opts)` → `Paginated<Sale>`

- **Firma**: sin cambios de canal. `opts` gana un campo **opcional**.
- **Autorización**: admin / supervisor / cajero — sin cambios.
- **Cambio de opts (aditivo)**:
  - **`creditOnly?: boolean`** (NUEVO): cuando `true`, filtra ventas que generaron
    fiado = `payment_method='credit'` **OR** mixta con `EXISTS` porción
    `method='credit'`. Ortogonal a `paymentMethod`.
- **Cambio de shape de `Sale` (aditivo)**:
  - **`payments?: SalePayment[]`** (tipo ya existente): ahora **poblado** por
    `getAllSales` (batch `WHERE sale_id IN (...)`), sólo para mixtas.
  - **`credit_portion?: number`** (NUEVO): porción fiada agregada de la venta.
- **Productor**: `src/main/db/queries/sales.ts` `getAllSales`.
- **Consumidor**: `VentasListadoPage.tsx` (grilla + filtro + export).

## 4. `sales:create(data)` → `Sale` — invariante de servidor (FR-013)

- **Firma / payload**: sin cambios.
- **Autorización**: admin / supervisor / cajero — sin cambios.
- **Nueva precondición de runtime**: si la porción de crédito (`> 0`, pura o
  mixta) existe y `data.customerId` es null/ausente → `throw new Error('Una venta
  a fiado requiere un cliente asociado. Seleccioná un cliente antes de registrar
  la porción a crédito.')`. El throw revierte la transacción completa.
- **Propagación del error**: viaja prefijado por Electron (como el resto de los
  throws de `createSale`); el renderer ya lo mapea por substring vía
  `handleApiError`/`extractMessage` (`api-error.ts`). Sin cambios en esa capa.
- **Productor**: `sales.ts` `createSale` (guard nuevo + helper `creditPortion`).

---

## Resumen de compatibilidad

| Canal | Firma | Shape salida | Autorización | Migración |
|---|---|---|---|---|
| `reports:salesSummary` | igual | +`mixedCount`; `byMethod` sin `'mixed'` | igual | no |
| `reports:pendingCredits` | igual | +`credit_generated`, +`mixed_credit_generated` | igual | no |
| `sales:getAll` | +opt `creditOnly?` | `Sale` +`payments` (poblado) +`credit_portion?` | igual | no |
| `sales:create` | igual | igual (nuevo throw FR-013) | igual | no |

Todos los cambios son **retrocompatibles**: campos nuevos opcionales/aditivos;
ningún consumidor existente se rompe. `typecheck:node` + `typecheck:web` cubren
la coherencia preload ↔ renderer.
