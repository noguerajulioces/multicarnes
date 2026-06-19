# Research — 009 Visibilidad y desglose de ventas mixtas

Phase 0. Decisiones de diseño consolidadas, aterrizadas en el código real. Cada
decisión reusa patrones ya presentes y cumple la constitución (repository
pattern, boundary main/renderer, sin deps nuevas, sin migración para
visibilidad, no romper la conciliación de efectivo/tarjeta ya correcta).

## Hallazgo transversal (vale para todas las historias)

- El desglose de toda venta mixta ya vive en `sale_payments(method, amount,
  processor, reference)` (`src/main/db/queries/sales.ts:182-192`). Es **lectura
  pura**: cero migración, cero backfill; las mixtas históricas se reflejan solas
  (FR-011/SC-007).
- El patrón de solución **ya existe tres veces**: `byCardProcessor`
  (`reports.ts:187-209`), `otherMethodsTotals` (`cash.ts:332-353`), `mixedCash`
  (`cash.ts:106-117`). Se reusa el `UNION ALL` (rama single-method + rama
  porciones de mixtas), no se inventa nada.
- Cero canales IPC nuevos: los tres handlers existentes (`reports:salesSummary`,
  `reports:pendingCredits`, `sales:getAll`) transportan shapes **aditivos**.

---

## Decisión 1 — US1: Reporte "Por método de pago" que distribuye porciones

**Decisión**: reescribir `byMethod` en `salesSummary` (`reports.ts:169-182`) de
`GROUP BY payment_method` a un `UNION ALL`:
- Rama (A) ventas de método único: `SELECT payment_method AS method, total AS
  amount FROM sales WHERE <período> AND status='completed' AND payment_method !=
  'mixed'`.
- Rama (B) porciones de mixtas: `SELECT sp.method AS method, sp.amount AS amount
  FROM sale_payments sp JOIN sales s ON sp.sale_id=s.id WHERE <período> AND
  s.status='completed' AND s.payment_method='mixed'`.
- Envoltura: `SELECT method, COUNT(*) AS sales_count, COALESCE(SUM(amount),0) AS
  total FROM (...) GROUP BY method ORDER BY total DESC`. Binds `(from,to,from,to)`.

El bucket `'mixed'` desaparece: la rama (A) lo excluye y la (B) lo descompone.
`sale_payments.method` sólo admite `cash|card|credit|transfer` (CHECK,
`schema.ts:122`), así que ningún bucket espurio reaparece. Se agrega un campo
informativo separado `mixedCount` (COUNT de ventas mixtas del período) que **no
suma dinero** a ningún bucket (FR-005).

**Rationale**: el reclamo raíz (OWN-01, brecha #14 *critical/confirmed* en
flows.md) es que `GROUP BY payment_method` deja `'mixed'` como cubo opaco,
subestimando Efectivo y Fiado. Reusar el `UNION ALL` ya probado es mínimo riesgo
y máxima consistencia: el bucket `'cash'` pasa a calcularse con la **misma
expresión que la Caja** (`cashSales.total + mixedCash.total`,
`cash.ts:256-274`), cerrando la discrepancia Reportes↔Caja.

**Reconciliación (por construcción)**: `createSale` valida `sum(payments.amount)
=== total` dentro de la transacción (`sales.ts:70-82`), por lo que Σ porciones de
una mixta == su `total`. Entonces Σ buckets == Σ `sales.total` (status
completed) == `totals.total` → diferencia 0 Gs (SC-001/FR-004). Bucket `'cash'`
== efectivo de la Caja al guaraní (SC-002/FR-014). Bucket `'card'` == Σ
`byCardProcessor.total` (no se rompe tarjeta).

**Alternativas descartadas**:
- Conservar fila "Mixto" + sub-filas → duplica dinero, no reconcilia, viola
  FR-001/FR-004.
- Materializar columnas `cash_amount/credit_amount/...` en `sales` → requiere
  migración + backfill; innecesario (el dato ya está en `sale_payments`).
- Calcular en el renderer por venta → rompe repository pattern, O(n) IPC.
- Reusar `salesByMethod` del cash summary (`cash.ts:294-302`) → es código muerto
  monolítico, arrastra el mismo defecto.
- Helper SQL compartido entre los tres `UNION ALL` → abstracción prematura
  (constitución §VII); scopes distintos (período vs register_id).

---

## Decisión 2 — US2: Visibilidad de deuda por cliente (CxC + ficha)

**Decisión**: separar **STOCK** (saldo vivo `customers.balance`, ya correcto) de
**FLUJO** (fiado generado, derivable), y dar visibilidad de origen sólo a nivel
flujo y porción-por-venta — nunca dividiendo el saldo vivo.

