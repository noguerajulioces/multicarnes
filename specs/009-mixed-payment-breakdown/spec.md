# Feature Specification: 009 — Visibilidad y desglose de ventas mixtas

**Feature Branch**: `009-mixed-payment-breakdown`
**Created**: 2026-06-18
**Status**: Draft
**Input**: El cliente reporta que cuando una venta se cobra combinando varios
medios de pago, la app la rotula como "mixta" y los reportes/pantallas no le
permiten verificar qué clientes tienen cuentas pendientes (fiado) ni por qué
montos, porque tratan la mixta como una caja negra. El dinero está bien
calculado (el saldo del cliente y el efectivo en caja cuadran); el problema es
de **visibilidad**: el desglose real ya está guardado en `sale_payments` pero
los reportes agregan por la etiqueta `sales.payment_method='mixed'` sin
explotarlo. Análisis previo verificado en
[flows.md](flows.md) (8 subsistemas, 37 escenarios, 16 brechas verificadas).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Reporte por método que refleja la realidad y cuadra con la caja (Priority: P1)

El dueño abre **Reportes › Resumen "Por método de pago"** de un período. Cada
método (Efectivo, Tarjeta, Transferencia, Fiado) muestra el monto **real**
recibido por ese medio, incluyendo las porciones que provienen de ventas
mixtas. Ya no existe una fila "Mixto" que esconda un total opaco: la porción
efectivo de una mixta suma a "Efectivo", la porción fiada suma a "Fiado", y así.
La suma de los métodos cuadra con el total neto del período, y el "Efectivo" del
Resumen coincide con el efectivo que la caja usa para el arqueo.

**Why this priority**: es la causa raíz del reclamo. Hoy "Fiado" y "Efectivo"
están subestimados porque las porciones de las mixtas quedan atrapadas en un
cubo "Mixto", y el Resumen no reconcilia contra la Caja, lo que genera
desconfianza ("la app no cuadra"). Sin esto, el dueño no puede responder
"¿cuánto vendí a crédito / en efectivo hoy?".

**Independent Test**: en un período con una venta en efectivo puro de 100.000,
una venta a crédito puro de 100.000 y una venta mixta de 100.000 (efectivo
50.000 + fiado 30.000 + tarjeta 20.000), verificar que el Resumen muestra
Efectivo = 150.000, Fiado = 130.000, Tarjeta = 20.000, y que la suma
(300.000) coincide con el total neto del período. Verificar que "Efectivo"
coincide con el efectivo esperado por la Caja para ese mismo conjunto.

**Acceptance Scenarios**:

1. **Given** un período con ventas puras y mixtas, **When** el dueño abre el
   Resumen "Por método de pago", **Then** cada porción de cada venta mixta se
   acumula en el bucket de su método real (`sale_payments.method`) y no existe
   un monto agregado bajo la etiqueta "Mixto".
2. **Given** el mismo período, **When** se suman los montos de todos los métodos
   mostrados, **Then** el resultado es igual al total neto de ventas del período
   (diferencia 0 Gs).
3. **Given** un registro de caja con ventas mixtas, **When** el dueño compara el
   "Efectivo" del Resumen contra el efectivo esperado de la Caja para ese
   registro, **Then** ambos montos coinciden al guaraní.
4. **Given** que el dueño quiere contexto, **When** mira el Resumen, **Then**
   puede ver cuántas ventas fueron mixtas como dato informativo, sin que ese
   conteo agregue dinero a ningún bucket (no se cuenta dos veces).

---

### User Story 2 — Verificar qué clientes deben y reconocer la deuda originada en mixtas (Priority: P1)

El dueño abre el reporte de **Fiados Pendientes (Cuentas por Cobrar)** y la
**ficha del cliente**. Puede ver, por cliente y por monto, quién tiene saldo
deudor, y reconocer qué parte de la deuda fue generada por ventas mixtas (no
sólo por crédito puro). En la ficha del cliente, cada venta mixta a fiado
muestra claramente la porción que quedó a deber, igual que una venta a crédito
puro, sin esconderla bajo "Mixto".

