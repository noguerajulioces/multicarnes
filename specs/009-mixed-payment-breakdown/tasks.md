---
description: "Task list for feature 009 — Visibilidad y desglose de ventas mixtas"
---

# Tasks: 009 — Visibilidad y desglose de ventas mixtas

**Input**: Design documents from `specs/009-mixed-payment-breakdown/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/ipc-contracts.md](contracts/ipc-contracts.md), [quickstart.md](quickstart.md)

**Tests**: NO se generan tareas de tests automatizados. La constitución §VII
establece que no hay suite automatizada; la verificación es por gates de build
(`typecheck`/`lint`) + pruebas manuales end-to-end de [quickstart.md](quickstart.md).

**Organización**: las tareas se agrupan por historia de usuario para implementar y
verificar cada una de forma independiente. La feature es **capa de lectura** (cero
IPC nuevas, cero dependencias, cero migración) más un guard de servidor (FR-013).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1, US2, US3). Setup/Foundational/
  FR-013/Polish no llevan label de historia.

---

## Phase 1: Setup

**Purpose**: punto de partida limpio sobre el proyecto existente (no hay init).

- [ ] T001 Confirmar baseline verde antes de empezar: `npm run typecheck:node && npm run typecheck:web && npm run lint`, y releer [plan.md](plan.md) + [research.md](research.md) + [contracts/ipc-contracts.md](contracts/ipc-contracts.md).

---

## Phase 2: Foundational (convenciones compartidas)

**Purpose**: no hay prerequisitos bloqueantes a nivel de código — las tres
historias son cambios de lectura independientes que comparten archivos. Esta fase
fija las decisiones de copy/UX compartidas para evitar retrabajo entre US1 y US3.

**⚠️ Sin esta fase no hay bloqueo técnico, pero alinea el copy una sola vez.**

- [ ] T002 [P] Fijar las decisiones de copy/UX compartidas (defaults en [research.md](research.md) §Preguntas abiertas) y dejarlas registradas en research.md: (a) orden canónico de métodos = Efectivo, Tarjeta, Transferencia, Fiado; (b) header "Tickets" del Resumen → "Movimientos"; (c) nombre de la columna CxC = "Origen mixta"; (d) desglose en el listado = badge "Fiado Gs X" junto a "Mixto"; (e) export del listado = 4 columnas por método (Efectivo/Tarjeta/Transferencia/Fiado) + Total.

**Checkpoint**: convenciones acordadas — las historias pueden comenzar.

---

## Phase 3: User Story 1 — Reporte por método que distribuye porciones (Priority: P1) 🎯 MVP

**Goal**: el Resumen "Por método de pago" distribuye cada porción de las mixtas a
su método real; "Fiado" y "Efectivo" dejan de estar subestimados, la suma de
métodos == total neto, y "Efectivo" coincide con la Caja.

**Independent Test**: período con efvo puro 100k + crédito puro 100k + mixta 100k
(efvo 50k + fiado 30k + tarjeta 20k) ⇒ Efectivo 150k, Fiado 130k, Tarjeta 20k,
suma 300k == neto; Efectivo del Resumen == efectivo esperado de la Caja.

### Implementation for User Story 1

- [ ] T003 [US1] Reescribir `byMethod` en `salesSummary` (src/main/db/queries/reports.ts:169-182) a `UNION ALL`: rama (A) `SELECT payment_method AS method, total AS amount FROM sales WHERE <período> AND status='completed' AND payment_method != 'mixed'` + rama (B) `SELECT sp.method AS method, sp.amount AS amount FROM sale_payments sp JOIN sales s ON sp.sale_id=s.id WHERE <período> AND s.status='completed' AND s.payment_method='mixed'`, envuelto en `SELECT method, COUNT(*) AS sales_count, COALESCE(SUM(amount),0) AS total FROM (...) GROUP BY method`. Binds `(from,to,from,to)`. Ordenar por el orden canónico de T002 (o `ORDER BY total DESC` si se prefiere) — sin reintroducir el literal `'mixed'`.
- [ ] T004 [US1] Agregar el cálculo `mixedCount` (= `COUNT(*) FROM sales WHERE payment_method='mixed' AND status='completed'` en el período) en `salesSummary` e incluirlo en el objeto de retorno (src/main/db/queries/reports.ts:~228).
- [ ] T005 [P] [US1] Extender `SalesSummaryResult` en src/preload/index.d.ts (~182-188): `byMethod[].method` pasa a `'cash'|'card'|'credit'|'transfer'` (sin `'mixed'`) y agregar `mixedCount: number`.
- [ ] T006 [US1] Espejar el tipo en src/renderer/src/modules/reportes/ReportesPage.tsx (~81-87: agregar `mixedCount`); en el render del Resumen (~678-717) agregar una leyenda informativa "N ventas mixtas distribuidas" desde `mixedCount` (sin sumar dinero, FR-005); renombrar el header de la columna "Tickets" → "Movimientos" (~667); conservar intacta la sub-fila `byCardProcessor` bajo "Tarjeta" (~696-714). Depende de T003, T004, T005.
- [ ] T007 [US1] Verificar US1 contra [quickstart.md](quickstart.md) §1: sembrar el caso canónico, confirmar Efectivo 150k / Fiado 130k / Tarjeta 20k, suma == neto (SC-001), Efectivo == Caja (SC-002), no aparece fila "Mixto" (SC-006), y `byCardProcessor` sigue cuadrando. Correr `typecheck:web`.

**Checkpoint**: US1 funcional y verificable de forma independiente — MVP listo.

---

## Phase 4: User Story 2 — Visibilidad de deuda por cliente incl. origen mixtas (Priority: P1)

**Goal**: el dueño ve, por cliente, su saldo deudor y reconoce la deuda originada
en mixtas (CxC + ficha), distinguiendo STOCK (saldo vivo) de FLUJO (fiado generado).

**Independent Test**: cliente con crédito puro 100k + mixta porción fiada 30k ⇒
CxC lista el saldo correcto y "Origen mixta" = 30k; la ficha muestra "Fiado en
esta venta" en ambas ventas; Σ "Fiado en esta venta" == generated del CxC.

### Implementation for User Story 2

- [ ] T008 [US2] Enriquecer `pendingCredits` (src/main/db/queries/reports.ts:111-135) con dos subconsultas correlacionadas por `customer_id` (mismo idioma que `byCardProcessor`): `credit_generated` (= `SUM(s.total)` de ventas `payment_method='credit'` completadas) y `mixed_credit_generated` (= `SUM(sp.amount)` de porciones `sale_payments.method='credit'` de mixtas completadas). No cambiar WHERE/ORDER ni la firma.
- [ ] T009 [P] [US2] Extender `PendingCreditRow` en src/preload/index.d.ts (~172-180): agregar `credit_generated: number` y `mixed_credit_generated: number`.
- [ ] T010 [US2] En src/renderer/src/modules/reportes/ReportesPage.tsx: espejar `PendingCreditRow` (~71-79); agregar la columna "Origen mixta" = `formatGs(mixed_credit_generated)` en la tabla CxC (~847-897, ajustar el `colSpan` del tfoot ~901-911); agregarla al export en `reportConfigs.fiados.columns` (~133-140) y `prepareExportData` case `'fiados'` (~207-215); copy aclaratorio de que "Saldo deudor" es stock y "Origen mixta" es generación histórica bruta. Depende de T008, T009.
- [ ] T011 [P] [US2] En src/renderer/src/modules/clientes/ClienteFichaPage.tsx (~342-348): extender el cómputo `creditDue` para que cuando `payment_method==='credit'` use `s.total` (además del caso `'mixed'` actual); cambiar el copy de la sub-línea (~368-372) a "Fiado en esta venta" para no confundir con saldo pendiente. Sin backend (getCustomerSales ya hidrata `sale.payments`).
- [ ] T012 [US2] Verificar US2 contra [quickstart.md](quickstart.md) §3: CxC con saldo correcto + "Origen mixta" 30k; ficha con "Fiado en esta venta" en crédito puro y en mixta; cross-check Σ ficha == generated del CxC. Correr `typecheck`.

**Checkpoint**: US1 y US2 funcionan de forma independiente.

---

## Phase 5: User Story 3 — Listado + filtro de fiado + export con desglose (Priority: P2)

**Goal**: el listado de ventas muestra el desglose por fila (al menos la porción
fiada), permite filtrar las ventas que generaron fiado (incluidas las mixtas) y
exporta columnas por método.

**Independent Test**: período con crédito puro + mixta con porción fiada ⇒ el
filtro "Solo ventas con fiado" muestra ambas; la fila de la mixta muestra "Fiado
Gs X"; el Excel separa las porciones por método; ya no aparece "Fiado · Pagado".

### Implementation for User Story 3

- [ ] T013 [US3] En `getAllSales` (src/main/db/queries/sales.ts:247-304): agregar opt `creditOnly?: boolean`; cuando es `true`, sumar al WHERE `(s.payment_method = 'credit' OR EXISTS (SELECT 1 FROM sale_payments sp WHERE sp.sale_id = s.id AND sp.method = 'credit'))`, reusando el mismo WHERE en el `COUNT(*)` (~281-283) para que la paginación cuadre. Ortogonal a `paymentMethod`.
- [ ] T014 [US3] En `getAllSales`: tras armar `items` (~291-301), batch `SELECT * FROM sale_payments WHERE sale_id IN (...)` con placeholders parametrizados, agrupar con el helper `groupBySale` (copiar el de src/main/db/queries/customers.ts:385-396), asignar `sale.payments` y derivar `sale.credit_portion` = suma de porciones `method='credit'`. Depende de T013 (misma función).
- [ ] T015 [P] [US3] Agregar `credit_portion?: number` a `interface Sale` en src/shared/types.ts (~151-174) y `creditOnly?: boolean` al opts de `sales.getAll` en src/preload/index.d.ts (~88-95).
- [ ] T016 [US3] En src/renderer/src/modules/ventas-listado/VentasListadoPage.tsx: eliminar el estado muerto `creditPaid` (~121-122, 130-134, 275-276, 302-303); en la columna "Método" (~299-307) mostrar para mixtas el desglose agregado por método (destacando `formatGs(s.credit_portion)`); agregar un toggle "Solo ventas con fiado" que pasa `creditOnly` en `load(1)` (~68-73) y en `fetchAllForExport` (~142); ampliar `exportColumns` (~37-44) y `prepareExport` (~119-136) con columnas por método derivadas de `s.payments`. Depende de T013, T014, T015.
- [ ] T017 [US3] Verificar US3 contra [quickstart.md](quickstart.md) §4: el filtro incluye crédito puro + mixtas con porción fiada; la fila muestra el desglose; el export trae columnas por método; "Fiado · Pagado" ya no aparece. Correr `typecheck`.

**Checkpoint**: las tres historias funcionan de forma independiente.

---

## Phase 6: Integridad de datos — FR-013 (guard de servidor)

**Purpose**: garantizar que no exista fiado sin cliente (SC-009). Independiente de
las historias de lectura; sólo toca `createSale`. **Comparte archivo con US3**
(`sales.ts`, función distinta `createSale` vs `getAllSales`): coordinar el orden
de edición para evitar conflictos.

- [ ] T018 Extraer un helper local puro `creditPortion(data: CreateSaleData): number` en src/main/db/queries/sales.ts (credit puro = `data.total`; mixta = suma de `payments` con `method==='credit'`; resto 0) y reusarlo en el cálculo del límite de fiado (~99-106) y en el UPDATE de balance de mixtas (~200-203), sin cambiar los montos resultantes (eliminar el doble cálculo).
- [ ] T019 Agregar el guard en `createSale` (src/main/db/queries/sales.ts), dentro de la `db.transaction()`, ANTES del bloque `if (data.customerId)` (~98): si `creditPortion(data) > 0 && !data.customerId` → `throw new Error('Una venta a fiado requiere un cliente asociado. Seleccioná un cliente antes de registrar la porción a crédito.')`. Cubre crédito puro y mixto. Depende de T018.
- [ ] T020 Verificar FR-013 contra [quickstart.md](quickstart.md) §5: un payload con porción de crédito (puro o mixto) y `customerId` null es rechazado por el servidor sin escribir filas (transacción revertida); ventas legítimas con cliente y ventas sin fiado pasan idénticas. Correr `typecheck:node`.

**Checkpoint**: ya no puede crearse fiado sin cliente.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: verificación integral y no-regresión.

- [ ] T021 [P] Verificar los edge cases de [quickstart.md](quickstart.md) §6: mixta anulada excluida (FR-012); dos porciones del mismo método sumadas en un bucket; mixta con descuento cuadra; cliente con saldo a favor.
- [ ] T022 No-regresión contra DB existente ([quickstart.md](quickstart.md) §2): confirmar que las mixtas históricas reflejan su desglose sin migración (SC-007) y que `byCardProcessor` y el efectivo del arqueo NO cambiaron de valor respecto del release anterior.
- [ ] T023 [P] Gates finales en verde: `npm run typecheck:node && npm run typecheck:web && npm run lint`, sin warnings nuevos.
- [ ] T024 Recorrer la "Definición de hecho" de [quickstart.md](quickstart.md) y confirmar que el resumen del feature en CLAUDE.md sigue describiendo lo implementado (ajustar si algún detalle cambió).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: tras Setup. No bloquea técnicamente, pero alinea copy.
- **US1 / US2 / US3 (Phases 3-5)**: tras Foundational. Independientes entre sí en
  cuanto a valor y verificación, pero **comparten archivos** (ver caveat abajo).
- **FR-013 (Phase 6)**: independiente; puede hacerse en cualquier momento tras
  Setup. Comparte `sales.ts` con US3.
- **Polish (Phase 7)**: tras completar las historias deseadas.

### Caveat de archivos compartidos (afecta el paralelismo entre historias)

- `src/main/db/queries/reports.ts` → US1 (`byMethod`) y US2 (`pendingCredits`):
  funciones distintas, pero mismo archivo → secuenciar para evitar conflicto.
- `src/renderer/src/modules/reportes/ReportesPage.tsx` → US1 (Resumen) y US2 (CxC):
  secciones distintas, mismo archivo → secuenciar.
- `src/preload/index.d.ts` → US1, US2 y US3 (interfaces distintas) → secuenciar.
- `src/main/db/queries/sales.ts` → US3 (`getAllSales`) y FR-013 (`createSale`):
  funciones distintas, mismo archivo → secuenciar.

Por estos solapamientos, las historias se entregan mejor **en orden de prioridad**
(US1 → US2 → US3 → FR-013) por un solo dev, en vez de en paralelo total.

### Within Each User Story

- El query (db-query) antes del tipo del renderer que lo consume.
- El tipo (preload/shared) puede ir en paralelo con el query (archivo distinto).
- El render depende del query + el tipo.
- La verificación al final de cada historia.

---

## Parallel Opportunities

- **T005** (preload, US1) en paralelo con **T003/T004** (reports.ts, US1).
- **T009** (preload, US2) y **T011** (ClienteFichaPage, US2) en paralelo con
  **T008/T010** dentro de su orden de dependencia (T011 es independiente de T010).
- **T015** (shared/types + preload, US3) en paralelo con **T013/T014** (sales.ts).
- **T021** y **T023** (Polish) en paralelo.

### Parallel Example: User Story 1

```bash
# Tras T003/T004 (reports.ts), el tipo de preload puede ir en paralelo:
Task: "T005 Extender SalesSummaryResult en src/preload/index.d.ts (+mixedCount, byMethod sin 'mixed')"
# T006 (ReportesPage) espera a T003, T004 y T005.
```

---

## Implementation Strategy

### MVP First (solo US1)

1. Phase 1 (Setup) → Phase 2 (Foundational).
2. Phase 3 (US1): reescribir `byMethod` + `mixedCount` + render.
3. **PARAR Y VALIDAR**: caso canónico de [quickstart.md](quickstart.md) §1
   (suma == neto, Efectivo == Caja). Es el corazón del reclamo del cliente.
4. Demostrar al dueño.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → verificar → demo (MVP: el Resumen ya cuadra y muestra el fiado real).
3. US2 → verificar → demo (deuda por cliente con origen de mixtas).
4. US3 → verificar → demo (listado + filtro + export con desglose).
5. FR-013 → verificar (integridad: no más fiado sin cliente).
6. Polish (no-regresión + gates).

---

## Notes

- `[P]` = archivo distinto, sin dependencias pendientes.
- `[Story]` mapea la tarea a su historia para trazabilidad; FR-013 y Polish no
  llevan label.
- Cada historia es verificable de forma independiente vía [quickstart.md](quickstart.md).
- Cero IPC nuevas, cero dependencias, cero migración: reusar el patrón `UNION ALL`
  existente (`byCardProcessor`/`otherMethodsTotals`) y el batch `WHERE sale_id IN`
  de `customers.ts`. No tocar la conciliación de efectivo de Caja ni la de tarjeta
  por procesador (ya correctas).
- Commit por tarea o grupo lógico; parar en cualquier checkpoint para validar.
