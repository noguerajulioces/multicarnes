# Feature Specification: 008 — Tipos de pago en la cobranza de deuda

**Feature Branch**: `008-debt-payment-types`
**Created**: 2026-05-19
**Status**: Draft
**Input**: Necesitamos diferenciar dos formas de "Registrar Pago" sobre la deuda
de un cliente: (1) el cliente pasa por caja y paga en efectivo — debe sumar al
arqueo del día; (2) el cliente (empleado o no) acuerda con el dueño/jefe que
el saldo se descuente de su sueldo o por fuera de caja — no debe sumar al arqueo
del día porque ningún billete entra a la caja.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Cobrar deuda en efectivo y que impacte el cierre de caja (Priority: P1)

El cajero está en el detalle del cliente con saldo en contra, abre el modal
"Registrar Pago", selecciona la opción **Efectivo (afecta caja)**, ingresa el
monto y guarda. El sistema actualiza el saldo del cliente, deja registro en el
"Historial de Pagos" del cliente y **suma ese efectivo a la caja abierta del
cajero**, de modo que se ve reflejado al cerrar caja y en el reporte de
movimientos.

**Why this priority**: es el escenario más frecuente y el que motiva la feature
— hoy los pagos de deuda no aparecen en el arqueo, lo que genera diferencias y
desconfianza en el cierre de caja. Sin esto no hay valor agregado.

**Independent Test**: con una caja abierta, registrar un pago Efectivo de
30.000 Gs sobre un cliente que debe 100.000 Gs. Verificar (a) saldo del cliente
queda en -70.000 Gs, (b) el cierre de caja muestra +30.000 Gs como ingreso, y
(c) en "Movimientos de Caja" aparece la entrada con descripción que refiere al
cliente.

**Acceptance Scenarios**:

1. **Given** un cajero con caja abierta y un cliente con saldo -100.000,
   **When** registra un pago Efectivo de 30.000 con nota opcional,
   **Then** el saldo del cliente queda -70.000, se registra en
   `customer_payments` y aparece un `cash_movements` tipo `income` por 30.000
   en la caja del cajero con referencia al cliente.
2. **Given** un cajero **sin** caja abierta y un cliente con saldo en contra,
   **When** intenta registrar un pago Efectivo,
   **Then** el sistema bloquea el guardado con un mensaje claro
   ("Necesitás una caja abierta para registrar pagos en efectivo") y no se
   crea fila alguna en `customer_payments` ni en `cash_movements`.
3. **Given** un pago Efectivo recién registrado,
   **When** el cajero abre el cierre de caja del día,
   **Then** el monto del pago aparece dentro del total de ingresos esperados.

---

### User Story 2 — Acordar descuento sin movimiento de caja (Priority: P1)

Un cliente empleado debe 60.000 Gs por compras del mes. Acuerda con el jefe que
ese monto se le descuente del sueldo. El admin/supervisor (o el cajero, si así
se autoriza) abre el modal "Registrar Pago", elige **Descuento de sueldo
(no afecta caja)**, ingresa los 60.000 y guarda. El saldo del cliente queda en
cero, queda registro auditable en "Historial de Pagos" del cliente, pero la
caja del día **no cambia** — porque nadie entregó billetes.

**Why this priority**: es el escenario que distingue esta feature del flujo
anterior. Sin este modo, los acuerdos extracaja se cuelan como efectivo y
ensucian el arqueo (sobrante artificial). Ambos modos son co-primarios.

**Independent Test**: con un cliente con saldo -60.000 y una caja abierta,
registrar un pago "Descuento de sueldo" por 60.000. Verificar (a) saldo del
cliente queda en 0, (b) el cierre de caja **no** muestra esos 60.000 como
ingreso, y (c) en el Historial de Pagos del cliente la fila aparece etiquetada
como "Descuento de sueldo".

**Acceptance Scenarios**:

1. **Given** un usuario con permiso para registrar pagos y un cliente con
   saldo -60.000, **When** registra un pago "Descuento de sueldo" por 60.000,
   **Then** el saldo del cliente queda 0, se inserta una fila en
   `customer_payments` marcada como "no afecta caja" y **no** se crea ninguna
   fila en `cash_movements`.