**Why this priority**: es la frase literal del reclamo: "no puedo verificar qué
clientes tienen cuentas pendientes y quiénes no, en tema de montos, porque sale
'mixta'". El saldo total por cliente ya es correcto, pero hoy no se puede
distinguir ni rastrear la porción de deuda que vino de mixtas.

**Independent Test**: con un cliente que tiene una venta a crédito puro de
100.000 y una venta mixta con porción fiada de 30.000, verificar que (a) el
reporte de Fiados Pendientes lo lista con su saldo correcto, (b) el reporte
permite reconocer que parte de su deuda proviene de mixtas, y (c) la ficha del
cliente muestra la porción fiada de 30.000 en la venta mixta, etiquetada como
fiado, en el historial de compras.

**Acceptance Scenarios**:

1. **Given** clientes con deuda originada en ventas a crédito puro y en ventas
   mixtas, **When** el dueño abre Fiados Pendientes, **Then** cada cliente
   aparece con su saldo deudor y el reporte permite identificar la deuda
   generada por mixtas además de la de crédito puro.
2. **Given** una venta mixta con porción fiada, **When** el dueño abre la ficha
   del cliente, **Then** esa venta muestra su porción fiada con el monto exacto
   y la etiqueta de fiado, consistente con cómo se muestra una venta a crédito
   puro.
3. **Given** el reporte de Fiados Pendientes exportado, **When** el dueño abre
   el archivo, **Then** puede ver el saldo deudor por cliente y la deuda
   atribuible a mixtas, sin tener que abrir la app.

---

### User Story 3 — Ver y exportar el desglose desde el listado de ventas (Priority: P2)

El dueño abre el **Listado de ventas** y, sin entrar al detalle de cada venta,
ve para cada venta mixta su desglose (al menos la porción fiada). Puede filtrar
las ventas que generaron fiado (incluyendo las mixtas, que hoy quedan fuera del
filtro "Fiado") y exportar a Excel/PDF un archivo que separa las porciones por
método en vez de colapsar todo en "Mixto".

**Why this priority**: el Listado y su exportación son la primera superficie de
revisión y la única vía para conciliar fuera de la app. Hoy colapsan toda mixta
en "Mixto" y el filtro "Fiado" excluye las mixtas, así que no hay forma de
listar/exportar todo lo fiado de un período.

**Independent Test**: en un período con una venta a crédito puro y una mixta con
porción fiada, aplicar el filtro de ventas a fiado y verificar que ambas
aparecen; exportar a Excel y verificar que el archivo distingue la porción
fiada (y demás porciones) de cada mixta, no sólo la etiqueta "Mixto".

**Acceptance Scenarios**:

1. **Given** una venta mixta en el listado, **When** el dueño mira la fila,
   **Then** ve el desglose por método (al menos la porción fiada) sin abrir el
   detalle.
2. **Given** un período con ventas a crédito puro y mixtas con fiado, **When** el
   dueño filtra por ventas que generaron fiado, **Then** ambos tipos aparecen en
   el resultado.
3. **Given** un listado filtrado/visible, **When** el dueño exporta a Excel o
   PDF, **Then** el archivo separa las porciones por método (incluida la fiada)
   en lugar de una sola columna "Mixto".

---

### Edge Cases

- **Venta a fiado sin cliente asignado**: no debe poder existir. El sistema
  impide registrar cualquier porción de crédito (venta a crédito pura o porción
  fiada de una mixta) sin un cliente asociado, de modo que la anomalía se
  previene en origen en vez de tener que mostrarse en los reportes. Si existiera
  una fila histórica anómala (sólo alcanzable hoy por un payload manipulado),
  queda señalada para corrección manual; en la práctica no se esperan casos.
- **Venta mixta anulada**: queda excluida de todos los desgloses y totales,
  consistente con el comportamiento actual de los reportes (`status='cancelled'`).
- **Venta mixta con dos porciones del mismo método** (p. ej. efectivo + efectivo):
  se suman dentro del mismo bucket; no aparecen como métodos distintos.
