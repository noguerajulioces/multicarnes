# Research — 008 Tipos de pago en la cobranza de deuda

Fase 0 del plan. Cada sección documenta una decisión: **qué se eligió**,
**por qué**, y **qué alternativas se descartaron**.

## R1 — Cómo persistir el tipo de pago

**Decisión**: Agregar una columna `affects_cash INTEGER NOT NULL DEFAULT 1`
a la tabla `customer_payments` vía migración v10.

**Rationale**:
- Es la mínima modificación posible para distinguir dos modos en la misma
  fila — un único bit semántico (afecta caja: sí/no).
- `DEFAULT 1` preserva la semántica histórica: los pagos previos siempre
  fueron registrados con la intención de "efectivo" aunque la implementación
  no creara `cash_movements`.
- Mantiene `customer_payments` como la única fuente de verdad del Historial
  de Pagos del cliente — no se duplica información en dos tablas.

**Alternativas descartadas**:
- **Tabla nueva `customer_salary_deductions`**: duplicaría schema, query y
  UI para algo que es la misma operación contable contra el saldo. Más
  código, mismo dato.
- **Columna `payment_kind TEXT CHECK(... IN('cash','salary_deduction'))`**:
  más expresiva pero abre la puerta a un tercer/cuarto valor sin que la
  feature lo justifique (YAGNI). Si en el futuro hay más tipos, se cambia
  a TEXT con migración v11.

## R2 — Backfill de `cash_movements` para pagos históricos

**Decisión**: **No** crear `cash_movements` retroactivos para los pagos
existentes en `customer_payments`. La columna `affects_cash` se rellena con
1 (Opción A acordada), pero ningún movimiento de caja se genera.

**Rationale**:
- Inyectar `cash_movements` retroactivos cambiaría los totales de
  cierres de caja ya realizados, contaminando reportes históricos.
- La precedente migración v7 (cash-movements-history) hizo un backfill de
  filas sintéticas de apertura/cierre, pero con un criterio distinto:
  reconstruyó eventos *que sí ocurrieron* (las cajas se abrieron/cerraron).
  Aquí estaríamos *fabricando* movimientos que nunca entraron al efectivo.
- La pérdida de detalle hacia atrás (no poder reconciliar pagos
  pre-release con el cierre del día) es aceptable: ese problema ya existe
  hoy y la feature no lo empeora.

**Alternativas descartadas**:
- **Backfill condicional por rango de fechas**: añade complejidad sin
  resolver el problema central — cualquier reconstrucción es ficticia.
- **Borrar y rehacer el historial**: violaría Principio VI (preservación
  de datos productivos).

## R3 — Validación de caja abierta (cliente vs servidor)

**Decisión**: Validación **doble**:
1. **Cliente**: cuando el usuario selecciona "Efectivo" en el modal, si
   `useCashStore.register` es `null` o `register.user_id !== user.id`,
   el botón Guardar queda deshabilitado y se muestra un banner.
2. **Servidor**: el handler IPC re-consulta `getOpenCashRegisterByUserId(ctx.userId)`
   inmediatamente antes del INSERT; si no encuentra una caja abierta para
   ese usuario, lanza un Error con mensaje específico antes de cualquier
   escritura.

**Rationale**:
- El cliente provee feedback inmediato y evita guardados imposibles.
- El servidor cubre el edge case "caja se cerró mientras el modal estaba
  abierto" — sin esa segunda validación el pago se persistiría sin
  `register_id` válido.
- El patrón es idéntico al que usan las ventas en efectivo: el frontend
  toma `register.id` del store, el backend valida con SQL.

**Alternativas descartadas**:
- **Sólo validación cliente**: vulnerable a race conditions (caja cerrada
  por otro usuario antes del INSERT).
- **Sólo validación servidor**: el usuario podría llenar y enviar el
  formulario para recibir un error genérico — peor UX.

## R4 — Atomicidad y orden de operaciones

**Decisión**: Una sola `db.transaction(() => { ... })` que ejecute, en
este orden:

```sql
1. INSERT INTO customer_payments (customer_id, user_id, amount, note, affects_cash)
   VALUES (?, ?, ?, ?, ?);
2. UPDATE customers SET balance = balance + ? WHERE id = ?;
3. -- Solo si affects_cash = 1:
   INSERT INTO cash_movements (register_id, user_id, type, amount, description)
   VALUES (?, ?, 'income', ?, ?);
```