- **(A) Ficha** (`ClienteFichaPage.tsx:342-348`): hoy la sub-línea "Fiado
  {monto}" sólo aparece en mixtas. Extender el cómputo `creditDue`: si
  `payment_method==='credit'` usar `s.total`; si `'mixed'` usar la suma de
  porciones credit (lógica actual). Etiqueta → **"Fiado en esta venta"** (es el
  fiado *original* de la venta, no el saldo pendiente — limitación honesta sin
  `sale_id`, flows.md brecha #10). Cero backend: `getCustomerSales` ya hidrata
  `sale.payments` (`customers.ts:382`).
- **(B) CxC / Fiados Pendientes** (`pendingCredits`, `reports.ts:111-135`):
  agregar dos subconsultas correlacionadas por `customer_id` (mismo idioma que
  `byCardProcessor`): `credit_generated` (= SUM `sales.total` de credit puro
  completado) y `mixed_credit_generated` (= SUM `sale_payments.amount` de
  porciones credit de mixtas completadas). La tabla CxC muestra una columna nueva
  **"Origen mixta"** = `mixed_credit_generated`, rotulada como **generación
  histórica bruta** (no parte del saldo vivo). El "Saldo deudor" sigue siendo
  `abs(balance)`, la fuente de verdad.
- **(C)** Sin reporte nuevo de "fiado generado del período": US1 ya entrega el
  bucket "Fiado" del período en el Resumen. CxC se queda lifetime/stock (hoy no
  toma fechas), para no romper su naturaleza.

**Rationale**: el reclamo literal es "no puedo verificar qué clientes deben y por
cuánto, porque sale 'mixta'". El saldo total ya es correcto; lo que falta es
reconocer el **origen**. La división del saldo vivo por origen es imposible sin
`sale_id` en pagos (fuera de alcance, Assumption del spec), así que se entrega
origen a nivel de flujo bruto y de porción por venta — honesto y suficiente.

**Reconciliación**: "Saldo deudor" (stock) **NO** debe cuadrar con
`credit_generated`/`mixed_credit_generated` (flujo bruto, no descuenta pagos) —
se rotula explícito para no inducir un cuadre falso. Punto de cruce: Σ de las
sub-líneas "Fiado en esta venta" de la ficha == `credit_generated +
mixed_credit_generated` del CxC para ese cliente.

**Alternativas descartadas**: dividir `balance` por origen (imposible sin
`sale_id`); agregar fechas a `pendingCredits` (cambia su naturaleza stock; el
período ya lo cubre US1).

---

## Decisión 3 — US3: Listado de ventas + filtro de fiado + export

**Decisión**: extender `getAllSales` (`sales.ts:247-304`) en tres ejes, todo SQL
en el repo, sin migración:

1. **Adjuntar desglose** (FR-008): reusar el batch `WHERE sale_id IN (...)` de
   `getCustomerSales` (`customers.ts:366-405`). Tras traer la página, una query
   `SELECT ... FROM sale_payments WHERE sale_id IN (?, ...)`, agrupar con el
   mismo `groupBySale` y asignar `sale.payments`. Una sola query extra por
   página de ≤50; sin N+1.
2. **Filtro "ventas que generaron fiado"** (FR-009): nuevo opt `creditOnly?:
   boolean` ortogonal a `paymentMethod`. Añade al WHERE `(s.payment_method =
   'credit' OR EXISTS (SELECT 1 FROM sale_payments sp WHERE sp.sale_id=s.id AND
   sp.method='credit'))`. El `COUNT(*)` usa el mismo WHERE (paginación cuadra).
3. **Porción fiada por fila**: derivar `sale.credit_portion` en JS desde
   `sale.payments` ya cargados (cero queries extra).

**Renderer**: columna "Método" muestra para mixtas el desglose por porción
(agregado por método para no duplicar líneas), destacando `formatGs(credit_
portion)`. Toggle "Solo ventas con fiado" → `creditOnly`. Export: ampliar
`exportColumns`/`prepareExport` con columnas por método derivadas de
`sale.payments`; `export.ts` no se toca (genérico). **Matar el estado muerto
`creditPaid`** (`VentasListadoPage.tsx:121-122`): depende de `customer_balance`
que `getAllSales` nunca trae y que no debe traer (deuda fungible sin `sale_id`);
se reemplaza por mostrar la porción fiada generada (dato de flujo honesto).

**Rationale**: el listado/export son la primera superficie de revisión y la única
vía de conciliar fuera de la app. Hoy colapsan todo en "Mixto" y el filtro
"Fiado" excluye mixtas. El batch `WHERE IN` ya está probado en `customers.ts`.

**Reconciliación**: el footer (suma `s.total` no anuladas) no se toca. Σ porciones
== `s.total` por construcción. `credit_portion` del listado filtrado de un
período == bucket "Fiado" del Resumen de US1 (mismo origen) — cross-check manual.

**Fuera de US3 (recomendado)**: `RecentSalesTable` del Dashboard
(`getRecentSales` no carga payments) — no ampliar superficie; iteración aparte.

---

## Decisión 4 — FR-013: guard de servidor "fiado siempre exige cliente"

**Decisión**: en `createSale` (`sales.ts:52`), dentro de la `db.transaction()`,
agregar un guard **antes** del bloque de límite de fiado (`sales.ts:98`): computar
`creditAmount` (credit puro = `data.total`; mixta = suma de payments con
`method==='credit'`) y, si `creditAmount > 0 && !data.customerId`, `throw new
Error('Una venta a fiado requiere un cliente asociado. Seleccioná un cliente
antes de registrar la porción a crédito.')`. El throw revierte toda la
transacción (igual que el límite de fiado, `sales.ts:122-126`). Cubre crédito
**puro** (hoy `sales.ts:194-198` no debita balance si falta cliente → fiado
fantasma) y **mixta** con porción crédito (hoy `sales.ts:200-210` gateado por
`if customerId`). Refactor recomendado: extraer helper local `creditPortion(data)`
y reusarlo en el guard, en el límite de fiado y en el UPDATE de balance,
eliminando el triple cálculo (deuda técnica low de flows.md §143).

**Rationale**: decisión del dueño (2026-06-18): "no debería haber fiado sin
cliente". La UI ya lo bloquea (`CobroModal canConfirm`, líneas 142/145); el guard
es defensa en profundidad contra payload manipulado o regresión de UI
(escenarios PAY-09/LIFE-08). Es la única parte del "fiado fantasma" dentro del
alcance.

**Reconciliación (SC-009)**: con el guard activo, toda porción de crédito
persistida debita `customers.balance`, luego Σ(porciones credit vivas) ==
Σ(deuda atribuida). No puede haber fiado sin contraparte. Ventas legítimas con
cliente y ventas sin crédito pasan idénticas.

**Nota**: filas históricas anómalas (credit con `customer_id` NULL, sólo
alcanzables por payload manipulado previo al guard) **sólo se señalan**, no se
corrigen aquí (flows.md §135: no se esperan casos).

---

## Contratos, tipos y autorización (resumen — detalle en `contracts/`)

- **Cero IPC nuevos**. `reports:salesSummary`, `reports:pendingCredits`,
  `sales:getAll`, `sales:create` mantienen firma; los shapes de salida crecen
  aditivamente.
- **Tipos** (aditivos): `SalesSummaryResult.mixedCount`, `PendingCreditRow.
  credit_generated` + `.mixed_credit_generated`, `getAllSales` opts `creditOnly?`,
  `Sale.credit_portion?`. `Sale.payments?` y `SalePayment` ya existen.
- **Autorización** (`matrix.ts`): sin cambios de superficie — ningún canal nuevo,
  ningún rol cambia.

## Riesgos consolidados

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Reconciliación Efectivo Resumen↔Caja sólo exacta cuando el conjunto de ventas es el mismo (período de fechas vs register_id) | Media | Documentar; el caso de aceptación usa un período de un solo turno (ver quickstart) |
| `sales_count` por bucket pasa a contar porciones, no ventas | Baja | Renombrar la columna "Tickets"→"Movimientos" o documentar; el # real de ventas vive en el KPI `totals.sales_count` (no cambia) |
| Quitar `'mixed'` del union de `byMethod.method` podría afectar consumidores que asuman el literal | Baja | El render ya hace fallback (`?? 'neutral'`); cubrir con `typecheck:web` |
| Doble cálculo de `creditPortion` si el refactor del helper se hace mal | Baja | El helper debe producir EXACTAMENTE el mismo número; probar con PAY-01..PAY-12 de flows.md |
| `sale_payments` sin índice en `sale_id` (EXISTS / WHERE IN hacen scan) | Baja | Irrelevante al volumen actual; índice aditivo opcional, NO requerido por esta feature |
| El dueño lee "Origen mixta" como parte del saldo vivo | Media | Copy/tooltip explícito de "generación histórica bruta, no descuenta pagos" |

## Preguntas abiertas (UX/copy — no bloquean; defaults asumidos)

1. Columna "Tickets" del Resumen → ¿renombrar a "Movimientos"? (default:
   renombrar/documentar).
2. Presentación de `mixedCount` → leyenda al pie "N ventas mixtas distribuidas"
   (default).
3. Orden de `byMethod` → ¿fijar orden canónico (Efectivo, Tarjeta,
   Transferencia, Fiado) en vez de `ORDER BY total DESC`? (default: orden
   canónico para que "Fiado" no salte de lugar).
4. Nombre de la columna CxC → "Origen mixta" vs "Fiado por mixtas (histórico)"
   (default: el más explícito).
5. Formato del desglose en la fila del listado y columnas del export → el backend
   soporta cualquiera; fijar con el dueño (default: badge "Fiado Gs X" junto a
   "Mixto" + 4 columnas por método en el Excel).
6. ¿Centralizar `SalesSummaryResult`/`PendingCreditRow` en `shared/types.ts`
   (hoy en `preload/index.d.ts`)? (default: mantener el patrón actual para acotar
   el diff).

> Estas son decisiones de copy/UI; todas tienen un default razonable aplicado.
> Ninguna cambia el contrato ni el alcance. Se confirman durante la
> implementación / con el dueño.