2. **Given** un usuario **sin** caja abierta, **When** registra un pago
   "Descuento de sueldo", **Then** el pago se guarda igual (no requiere caja
   abierta) y la operación es exitosa.
3. **Given** un pago "Descuento de sueldo" registrado, **When** el cajero
   cierra caja, **Then** ese monto **no** aparece en los ingresos esperados.

---

### User Story 3 — Distinguir tipos en el Historial de Pagos (Priority: P2)

Cuando un admin o supervisor revisa el "Historial de Pagos" del cliente,
necesita ver de un vistazo qué pagos entraron por caja y cuáles fueron
descuentos de sueldo, para conciliar contra el cierre del día y contra la
nómina del mes.

**Why this priority**: sin esta visibilidad, ambos modos coexisten pero no se
pueden conciliar manualmente. Crítico para auditoría, pero el sistema funciona
sin ello (de ahí P2).

**Independent Test**: en el Historial de Pagos de un cliente con un mix de
pagos viejos y nuevos, verificar que cada fila muestra un indicador claro del
tipo (badge, columna o ícono) y que los pagos previos a esta release aparecen
como "Efectivo" (default histórico).

**Acceptance Scenarios**:

1. **Given** un cliente con dos pagos nuevos (uno Efectivo, uno Descuento de
   sueldo) y un pago anterior a la release, **When** el usuario abre el
   Historial de Pagos, **Then** ve tres filas con su tipo correspondiente y el
   pago anterior aparece como "Efectivo".

---

### Edge Cases

- **Caja cerrada mientras el modal está abierto**: el usuario abre el modal con
  caja abierta, elige Efectivo, llena el monto; antes de guardar, otro proceso
  cierra la caja. El backend debe volver a validar al momento del INSERT y
  rechazar la operación con el mismo mensaje que en el bloqueo del front.
- **Monto cero o negativo**: el sistema debe rechazar montos ≤ 0 con el mismo
  criterio que hoy aplica `addCustomerPayment` (no se altera ese contrato).
- **Pago mayor al saldo (sobrepago)**: si el cliente paga 100.000 y debía
  60.000, el saldo queda +40.000 (a favor del cliente). Mismo comportamiento
  que hoy; el tipo elegido no cambia esa lógica.
- **Sin saldo pendiente**: si el cliente está en cero o a favor, los modos
  siguen disponibles (puede recibir un anticipo). El tipo elegido se respeta.
- **Eliminar/editar un pago previo**: la operación de delete/edit ya existe y
  revierte el saldo del cliente; si el pago original era Efectivo (afectó
  caja), eliminarlo en una caja distinta a la original requeriría revertir un
  `cash_movements` cruzado. **Fuera de alcance de esta feature**: editar o
  eliminar pagos sigue funcionando como hoy (no toca caja al editar/eliminar).
  Se documenta como gap conocido en el plan.
- **Usuario sin caja propia pero hay caja de otro abierta**: bloquea igual.
  El pago en Efectivo debe entrar a la caja del usuario que está cobrando,
  consistente con cómo el POS imputa las ventas en efectivo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El modal "Registrar Pago" del detalle del cliente DEBE ofrecer
  dos opciones mutuamente excluyentes: "Efectivo (afecta caja)" y "Descuento
  de sueldo (no afecta caja)". Una de las dos siempre está seleccionada
  (default: Efectivo).
- **FR-002**: Ambas opciones DEBEN estar disponibles para todos los clientes
  (no solo los marcados como Empleado). Esto preserva flexibilidad para
  acuerdos no-laborales (condonaciones, ajustes, otros).
- **FR-003**: Los roles autorizados a registrar pagos hoy (Admin, Supervisor,
  Cajero) DEBEN poder elegir cualquiera de los dos tipos; no se introduce una
  restricción nueva por rol.
- **FR-004**: Cuando el tipo es Efectivo, el sistema DEBE exigir que el
  usuario que está registrando el pago tenga una caja abierta a su nombre.
  Si no la tiene, el guardado se bloquea con mensaje explicativo y nada se
  persiste.
- **FR-005**: Cuando el tipo es Efectivo y el guardado procede, el sistema
  DEBE actualizar el saldo del cliente, dejar registro en el Historial de
  Pagos del cliente y sumar el monto como ingreso a la caja abierta del
  usuario, en una sola operación atómica (todo o nada).
