---
description: "Task list for feature 008-debt-payment-types"
---

# Tasks: 008 — Tipos de pago en la cobranza de deuda

**Input**: Design documents from `/specs/008-debt-payment-types/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: El proyecto no usa tests automatizados para UI/IPC (constitución
v1.1.0, sección "Development Workflow"). La validación se hace manualmente
vía [quickstart.md](quickstart.md). Sólo se exigen `npm run typecheck` +
`npm run lint` antes de merge.

**Organization**: Tareas agrupadas por user story. La spec define 3 user
stories: US1 (Efectivo afecta caja, P1), US2 (Descuento de sueldo no
afecta caja, P1) y US3 (badge en el Historial, P2). US1 y US2 son co-P1 —
ambas deben funcionar para considerar la feature entregable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos diferentes, sin dependencias bloqueantes).
- **[Story]**: A qué user story pertenece. Setup, Foundational y Polish no llevan etiqueta de story.

## Path Conventions

Estructura Electron del proyecto (ver [plan.md](plan.md) sección "Source Code"):

- Schema/migrations: `src/main/db/index.ts`, `src/main/db/schema.ts`
- Queries: `src/main/db/queries/customers.ts`, `src/main/db/queries/cash.ts`
- IPC + auth: `src/main/ipc/customers.ipc.ts`, `src/main/auth/matrix.ts`
- Preload: `src/preload/index.ts`, `src/preload/index.d.ts`
- Tipos compartidos: `src/shared/types.ts`
- UI: `src/renderer/src/modules/clientes/ClienteFichaPage.tsx`

---

## Phase 1: Setup

**Purpose**: No hay archivos nuevos ni dependencias nuevas (Principio I).
Esta feature reutiliza módulos existentes.

- [ ] T001 Verificar estado limpio del repo, corriendo `npm run typecheck` y `npm run lint` antes de tocar nada. La feature parte de una baseline en verde para que cualquier regresión sea atribuible a esta rama.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema (migración v10), tipos compartidos y matriz de
permisos son prerrequisitos transversales: las tres user stories asumen
que `customer_payments.affects_cash` existe, que `CustomerPayment.affects_cash`
está tipado, y que el cajero puede invocar `customers:addPayment`.

**⚠️ CRITICAL**: Ninguna user story puede empezar hasta que esta fase
esté completa.

- [ ] T002 Agregar la migración v10 al final del array en `src/main/db/index.ts` con guarda `PRAGMA table_info` (patrón v2/v8). SQL: `ALTER TABLE customer_payments ADD COLUMN affects_cash INTEGER NOT NULL DEFAULT 1;`. Descripción: `008-debt-payment-types: add affects_cash to customer_payments`. Ver [contracts/migration-v10-customer-payments-affects-cash.md](contracts/migration-v10-customer-payments-affects-cash.md) para el body exacto.
- [ ] T003 [P] Actualizar `src/main/db/schema.ts` para que `CREATE TABLE customer_payments (...)` incluya `affects_cash INTEGER NOT NULL DEFAULT 1` (fresh installs). Ubicación: bloque `CREATE TABLE IF NOT EXISTS customer_payments` (~línea 156).
- [ ] T004 [P] Agregar `affects_cash: boolean` a la interfaz `CustomerPayment` en `src/shared/types.ts`. Verificar que el `select` actual de `getCustomerPayments` ya devolverá el campo (queries en `queries/customers.ts` usan `SELECT cp.*` o equivalente — confirmar en T006).
- [ ] T005 [P] Modificar `src/main/auth/matrix.ts` línea ~69: la entrada `'customers:addPayment'` pasa de `roles: ['admin', 'supervisor']` a `roles: ['admin', 'supervisor', 'cajero']`. `customers:updatePayment` y `customers:deletePayment` quedan sin cambios.

**Checkpoint**: schema y tipos listos. Ya puede empezar US1.

---

## Phase 3: User Story 1 — Pago Efectivo afecta caja (Priority: P1) 🎯 MVP

**Goal**: cuando el cobrador elige "Efectivo (afecta caja)" en el modal,
el pago genera un `customer_payments` Y un `cash_movements` `income` en la
caja abierta del cobrador, atómicamente. Si no hay caja abierta, el
guardado se bloquea con mensaje claro en el cliente y se rechaza con
error específico en el backend.

**Independent Test**: con caja abierta del cajero y un cliente con saldo
-100.000, registrar un pago Efectivo de 30.000 y verificar (a) saldo
queda en -70.000, (b) aparece movimiento `income` en "Movimientos de
Caja" con descripción `Pago de deuda — <nombre>`, (c) el cierre suma esos
30.000. Luego, con la caja cerrada, intentar lo mismo y verificar que
falla con mensaje "Necesitás una caja abierta para registrar pagos en
efectivo." sin dejar filas en ninguna tabla.

### Implementation for User Story 1

- [ ] T006 [US1] Refactorizar `addCustomerPayment` en `src/main/db/queries/customers.ts` (~línea 105) a la nueva firma orientada a objeto: `addCustomerPayment(args: { customerId; userId; amount; note?; affectsCash; callerUserId }) → Customer`. Dentro de `db.transaction()`: (1) validar `amount > 0`; (2) obtener `customer` con `getCustomerById(args.customerId)` — throw "Cliente no encontrado." si null; (3) si `affectsCash === true`, llamar `getOpenCashRegisterByUserId(args.callerUserId)` — throw "Necesitás una caja abierta para registrar pagos en efectivo." si null; (4) INSERT en `customer_payments` con `affects_cash = args.affectsCash ? 1 : 0`; (5) UPDATE balance; (6) si `affectsCash`, INSERT en `cash_movements` (`register_id` del paso 3, `user_id` = callerUserId, `type='income'`, `amount`, descripción `Pago de deuda — <customer.name>` + nota entre paréntesis si hay); (7) INSERT en `action_logs` con `action='add_customer_payment'` y `details` JSON `{customer_id, amount, affects_cash, register_id, note}`. Patrón de tx idéntico al de `openCashRegister`.
- [ ] T007 [US1] Modificar el handler `customers:addPayment` en `src/main/ipc/customers.ipc.ts` (~línea 23) para que reciba `(customerId, userId, amount, note, affectsCash)` y llame `customersQuery.addCustomerPayment({ customerId, userId, amount, note, affectsCash, callerUserId: ctx.userId })`. Ver [contracts/ipc-customers-addPayment.md](contracts/ipc-customers-addPayment.md).
- [ ] T008 [P] [US1] Actualizar la firma de `addPayment` en `src/preload/index.ts` (binding `ipcRenderer.invoke('customers:addPayment', ...)`) para que reciba y reenvíe el quinto argumento booleano.
- [ ] T009 [P] [US1] Actualizar el tipo `ApiCustomers.addPayment` en `src/preload/index.d.ts` (~línea 116): `addPayment(customerId: number, userId: number, amount: number, note: string | undefined, affectsCash: boolean): Promise<Customer>`.
- [ ] T010 [US1] En el modal "Registrar Pago" de `src/renderer/src/modules/clientes/ClienteFichaPage.tsx` (~línea 465): agregar estado `payAffectsCash: boolean` (default `true`) y un selector visual (dos opciones excluyentes: "Efectivo (afecta caja)" y "Descuento de sueldo (no afecta caja)"). Resetearlo en `closePaymentModal`. Por ahora la UI sólo muestra el selector — el efecto real lo aplican T011 y T012.
- [ ] T011 [US1] En el mismo archivo, importar `useCashStore` y leer `const register = useCashStore((s) => s.register)`. Calcular `const canPayCash = register != null && register.user_id === user?.id`. Cuando `payAffectsCash && !canPayCash`, deshabilitar el botón Guardar y mostrar un banner inline "Necesitás abrir caja para registrar pagos en efectivo." dentro del modal.
- [ ] T012 [US1] Modificar `handlePayment` (~ línea cercana al modal) para que llame `window.api.customers.addPayment(customer.id, user.id, payAmount, payNote || undefined, payAffectsCash)` y muestre toast de éxito ("Pago registrado") o de error vía `handleApiError(err)`. Refrescar `customer` y `payments` (igual que hoy) post-success.

**Checkpoint**: con esta fase completa, US1 es ejecutable end-to-end y
quedó plumbing también US2 (la rama `affectsCash=false` ya está en T006).
La UI todavía no muestra el badge de tipo (US3).

---

## Phase 4: User Story 2 — Descuento de sueldo no afecta caja (Priority: P1)

**Goal**: la opción "Descuento de sueldo (no afecta caja)" del selector
guarda el pago **sin** crear movimiento de caja, no exige caja abierta,
y queda diferenciado en el `action_logs` (`affects_cash: false`,
`register_id: null`).

**Independent Test**: con un cliente con saldo -60.000, sin caja abierta
del usuario actual, elegir "Descuento de sueldo" en el modal, guardar
60.000 → saldo cliente queda en 0, el toast se muestra exitoso, no
aparece ningún `cash_movements` nuevo, el cierre de caja del día NO
incluye esos 60.000.

### Implementation for User Story 2

- [ ] T013 [US2] Verificar que en `src/renderer/src/modules/clientes/ClienteFichaPage.tsx` el botón Guardar **NO** se deshabilita cuando `!canPayCash` siempre y cuando `payAffectsCash === false`. Concretamente, la lógica del disabled debe ser: `disabled={!payAmount || (payAffectsCash && !canPayCash)}`. Confirmar también que cambiar el selector a "Descuento de sueldo" oculta el banner de "Necesitás abrir caja". Sin esta tarea US2 quedaría bloqueado por la guarda de US1.
- [ ] T014 [US2] Confirmar (no requiere edición si T006 quedó bien) que el `addCustomerPayment` no llama `getOpenCashRegisterByUserId` cuando `affectsCash === false`, y que en ese caso `action_logs.details.register_id` se serializa como `null`. Si T006 dejó esa rama mal, ajustar.

**Checkpoint**: US1 + US2 funcionales y validables independientemente
contra el quickstart.

---

## Phase 5: User Story 3 — Distinción visual en Historial (Priority: P2)

**Goal**: el "Historial de Pagos" del detalle del cliente muestra el
tipo de cada pago con un badge claro (verde "Efectivo" / ámbar "Descuento
de sueldo"). Los pagos pre-release aparecen como "Efectivo" (default
del schema).

**Independent Test**: en un cliente con al menos un pago pre-release,
uno Efectivo nuevo y uno Descuento de sueldo nuevo, ver tres filas con
badge correspondiente y poder identificar el tipo de cada una en ≤3s
sin leer la nota.

### Implementation for User Story 3

- [ ] T015 [US3] En `src/renderer/src/modules/clientes/ClienteFichaPage.tsx`, sección de la tabla "Historial de Pagos" (~ línea 430-460): agregar una columna nueva "Tipo" entre "Monto" y "Nota". Renderizar `<Badge tone={p.affects_cash ? 'success' : 'warning'}>{p.affects_cash ? 'Efectivo' : 'Descuento de sueldo'}</Badge>`. Ajustar el `<th>` correspondiente y, si el header dice "Monto Nota" (ver línea 457), agregar la celda "Tipo".
- [ ] T016 [P] [US3] Verificar en pantalla que el ancho de la columna nueva no rompe el layout responsive del card. Si el modal o las cards más chicas comprimen demasiado el badge, ajustar con `whitespace-nowrap` o `min-width`.

**Checkpoint**: las tres user stories funcionales. Pasar a Polish.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates de la constitución + QA manual.

- [ ] T017 [P] Ejecutar `npm run typecheck` (incluye `typecheck:node` y `typecheck:web`) y obtener 0 errores. Si el cambio de firma del IPC dejó call-sites desactualizados (poco probable — la única llamada está en `ClienteFichaPage.tsx`), arreglarlos.
- [ ] T018 [P] Ejecutar `npm run lint` y obtener 0 errores nuevos. Warnings introducidos por esta rama deben corregirse antes de merge.
- [ ] T019 Ejecutar el [quickstart.md](quickstart.md) completo en una DB con datos: QA US1 (efectivo afecta caja), QA US2 (descuento no afecta), edge case sin caja, QA US3 (badges), QA permisos cajero, QA auditoría `action_logs`.
- [ ] T020 Smoke test de no-regresión: registrar una venta en efectivo desde el POS principal, verificar que cae en `cash_movements` y en el cierre de caja exactamente como antes. Esto cubre Principio VI contra el riesgo de que el refactor de `addCustomerPayment` haya tocado tangencialmente otras rutas (no debería, pero la queries/customers.ts es compartido).
- [ ] T021 Actualizar `CLAUDE.md` si hace falta — verificar que el bloque `<!-- SPECKIT START -->` ya apunta a 008 (se hizo en /speckit-plan; sólo confirmar).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: arranca inmediatamente.
- **Foundational (Phase 2)**: depende del checkpoint de Setup. **Bloquea todas las user stories**.
- **US1 (Phase 3)**: depende de Foundational.
- **US2 (Phase 4)**: depende de Foundational. Reutiliza T006/T007 hechos en US1 — orden recomendado: US1 → US2 secuencial.
- **US3 (Phase 5)**: depende de Foundational. Independiente de US1 y US2 (sólo lee `affects_cash` del API).
- **Polish (Phase 6)**: depende de US1 + US2 + US3 (ideal) o al menos del MVP (US1+US2).

### Within Each User Story

- T002 (migración) bloquea a T003 (schema), T004 (tipos), T005 (matriz) sólo a nivel conceptual — son archivos distintos y pueden ir en paralelo.
- T006 (query) bloquea a T007 (IPC handler), que bloquea a T008/T009 (preload) y a T012 (call-site UI).
- T010/T011 (UI) dependen de los tipos de T009 pero son archivos distintos: pueden empezar en paralelo si se acuerda la firma.

### Parallel Opportunities

- T003, T004, T005 corren en paralelo (archivos distintos, sin dependencias entre ellos).
- T008 y T009 corren en paralelo (preload `.ts` vs `.d.ts`).
- T015 y T016 corren en paralelo (lógica vs ajuste visual).
- T017 y T018 corren en paralelo (typecheck vs lint).

---

## Parallel Example: Foundational Phase

```bash
# Después de T002 (migración), las tres siguientes corren en paralelo:
Task: "Actualizar schema.ts para fresh installs"            # T003
Task: "Agregar affects_cash a CustomerPayment en types.ts"   # T004
Task: "Ampliar matriz de permisos para cajero"               # T005
```

---

## Implementation Strategy

### MVP (US1 + US2)

US1 y US2 son co-P1: la feature no entrega valor con sólo una de las
dos. El MVP termina al final del **Checkpoint US2** (T014). En ese
punto la app ya distingue ambos modos y el cierre de caja se beneficia.
US3 (badges) se puede shippear en la misma release o en una de
seguimiento corta.

### Secuencia recomendada (solo dev)

1. Phase 1 — T001 (typecheck verde).
2. Phase 2 — T002 → T003/T004/T005 en paralelo.
3. Phase 3 — T006 → T007 → T008/T009 paralelos → T010/T011/T012.
4. Phase 4 — T013/T014 (validación del flag y de la UX del "no caja").
5. Phase 5 — T015/T016 (badges).
6. Phase 6 — T017/T018 paralelos → T019 → T020 → T021.

### Compromiso de no regresión

T020 es no-negociable: si la venta en efectivo desde el POS principal se
rompe, US1/US2/US3 valen cero. Antes de pedir review, correrlo en una
copia de DB con datos.

---

## Notes

- Sin agregar dependencias (Principio I). Si una task necesita
  algo nuevo, parar y plantearlo en review.
- Sin nuevas IPC. El parámetro se monta dentro de la IPC existente.
- La feature toca un punto sensible (la matriz de auth) — la expansión
  está documentada en plan.md "Complexity Tracking" y debe quedar
  visible en el commit que la modifica.
- Commit por checkpoint (Setup, Foundational, US1, US2, US3, Polish).
- Si T006 termina muy grande, partirlo en T006a (firma + transacción)
  y T006b (descripción del cash_movement + action_logs detail).
