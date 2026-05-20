# Implementation Plan: 008 — Tipos de pago en la cobranza de deuda

**Branch**: `008-debt-payment-types` (working on `main`) | **Date**: 2026-05-19 | **Spec**: [spec.md](spec.md)
**Input**: [specs/008-debt-payment-types/spec.md](spec.md)

## Summary

Permitir que un mismo flujo de "Registrar Pago" sobre la deuda de un cliente
distinga dos formas de cobro: **Efectivo (afecta caja)**, que además del
`customer_payments` genera un `cash_movements` tipo `income` en la caja
abierta del cobrador; y **Descuento de sueldo (no afecta caja)**, que sólo
inserta `customer_payments`. El selector se ofrece para todos los clientes
y para los tres roles operativos (Admin/Supervisor/Cajero). La validación de
caja abierta y la atomicidad de la doble inserción son la columna vertebral
de la feature; no se crean canales IPC nuevos y no se agregan dependencias.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), React 19, Electron 39.
**Primary Dependencies**: better-sqlite3 (transacción atómica), Zustand
(`useCashStore` ya rastrea la caja abierta), sin agregados.
**Storage**: SQLite. Migración aditiva v10: `customer_payments.affects_cash
INTEGER NOT NULL DEFAULT 1`. Sin backfill de `cash_movements` históricos.
**Testing**: QA manual por user story (consistente con specs 001–007). El
quickstart documenta los pasos a ejecutar contra una DB con datos.
**Target Platform**: Aplicación desktop Electron (macOS/Windows/Linux).
**Project Type**: Aplicación desktop — main + preload + renderer + shared.
**Performance Goals**: El usuario percibe el guardado como inmediato
(<200 ms desde el clic en Guardar hasta ver el saldo nuevo y el toast).
**Constraints**: Operación atómica obligatoria — `customer_payments` y
`cash_movements` se insertan dentro de una sola `db.transaction()` cuando
`affects_cash=1`; si una falla, ambas hacen rollback. Sin pagos mixtos en
la misma operación. Validación de caja abierta tanto en el cliente
(bloquear el botón Guardar) como en el handler (re-validar antes del INSERT
para cubrir el edge de caja cerrada con el modal abierto).
**Scale/Scope**: Pequeño — 1 migración, ~30 LOC en `queries/customers.ts`,
1 cambio en `customers.ipc.ts` (firma del handler), 1 cambio en preload
(tipos), 1 ampliación del modal "Registrar Pago" en `ClienteFichaPage.tsx`
con un selector de 2 opciones, una columna nueva en la tabla de Historial
de Pagos. Sin nuevas IPC.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluado contra constitution v1.1.0:

| Principio | Estado | Notas |
|-----------|--------|-------|
| **I. Locked Tech Stack** | ✅ PASS | Cero dependencias nuevas. Todo se resuelve con better-sqlite3 + Zustand existentes. |
| **II. Strict Types & SRP** | ✅ PASS | El handler IPC sigue siendo una función pequeña. El modal gana un `paymentKind: 'cash' \| 'salary_deduction'` en `useState` y un componente `<SegmentedControl>` ya disponible (o un par de radios), sin acoplar fetch + UI. |
| **III. Layered Data Access** | ✅ PASS | Toda la lógica SQL (incluyendo el INSERT condicional de `cash_movements`) vive en `src/main/db/queries/customers.ts`. El IPC handler sólo orquesta. |
| **IV. Main/Renderer Boundary** | ✅ PASS | Se reutiliza la IPC `customers:addPayment` con un parámetro nuevo. Sin canales nuevos. El renderer no toca SQLite ni el filesystem. |
| **V.a Hardware en main** | ✅ PASS | Sin cambios en impresión. |
| **V.b Formatters en renderer** | ✅ PASS | Sin reportes nuevos; el cierre de caja ya consume `cash_movements`. |
| **VI. Schema & Feature Preservation** | ⚠️ ATENCIÓN — JUSTIFICADA | Hay una **expansión intencional de permisos**: hoy `customers:addPayment` está restringido a `admin/supervisor`; la decisión acordada con el usuario (Q2) es habilitar también `cajero`. Esto califica como **(b) una evolución explícita** del feature de pagos, no un drive-by edit. Se documenta en Complexity Tracking y se acompaña con un `Round-2` revisable. La migración v10 es **aditiva** (ADD COLUMN ... DEFAULT 1), preserva todos los datos y no rompe queries existentes. |
| **VII. Simplicity & Approval** | ✅ PASS | Reutilizar la IPC y el modal existente es la ruta más simple. No se introduce un store nuevo: `useCashStore.register` ya provee el estado de "caja abierta del usuario actual" (única caja abierta a nivel sistema, persistida en localStorage). El bloqueo de Guardar y el mensaje son derivados directamente de ese estado. |

**Gates resolved**: All ✅ excepto VI marcado como ⚠️ justificado.
No `[NEEDS CLARIFICATION]`. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/008-debt-payment-types/
├── plan.md                # Este archivo
├── research.md            # Phase 0
├── data-model.md          # Phase 1
├── quickstart.md          # Phase 1
├── contracts/             # Phase 1
│   ├── ipc-customers-addPayment.md
│   └── migration-v10-customer-payments-affects-cash.md
└── checklists/
    └── requirements.md    # Generado por /speckit-specify