Si cualquiera de los tres falla (por ejemplo, FK rota o caja cerrada
durante la transacción), la transacción se revierte y nada se persiste.

**Rationale**:
- `db.transaction()` de better-sqlite3 ya está en uso en
  `addCustomerPayment` actual y en `openCashRegister`. Patrón conocido.
- El orden importa: el `INSERT` a `cash_movements` requiere que ya exista
  el `customer_payment` para que la descripción referencie un pago real,
  pero si lo hiciéramos al revés el balance del cliente quedaría
  desfasado si el `cash_movements` falla.

**Alternativas descartadas**:
- **Tres operaciones sin transaction**: rompe la atomicidad — un fallo a
  mitad de camino deja el sistema inconsistente.
- **Crear el `cash_movements` después y notificar al usuario por separado
  si falla**: agrega un modo degradado que no necesitamos.

## R5 — Descripción del `cash_movements`

**Decisión**: La descripción del movimiento generado por el pago será:

```
Pago de deuda — <Nombre del cliente>
```

Si el usuario incluyó una `note` en el formulario, se anexa entre
paréntesis: `Pago de deuda — Guillermo Godoy (Acuerdo del lunes)`.

**Rationale**:
- "Movimientos de Caja" (003) muestra la columna `description` como la
  forma principal de identificar de qué se trató el movimiento. La nota
  del cajero queda visible.
- Incluir el nombre del cliente (no el ID) facilita la conciliación
  manual sin tener que cruzar con otra tabla.

**Alternativas descartadas**:
- **Sólo "Pago de deuda"**: pierde la traza del cliente.
- **JSON estructurado en description**: dificulta la lectura en la página
  de movimientos.
- **Una nueva columna `cash_movements.customer_id`**: cambio invasivo para
  un dato que cabe en la descripción.

## R6 — Permisos: expandir `customers:addPayment` al rol cajero

**Decisión**: Ampliar la entrada en `src/main/auth/matrix.ts` de:

```ts
'customers:addPayment': { kind: 'privileged', roles: ['admin', 'supervisor'] }
```

a:

```ts
'customers:addPayment': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] }
```

Las acciones `customers:updatePayment` y `customers:deletePayment`
quedan **sin cambios** (siguen admin/supervisor). El cajero registra pagos
pero no los edita ni los borra — corregir o anular un pago ya contabilizado
en caja es una operación contable que excede su rol.

**Rationale**:
- El escenario P1 (cliente paga en efectivo en caja) es del cajero. Sin
  esta ampliación la feature no funciona en su flujo principal.
- Decidido explícitamente con el usuario (Q2 del intake).
- Mantener `update`/`delete` restringido evita abrir, en la misma release,
  un vector adicional para revertir movimientos ya contabilizados.

**Alternativas descartadas**:
- **Crear un canal IPC nuevo `customers:addCashPayment`**: duplica
  superficie sin razón (Principio VII).
- **Abrir update/delete también al cajero**: fuera de scope; merece su
  propia decisión.

## R7 — Estado visual del tipo en el Historial de Pagos

**Decisión**: Una columna nueva "Tipo" en la tabla de Historial de Pagos
con un `<Badge>` por fila:

- Verde "Efectivo" para `affects_cash = 1`.
- Ámbar "Descuento de sueldo" para `affects_cash = 0`.

**Rationale**:
- Coherente con el patrón ya usado en otras tablas del POS (`<Badge>` de
  `components/ui` con tonos `success`/`warning`).
- Visualmente discriminante en una pasada de scroll, lo que cumple
  SC-003 (identificación en < 3 s).
- Para los pagos pre-release el badge será "Efectivo" (default `1`), tal
  como se acordó (Opción A).

**Alternativas descartadas**:
- **Un ícono solo**: ambiguo para usuarios nuevos.
- **Una segunda tabla**: complejiza el layout sin sumar.

## R8 — Sin pagos mixtos en la misma operación

**Decisión**: El selector del modal es excluyente (un radio o segmented
control de dos opciones). Si el cliente quiere combinar efectivo y
descuento, registra dos pagos separados. No se permite ingresar dos
montos en una sola operación.

**Rationale**:
- Acordado con el usuario (Q4).
- Mantiene el modelo simple: una fila en `customer_payments` =
  una operación contable, con su tipo definido.

**Alternativas descartadas**:
- **Soportar mixto con dos montos**: agrega complejidad de validación y
  cambia el shape de la IPC, sin caso de uso real declarado.