- **Cliente con saldo a favor que hace una venta mixta con fiado**: la porción
  fiada cuenta como fiado generado en el período; el saldo del cliente refleja
  el efecto neto (consumo del saldo a favor). El reporte de flujo (fiado
  generado) y el de saldo (deuda viva) son números distintos y se presentan como
  tales.
- **Venta mixta con descuento**: las porciones suman el total neto (post
  descuento); los buckets por método reconcilian contra el total neto del período.
- **Porción de tarjeta de una mixta**: ya se concilia correctamente por
  procesador; esta feature no la altera, sólo asegura que también figure en el
  desglose general.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El reporte "Por método de pago" MUST distribuir cada porción de
  una venta mixta al bucket de su método real (efectivo, tarjeta, transferencia,
  fiado), de modo que ninguna venta mixta aporte un monto agregado bajo una
  etiqueta "Mixto".
- **FR-002**: El bucket "Fiado/Crédito" del reporte por método MUST incluir
  tanto las ventas a crédito puro como la porción de crédito de las ventas
  mixtas.
- **FR-003**: El bucket "Efectivo" del reporte por método MUST incluir tanto las
  ventas en efectivo puro como la porción en efectivo de las ventas mixtas, de
  forma consistente con el cálculo de efectivo de la Caja.
- **FR-004**: La suma de todos los buckets por método MUST ser igual al total
  neto de ventas del período (sin doble conteo y sin omisiones).
- **FR-005**: El reporte por método MAY mostrar, como dato informativo, cuántas
  ventas fueron mixtas, sin que ese conteo agregue dinero a ningún bucket.
- **FR-006**: El reporte de Fiados Pendientes (Cuentas por Cobrar) MUST permitir
  al dueño ver, por cliente, su saldo deudor e identificar la deuda originada en
  ventas mixtas, además de la de crédito puro.
- **FR-007**: La ficha del cliente MUST mostrar, para cada venta mixta con
  porción fiada, el monto exacto de esa porción etiquetado como fiado, de manera
  consistente con cómo se presenta una venta a crédito puro.
- **FR-008**: El listado de ventas MUST mostrar, para cada venta mixta, su
  desglose por método (al menos la porción fiada) sin requerir abrir el detalle
  de la venta.
- **FR-009**: El usuario MUST poder filtrar/listar todas las ventas que generaron
  fiado en un período, incluyendo las ventas mixtas (hoy excluidas al filtrar por
  "crédito").
- **FR-010**: La exportación de ventas (Excel/PDF) MUST representar las porciones
  por método (incluida la fiada) en lugar de una única etiqueta "Mixto".
- **FR-011**: El sistema MUST tratar estos desgloses como lectura sobre el
  desglose ya almacenado, sin recalcular ni alterar los montos de las ventas; las
  ventas mixtas históricas MUST reflejarse automáticamente sin migración ni
  backfill.
- **FR-012**: Todos los desgloses y totales MUST excluir las ventas anuladas,
  consistente con los reportes actuales.
- **FR-013**: El sistema MUST garantizar que ninguna porción a fiado (crédito)
  se registre sin un cliente asociado: cualquier venta con porción de crédito
  —pura o mixta— exige cliente, validado del lado del servidor. En consecuencia,
  no existe "fiado sin cliente" que reportar ni reconciliar.
- **FR-014**: El reporte por método MUST reconciliar contra la Caja: el efectivo
  mostrado en el Resumen para un conjunto de ventas MUST coincidir con el
  efectivo que la Caja considera para el arqueo de ese mismo conjunto.

### Key Entities *(include if feature involves data)*

- **Venta**: una transacción con una etiqueta de método (`payment_method`) y un
  `total`. Cuando es mixta, su método real vive desagregado en porciones; cuando
  es de método único, su monto se atribuye íntegramente a ese método.
- **Porción de pago (`sale_payments`)**: el componente de una venta mixta, con
  método (efectivo/tarjeta/transferencia/crédito), monto y, para tarjeta,
  procesador/comprobante. Es la fuente del desglose. Sólo existe para ventas
  mixtas.