```

### Source Code (repository root)

Archivos modificados:

```text
src/main/db/
├── index.ts                   # Agrega migración v10 (ADD COLUMN affects_cash)
├── schema.ts                  # Refleja affects_cash en CREATE TABLE para fresh installs
└── queries/customers.ts       # addCustomerPayment ahora recibe affectsCash:boolean;
                              # cuando true valida + inserta cash_movements (income)
                              # dentro de la misma db.transaction()

src/main/ipc/
└── customers.ipc.ts           # 'customers:addPayment' acepta el flag affectsCash
                              # y lee ctx.userId para el cash_movements

src/main/auth/
└── matrix.ts                  # Amplía customers:addPayment a ['admin','supervisor','cajero']

src/preload/
├── index.ts                   # Expone el nuevo argumento en window.api.customers.addPayment
└── index.d.ts                 # Tipo actualizado de addPayment(...)

src/shared/
└── types.ts                   # CustomerPayment gana affects_cash:boolean

src/renderer/src/modules/clientes/
└── ClienteFichaPage.tsx       # Modal "Registrar Pago" agrega selector de tipo +
                              # validación de caja abierta para 'cash'.
                              # Tabla "Historial de Pagos" gana columna/badge "Tipo".
```

Archivos NO tocados (preservación):

```text
src/main/db/queries/cash.ts        # getOpenCashRegisterByUserId() ya existe
src/main/db/queries/reports.ts     # Cierre de caja ya suma cash_movements
src/renderer/src/store/cash.store.ts  # useCashStore.register ya provee la caja abierta
```

**Structure Decision**: Single Electron project con separación
main/preload/renderer/shared (Principio I no permite reorganizar). Toda la
lógica de pagos vive donde ya está: `queries/customers.ts` (DB) +
`customers.ipc.ts` (IPC) + `ClienteFichaPage.tsx` (UI). La feature evita
cualquier nuevo módulo: la regla de "no afecta caja" es una rama de 3
líneas dentro de una función existente.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Expansión de roles para `customers:addPayment` (admin/supervisor → +cajero) | El escenario P1 ("cliente paga en efectivo en caja") es ejecutado por el cajero, no por admin/supervisor. Mantener la restricción actual obligaría al cajero a buscar al supervisor para cada cobranza, vaciando el valor de la feature. La decisión fue explícita (Q2). | Mantener admin/supervisor solamente: rechazada porque rompe el flujo P1. Crear un canal IPC separado para el modo "Efectivo" del cajero: rechazada por Principio VII (duplica superficie sin razón). |

## Phase 0 — Outline & Research

Ver [research.md](research.md). Resumen de decisiones:

1. **Migración aditiva v10 con DEFAULT 1** — para preservar el contrato actual (todos los pagos viejos eran efectivamente "efectivo en caja", aunque no se reflejaran en `cash_movements`).
2. **Sin backfill de `cash_movements` históricos** — alterar cierres pasados es peor que perder el detalle hacia atrás. La columna nueva sólo afecta filas futuras.
3. **Validación de caja abierta del usuario actual** — usar `getOpenCashRegisterByUserId(ctx.userId)` en el handler IPC; espejar la regla en el cliente con `useCashStore.register?.userId === user.id`.
4. **Atomicidad** — envolver el INSERT a `customer_payments`, el UPDATE de `customers.balance` y (cuando aplique) el INSERT a `cash_movements` en una única `db.transaction()`. Patrón ya usado en `addCustomerPayment` y `openCashRegister`.
5. **Descripción del `cash_movements`** — formato `"Pago de deuda — <Nombre del cliente>"` para que sea legible en "Movimientos de Caja". Si hubiera `note`, anexarla entre paréntesis.
6. **Permisos** — ampliar `customers:addPayment` en `auth/matrix.ts` a `['admin','supervisor','cajero']`. Las acciones de editar/eliminar pago siguen en `admin/supervisor` para no introducir un cambio adicional fuera de scope (la edición/eliminación toca dinero ya contabilizado).
7. **Auditoría** — `action_logs` se llena con la entrada `add_customer_payment` (ya existente o equivalente), añadiendo `affects_cash` y el `register_id` resultante (si aplica) al campo `details`.

## Phase 1 — Design & Contracts

Ver:

- [data-model.md](data-model.md) — shape de `customer_payments` post-v10 + relación con `cash_movements`.
- [contracts/ipc-customers-addPayment.md](contracts/ipc-customers-addPayment.md) — firma extendida del IPC + reglas de validación.
- [contracts/migration-v10-customer-payments-affects-cash.md](contracts/migration-v10-customer-payments-affects-cash.md) — SQL exacto de la migración.
- [quickstart.md](quickstart.md) — pasos manuales de QA, uno por user story.

Re-evaluación post-diseño: los contratos cumplen Principios III (SQL aislado),
IV (IPC tipada, sin canales nuevos) y VII (la rama "no afecta caja" es un
`if` de 3 líneas dentro de una función que ya existe). **Gates aún ✅** con la
excepción justificada de VI.

Agent context: el bloque entre `<!-- SPECKIT START -->` y `<!-- SPECKIT END -->`
de `CLAUDE.md` se actualiza al final de esta fase para apuntar a este plan y
resumir 008 como feature activa.

## Next

Ejecutar `/speckit-tasks` para descomponer en tareas implementables y secuenciadas.