- **FR-006**: Cuando el tipo es Descuento de sueldo, el sistema DEBE actualizar
  el saldo del cliente y dejar registro en el Historial de Pagos, **sin**
  generar ningún movimiento de caja. No requiere caja abierta.
- **FR-007**: El Historial de Pagos del cliente DEBE mostrar el tipo de cada
  pago (Efectivo / Descuento de sueldo) con un indicador visual claro
  (badge, etiqueta o columna).
- **FR-008**: Los pagos registrados antes de esta release DEBEN aparecer
  etiquetados como "Efectivo" en el Historial (decisión consciente: se
  asume el modo previo como el más representativo).
- **FR-009**: El reporte de cierre de caja y los movimientos de caja DEBEN
  reflejar automáticamente los pagos Efectivo nuevos, sin pasos manuales
  extra. Los pagos "Descuento de sueldo" NO deben aparecer ahí.
- **FR-010**: El sistema NO DEBE soportar pagos mixtos en una sola operación.
  Si el cliente quiere pagar parte en efectivo y parte por descuento, se
  registran dos pagos separados.
- **FR-011**: La acción debe quedar registrada en `action_logs` con el detalle
  del tipo elegido y el monto, para trazabilidad.

### Key Entities *(include if feature involves data)*

- **Pago de cliente** (`customer_payments`): cobranza de deuda; agrega un
  nuevo atributo "afecta caja" (sí/no) que distingue ambos modos. Conserva
  customer_id, user_id, monto, nota y timestamp.
- **Movimiento de caja** (`cash_movements`): ingreso/egreso ligado a un
  cash_register abierto. Esta feature lo genera automáticamente solo cuando
  el pago es Efectivo, con descripción que referencia al cliente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En un período de prueba de 1 semana, el 100% de los pagos de
  deuda en efectivo registrados aparecen en el cierre de caja correspondiente,
  sin diferencias entre el efectivo esperado y el contado por ese concepto.
- **SC-002**: En el mismo período, ningún pago marcado como "Descuento de
  sueldo" aparece como ingreso en el cierre de caja.
- **SC-003**: Un usuario nuevo, sin entrenamiento previo, puede identificar
  el tipo de un pago en el Historial de Pagos del cliente en menos de
  3 segundos.
- **SC-004**: Las diferencias reportadas en cierre de caja atribuibles a
  pagos de deuda caen a 0 (eran 100% del problema antes de la feature porque
  no se registraban en caja).
- **SC-005**: Registrar un pago de deuda (cualquiera de los dos tipos) toma
  menos de 30 segundos desde abrir el modal hasta ver el saldo actualizado.

## Assumptions

- Se reutiliza la matriz de permisos actual (`src/main/auth/matrix.ts`); no se
  introduce un permiso nuevo específico para el tipo de pago.
- Se reutiliza la IPC actual de pagos de cliente (`customers:addPayment`),
  ampliando su payload para incluir el flag de tipo. No se crean canales IPC
  nuevos.
- La migración v10 es aditiva (ADD COLUMN con default), preservando datos
  existentes. No se hace backfill de `cash_movements` retroactivos para los
  pagos viejos: hacerlo cambiaría cierres de caja históricos, lo que se
  considera peor que la pérdida de detalle.
- La columna del Historial de Pagos del cliente mostrará "Efectivo" para los
  pagos pre-release (default `affects_cash = 1`). Si en el futuro hace falta
  distinguir "histórico desconocido", se hará en otra release.
- Editar o eliminar un pago existente sigue funcionando como hoy (revierte el
  saldo del cliente pero no toca `cash_movements`). La inconsistencia
  resultante en el caso edición/eliminación de pagos Efectivo es un gap
  conocido fuera del alcance de esta release.
- La interfaz queda en español; la documentación de spec/plan/tasks queda en
  español por consistencia con specs previas (007/006), aunque la regla del
  proyecto pide inglés para docs. Esta excepción se mantiene mientras el
  usuario operativo del POS sea hispanohablante.
- Stack y constraints del proyecto (Electron 39, SQLite con migraciones
  numeradas, sin nuevas dependencias) se respetan tal como define la
  constitución.