- **Cliente**: su `balance` (negativo = deuda) es la fuente de verdad del saldo
  deudor; ya refleja correctamente la porción de crédito de las mixtas.
- **Resumen de Caja**: la conciliación de efectivo que ya distribuye la porción
  en efectivo de las mixtas; sirve de referencia de reconciliación para FR-014.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Para cualquier período, la suma de Efectivo + Tarjeta +
  Transferencia + Fiado del Resumen es igual al total neto del período
  (diferencia exacta de 0 Gs).
- **SC-002**: El monto "Efectivo" del Resumen coincide al guaraní con el efectivo
  que la Caja usa para el arqueo del mismo conjunto de ventas (diferencia 0 Gs).
- **SC-003**: El monto "Fiado" del Resumen incluye la porción de crédito de las
  mixtas; para cualquier período con al menos una mixta a fiado, "Fiado" es mayor
  que el valor que se mostraba antes (ya no subestimado).
- **SC-004**: El dueño puede determinar, para el 100% de los clientes con deuda,
  el monto adeudado e identificar la deuda originada en mixtas, sin abrir ventas
  individuales.
- **SC-005**: El dueño puede producir un archivo exportado con todas las ventas
  que generaron fiado en un período (incluidas las mixtas) — operación hoy
  imposible.
- **SC-006**: Ninguna venta mixta aparece como un monto "Mixto" opaco en ninguna
  superficie de conciliación de dinero; el desglose está siempre disponible.
- **SC-007**: El despliegue no requiere migración de datos: el 100% de las ventas
  mixtas históricas reflejan su desglose desde el momento del release.
- **SC-008**: El dueño puede responder "¿cuánto vendí a crédito hoy?" desde una
  sola pantalla, sin sumar a mano ni abrir ventas individuales.
- **SC-009**: No existe ninguna porción a fiado sin cliente asociado: el sistema
  rechaza el 100% de los intentos de registrar crédito (puro o mixto) sin
  cliente, y toda la deuda fiada reconcilia con un cliente.

## Assumptions

- El desglose de las ventas mixtas ya existe íntegro en `sale_payments`; las
  ventas de método único se derivan de su `payment_method` + `total`. No se
  requiere migración ni backfill para la parte de visibilidad.
- En el reporte por método (un reporte de **flujo** del período), "Fiado"
  significa el crédito **generado** en ese período, no el saldo pendiente actual.
  El saldo pendiente (un **stock**) sigue siendo el `balance` por cliente.
- El **saldo deudor actual no se puede dividir por origen** (mixta vs crédito
  puro) una vez que el cliente hizo pagos, porque los pagos de deuda no están
  ligados a una venta puntual. Esta feature ofrece visibilidad del origen a
  nivel de **flujo/generación** (fiado generado por mixtas en un período) y a
  nivel de **porción por venta** en la ficha, no una división por origen del
  saldo vivo agregado.
- **Dentro de alcance** (decisión del 2026-06-18): garantizar que no exista
  fiado sin cliente (FR-013). Es la única parte del "fiado fantasma" que entra a
  esta feature, vía un guard de servidor que exige cliente cuando hay porción de
  crédito (pura o mixta). El resto del endurecimiento de integridad sigue fuera.
- Fuera de alcance (features separadas, documentadas en
  [flows.md](flows.md)): (1) imputación pago↔venta (agregar `sale_id` a
  `customer_payments` para rastrear qué venta puntual sigue impaga); (2)
  correcciones de anulación de mixtas (devolución de crédito ya pagado,
  efectivo fantasma al anular tras cerrar caja); (3) persistir el desglose por
  método en el cierre de caja.
- La porción de tarjeta de las mixtas ya se concilia correctamente por
  procesador; esta feature no cambia ese comportamiento.
- Las ventas anuladas se excluyen de todos los desgloses, consistente con los
  reportes actuales.
- Los rangos de fechas y zona horaria reutilizan el manejo actual de períodos de
  los reportes existentes.
