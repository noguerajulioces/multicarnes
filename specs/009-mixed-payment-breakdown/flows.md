# Análisis de flujos — Ventas mixtas y visibilidad de deuda

## Resumen ejecutivo

Cuando el cajero cobra una venta combinando varios medios (por ejemplo Gs. 50.000 en efectivo + Gs. 30.000 fiado), el sistema guarda el detalle correcto del desglose en la tabla `sale_payments` y descuenta bien la deuda del cliente. El problema no es de plata mal calculada: el monto de deuda que se genera es exacto y el efectivo en caja cuadra. El problema es de **visibilidad**: la venta queda rotulada con la etiqueta monolítica `payment_method='mixed'`, y casi todas las pantallas que el dueño usa para verificar (Reportes por método, Listado de ventas, Dashboard, exportaciones a Excel) leen sólo esa etiqueta y tratan la mixta como una "caja negra" sin distribuir cuánto fue efectivo, cuánto tarjeta y, sobre todo, **cuánto quedó fiado**. El reporte de Fiados Pendientes muestra el saldo total correcto por cliente, pero no permite separar qué parte de esa deuda nació de ventas mixtas. El resultado para el dueño: puede saber *quién* le debe y *cuánto en total*, pero no puede verificar por monto qué parte de la deuda vino de ventas mixtas, ni conciliar el reporte por método de pago contra la operación real.

> **Causa raíz (una frase):** la venta mixta se persiste con una etiqueta monolítica `sales.payment_method='mixed'` y su desglose real vive aparte en `sale_payments`, pero los reportes y listados agregan por esa etiqueta sin explotar `sale_payments`, así que la porción fiada (y las demás porciones) quedan invisibles fuera del detalle individual de la venta.

## Modelo de datos actual

Una venta mixta se guarda hoy como **dos representaciones desacopladas**:

1. Una fila en `sales` con la etiqueta única `payment_method='mixed'`, su `total` completo, y los campos `payment_processor` / `payment_reference` forzados a `NULL`.
2. N filas en `sale_payments`, una por cada porción de pago, que son el **único lugar** donde vive el desglose real (cuánto fue efectivo / tarjeta / transferencia / crédito).

La deuda se aplica restando de `customers.balance` la suma de las porciones con `method='credit'`. `customers.balance` es un único escalar acumulado: la fuente de verdad de la deuda, pero sin ninguna marca de origen.

```
                         sales (1 fila)
        ┌───────────────────────────────────────────────┐
        │ id                                             │
        │ total           = 80.000  (monto completo)     │
        │ payment_method  = 'mixed'  ◄── etiqueta opaca  │
        │ payment_processor = NULL                       │
        │ payment_reference = NULL                       │
        │ customer_id     = 42                           │
        └───────────────────────┬───────────────────────┘
                                 │ 1:N
                 ┌───────────────┴───────────────┐
                 ▼                                ▼
        sale_payments (N filas)  ◄── ÚNICO lugar del desglose
        ┌──────────────────────┐  ┌──────────────────────┐
        │ method = 'cash'      │  │ method = 'credit'    │
        │ amount = 50.000      │  │ amount = 30.000      │
        │ processor / reference│  │ processor = NULL     │
        └──────────────────────┘  └──────────┬───────────┘
                                              │ suma porciones credit
                                              ▼
                              customers.balance -= 30.000
                              ┌──────────────────────────┐
                              │ balance = escalar único  │
                              │ (sin origen mixta/credit)│
                              └──────────────────────────┘
```

| Concepto | Dónde se guarda | ¿Conserva el desglose? |
|---|---|---|
| Etiqueta del método | `sales.payment_method` (`schema.ts:90-104`) | No — colapsa todo en `'mixed'` |
| Monto por porción (cash/card/transfer/credit) | `sale_payments(method, amount, processor, reference)` (`schema.ts:119-126`) | Sí — pero sólo para mixtas (las ventas no-mixtas no escriben filas) |
| Procesador/comprobante de tarjeta de una mixta | `sale_payments.processor/reference` | Sí, pero NO en `sales.payment_processor` (queda NULL) |
| Deuda generada | `customers.balance` (escalar, `schema.ts:47`) | No — agregado sin origen |
| Pago de deuda | `customer_payments` (`schema.ts:158-168`) | No tiene `sale_id`: la deuda es un pool fungible, el pago no imputa a ninguna venta |

Nota importante de heterogeneidad: `sale_payments` se escribe **sólo** para ventas mixtas (`src/main/db/queries/sales.ts:182`). Una venta `'credit'` pura NO genera fila `sale_payments`; su deuda vive sólo en `sales.total` + el decremento de balance. Por eso reconstruir "cuánto fiado por método" obliga a combinar dos fuentes distintas.

## Flujo de una venta mixta (alta)

1. **Carrito** — El cajero arma items + descuento en `VentasPage`; el total = `max(0, subtotal - discount)` (`src/renderer/src/store/cart.store.ts:83-86`). El carrito no tiene concepto de pago.
2. **Apertura del cobro** — Abre `CobroModal` (`src/renderer/src/modules/ventas/VentasPage.tsx:892`) y elige "Mixto" (`src/renderer/src/modules/ventas/CobroModal.tsx:38`). Arranca con dos líneas pre-cargadas: efectivo + tarjeta (`CobroModal.tsx:83-86`).
3. **Edición de líneas** — Cada línea tiene `method ∈ {cash,card,transfer,credit}`, `amount`, `processor`, `reference` (`CobroModal.tsx:43-49`). Indicador en vivo "Restante / Suma correcta / Excede" comparando `mixedTotal` vs `total` (`CobroModal.tsx:102-103, 443-463`).
4. **Validación en la UI** — `canConfirm` exige: ≥2 líneas activas, suma exacta `mixedTotal===total`, card requiere processor+reference, transfer requiere reference, y si hay porción crédito (>0) exige cliente seleccionado (`CobroModal.tsx:127-149`). Pre-chequea el límite de fiado sobre la suma de líneas credit (`CobroModal.tsx:110-115`).
5. **Armado del payload** — `handleConfirm` arma `payments[]` fiel a partir de las líneas activas, preservando method/amount/processor/reference por porción (`CobroModal.tsx:178-185`), y envía `paymentMethod='mixed'`, `paymentProcessor=null`, `paymentReference=null`, `payments=[...]` (`CobroModal.tsx:194-206`).
6. **IPC** — `sales:create` pasa el payload tal cual, sin transformarlo (`src/main/ipc/sales.ipc.ts:9-11`).
7. **Persistencia (transacción)** — `createSale` abre una única `db.transaction()` (`src/main/db/queries/sales.ts:54`):
   - Verifica caja abierta (`sales.ts:59-64`).
   - Revalida montos y, sólo para mixed, `sum(payments.amount)===total` (`sales.ts:70-82`).
   - Calcula la porción crédito = suma de payments con `method='credit'` y valida el límite de fiado **sólo si hay `customerId`** (`sales.ts:98-129`).
   - INSERT en `sales` con `payment_method='mixed'`, processor/reference NULL (`sales.ts:132-153`).
   - Inserta sale_items y ajusta stock (`sales.ts:156-180`).
   - Inserta una fila `sale_payments` por porción (`sales.ts:182-192`) — **único lugar del desglose**.
   - Aplica deuda: si hay `customerId`, `customers.balance -= creditAmount` (`sales.ts:200-210`).
8. **Comprobante** — Devuelve `getSaleById` (que re-hidrata `sale.payments`, `sales.ts:217-245`) y muestra `TicketPreviewModal` (`CobroModal.tsx:216-224`).

## Dónde se pierde el desglose

Ordenado por severidad. Sólo se listan brechas confirmadas o parciales por la verificación adversarial.

### Críticas

- **[critical] Reporte "Por método de pago" agrupa por la etiqueta monolítica** — `src/main/db/queries/reports.ts:169-182`. `byMethod` hace `GROUP BY payment_method` y suma `sales.total` entero al bucket `'mixed'`. La porción fiada nunca llega al bucket "Fiado", la porción efectivo nunca llega a "Efectivo". **Impacto:** el dueño no puede ver cuánto vendió realmente a crédito ni en efectivo; el "Mixto" es un cubo fantasma cuyo monto no corresponde a ningún método real. *(Matiz: la porción tarjeta sí se rescata vía `byCardProcessor`, ver abajo; el colapso es de credit/cash/transfer.)*

- **[critical] El render del Resumen pinta "Mixto" como fila opaca** — `src/renderer/src/modules/reportes/ReportesPage.tsx:678-717`. La única rama que agrega sub-filas de desglose es `method==='card'` (línea 696, vía `byCardProcessor`). La fila "Mixto" se pinta con un total entero, sin sub-filas que muestren cash/credit/card/transfer. **Impacto:** visualmente la mixta es una caja negra; no hay UI que rescate `sale_payments` para la mixta fuera de tarjeta.

- **[critical] El Listado de ventas y su exportación no cargan el desglose** — `src/main/db/queries/sales.ts:291-301` (`getAllSales`) + `src/renderer/src/modules/ventas-listado/VentasListadoPage.tsx:119-136, 37-44`. `getAllSales` hace `SELECT s.*` sin JOIN a `sale_payments` ni a `customers.balance`; las filas llegan con `payments=undefined`. `prepareExport` produce una sola columna `_method='Mixto'`, sin columnas de monto por método ni de fiado. **Impacto:** la grilla principal de ventas (primera superficie que el dueño revisa) y el Excel/PDF exportado colapsan toda mixta en "Mixto"; imposible filtrar o sumar la porción fiada por venta fuera de la app.

- **[critical] "Fiado fantasma": el servidor no exige cliente cuando hay porción crédito** — `src/main/db/queries/sales.ts:98, 200` + `CobroModal.tsx:197`. La UI bloquea (`canConfirm`, `CobroModal.tsx:145`), pero el servidor sólo valida suma==total; el límite de fiado y el débito de balance están gateados por `if (data.customerId)`. Con `customerId=null` se inserta la fila `sale_payments.method='credit'` pero NO se toca ningún `customers.balance`. **Impacto:** vía payload manipulado o regresión futura de la UI, queda fiado registrado en la venta que no aparece como deuda de nadie → descuadre silencioso entre fiado total y suma de saldos. *(Confirmado como hueco de defensa-en-profundidad, no explotable por el flujo normal de la UI.)*

- **[critical] Anular mixta con crédito parcialmente pagado regala dinero** — `src/main/db/queries/sales.ts:387-392`. "Devolver crédito" suma SIEMPRE la porción crédito ORIGINAL completa al balance, sin restar lo ya pagado, porque `customer_payments` no tiene `sale_id`. **Impacto:** si el cliente fió Gs. 50.000 y ya pagó Gs. 30.000, al anular y devolver el balance sube Gs. 50.000 completos → el cliente queda Gs. 30.000 "a favor" por una deuda que en parte ya saldó.

### Altas

- **[high] La fila `sales` no materializa el desglose ni la porción crédito** — `src/main/db/schema.ts:90-104` + `src/main/db/queries/sales.ts:132-153`. No existe ninguna columna `cash_amount/card_amount/credit_amount`; sólo `payment_method/payment_processor/payment_reference` (los dos últimos NULL en mixed). **Impacto:** cualquier consulta que lea sólo `sales` ve "mixed" como cubo opaco; hay que hacer JOIN a `sale_payments` para saber cuánto fue fiado. Es la causa raíz a nivel de modelado. *(El dato no se pierde del sistema: vive en `sale_payments`; por eso high y no critical.)*

- **[high] `sale_payments` sólo existe para mixtas → desglose heterogéneo** — `src/main/db/queries/sales.ts:182-192` vs una venta credit pura que no escribe filas (`sales.ts:194-198`). **Impacto:** reconstruir "cuánto fiado por método" obliga a combinar dos fuentes (`sales.payment_method='credit'` + `sale_payments.method='credit'`). *(Matiz verificado: el panel de cierre de caja `cash.ts:332-353` SÍ hace esa unión para credit/transfer/card; no es cierto que "nada en el sistema lo haga". Pero el reporte de deuda por cliente no lo hace.)*

- **[high] El balance no conserva el origen de la deuda** — `src/main/db/queries/sales.ts:200-210`. El UPDATE de la porción crédito de la mixta es idéntico al de un crédito puro sobre la misma columna escalar. **Impacto:** desde el saldo no se puede reconstruir cuánta deuda nació de mixtas vs crédito puro. *(Matiz: a nivel drill-down de la ficha sí hay atribución por venta; lo que falta es la descomposición del saldo agregado y del reporte CxC.)*

- **[high] `pendingCredits` (Cuentas por Cobrar) no desagrega por origen** — `src/main/db/queries/reports.ts:111-135`. Proyecta sólo `c.balance` + dos timestamps; no consulta `sale_payments`. `last_credit_sale_at` colapsa credit+mixed en un solo `MAX(created_at)` sin montos. **Impacto:** el reporte que el dueño usa para "quién debe y cuánto" no permite responder "cuánto de esta deuda viene de mixtas". El patrón SQL para desagregar ya existe (`byCardProcessor`), así que es omisión, no limitación técnica.

- **[high] La tabla CxC y su Excel no tienen columna de desglose** — `src/renderer/src/modules/reportes/ReportesPage.tsx:847-897` (tabla) y `134-139, 207-215` (export). Sólo 6 columnas: Cliente, Teléfono, Tipo, Saldo deudor, Última venta a crédito, Último pago. **Impacto:** ni en pantalla ni en el Excel se puede separar deuda de mixtas vs crédito puro.

- **[high] La línea "Fiado" de la ficha sobre-representa la deuda viva** — `src/renderer/src/modules/clientes/ClienteFichaPage.tsx:342-348` vía `getCustomerSales` (`customers.ts:381-404`). `creditDue` refleja la porción fiada ORIGINAL (snapshot de `sale_payments`), no la pendiente; los pagos posteriores no la reducen porque no hay vínculo pago↔venta. **Impacto:** el dueño no puede saber qué venta mixta sigue impaga ni cuánto resta de cada una.

- **[high] Los pagos de deuda no se imputan a ninguna venta** — `src/main/db/queries/customers.ts:133-186` (`addCustomerPayment`) y `198-260` (`voidCustomerPayment`). El pago hace `balance += amount` sin `sale_id`. **Impacto:** la deuda es un pool fungible; una vez hay pagos es imposible reconstruir la deuda viva atribuible a mixtas.

- **[high] El cierre de caja no persiste el desglose de fiado del turno** — `src/main/db/queries/cash.ts:74-192`. Persiste opening/closing/expected/difference y una fila sintética "closing"; `otherMethodsTotals`/`cardByProcessor` sólo existen en memoria. **Impacto:** tras cerrar la caja, el fiado generado en el turno (incluida la porción credit de mixtas) no queda registrado; sólo se reconstruye recomputando desde `sales`/`sale_payments`.

- **[high] La porción fiado del cierre se muestra global, sin cliente** — `src/renderer/src/modules/caja/CierreCajaPage.tsx:310-318` + `cash.ts:332-353`. El UNION ALL mete en el bucket "credit" tanto credit puro como porción credit de mixtas, agrupado por método (sin `customer_id`). **Impacto:** desde el cierre el operador ve "Fiado: Gs X (N)" global pero no qué cliente quedó debiendo ni distingue mixta vs crédito puro. *(Exactamente el reclamo del cliente desde la conciliación de caja.)*

- **[high] El historial filtrado por "Fiado" excluye las mixtas con crédito** — `src/main/db/queries/reports.ts:3-26` (`salesByPeriod` filtra por `s.payment_method = ?`). Filtrar por `'credit'` excluye las mixtas; filtrar por `'mixed'` las incluye pero sin desglose. **Impacto:** no existe forma de listar todas las ventas que generaron fiado.

- **[high] "Efectivo" del Resumen no cuadra contra Caja** — `src/renderer/src/modules/reportes/ReportesPage.tsx:113-127, 609-615`. El KPI "Total" es correcto, pero la tabla byMethod no reconcilia: "Efectivo" del Resumen es menor que el efectivo real (le falta la porción cash de las mixtas, que la caja SÍ cuenta). **Impacto:** discrepancia visible entre Reportes y Caja → el dueño percibe que "la app no cuadra".

- **[high] La porción efectivo de una mixta anulada no genera egreso de caja** — `src/main/db/queries/sales.ts:374-397`. La anulación sólo procesa la porción crédito; el efectivo "se corrige" implícitamente por el filtro `status='completed'`, que sólo funciona si la caja sigue abierta. **Impacto:** si la mixta se anula después de cerrar la caja, el `expected_amount` ya quedó congelado y la porción efectivo queda "fantasma" sobrevaluando el cierre histórico, sin rastro de egreso. `cancelSale` tampoco exige caja abierta.

- **[high] "No devolver" deja deuda viva sin venta vigente** — `src/main/db/queries/sales.ts:393-395`. La deuda persiste en `customers.balance` aunque la venta quede "cancelled"; el único rastro del motivo es texto libre en `action_logs.details`. **Impacto:** se rompe la conciliación entre suma de porciones credit vigentes y el balance; verificar el origen requiere parsear strings de log.

- **[high] El estado "Fiado · Pagado" está muerto en el Listado/export** — `src/renderer/src/modules/ventas-listado/VentasListadoPage.tsx:121-122, 130-134`. `creditPaid` depende de `s.customer_balance`, que `getAllSales` nunca trae (siempre `undefined`); además sólo contempla `payment_method==='credit'`, nunca `'mixed'`. **Impacto:** el archivo exportado no distingue deuda pendiente de pagada, y las mixtas ni siquiera entran a esa rama.

### Medias

- **[medium] Procesador/comprobante de tarjeta de la mixta no está en la fila `sales`** — `src/main/db/queries/sales.ts:132-153`. `payment_processor`/`payment_reference` quedan NULL; el dato vive sólo en `sale_payments`. **Impacto:** reportes de conciliación por procesador que filtren sobre `sales.payment_processor` pierden la porción tarjeta de las mixtas.

- **[medium] El servidor no valida unicidad de método ni ≥2 líneas** — `src/main/db/queries/sales.ts:77-82`. La única validación de consistencia es `sum==total`. **Impacto:** una mixta con una sola línea o con dos líneas del mismo método pasa la validación de servidor (sólo la UI lo gestiona); refuerza el "fiado fantasma" y el desglose fragmentado.

- **[medium] `getAllSales/getRecentSales` no adjuntan `sale_payments`** — `src/main/db/queries/sales.ts:247-334`. Sólo `getSaleById` (`217-245`) trae el desglose. **Impacto:** el historial y cualquier listado muestran "mixed" sin división; hay que pedir el detalle venta por venta.

- **[medium] `salesByMethod` del summary de caja es código muerto** — `src/main/db/queries/cash.ts:294-302, 359`. Devuelve "mixed" como bucket monolítico pero ningún renderer lo consume. **Impacto:** no rompe el arqueo (el efectivo se calcula bien aparte) pero es una trampa para el próximo desarrollador.

- **[medium] El modal de anulación funde efectivo + tarjeta + transferencia** — `src/renderer/src/modules/ventas-listado/VentaDetallePage.tsx:118-127` + `MixedCancellationModal.tsx:38` ("Pagado en efectivo / otros"). **Impacto:** quien anula decide a ciegas; no distingue qué fue efectivo (afecta caja) vs tarjeta/transferencia (requieren reversa externa).

- **[medium] El reporte Resumen no es exportable** — `src/renderer/src/modules/reportes/ReportesPage.tsx:129-203, 439-463`. `reportConfigs` no tiene entrada "resumen"; `handleExportExcel/PDF` retornan sin exportar. **Impacto:** no hay forma de obtener un archivo con el fiado real del período desde el Resumen.

- **[medium] El reporte CxC exportable arrastra el saldo agregado sin origen** — `src/renderer/src/modules/reportes/ReportesPage.tsx:130-141, 207-215`. Exporta `Math.abs(balance)` por cliente. **Impacto:** se puede ver quién debe y cuánto total, pero no reconciliar contra las mixtas que lo generaron.

- **[medium] El ticket no resalta la deuda resultante** — `src/renderer/src/lib/ticket.ts:198-212`. Lista "Fiado <monto>" como una línea más, sin "Saldo pendiente / Queda debiendo" ni el nuevo balance. **Impacto:** el cliente que recibe el comprobante no ve resaltado cuánto quedó a deber.

- **[medium] Anular un pago de deuda revive la deuda sin atribuirla a la mixta** — `customers.ts:198-260`. **Impacto:** el balance revive correcto, pero la deuda revivida sigue sin imputarse a la venta mixta original.

### Bajas

- **[low] Dos líneas del mismo método se persisten como filas separadas** — `CobroModal.tsx:127-135` + servidor sin validación de unicidad. No se pierde dinero; el desglose por método puede quedar fragmentado y un agregador aguas abajo debe SUMAR por método.
- **[low] Doble cálculo de `creditAmount`** — `src/main/db/queries/sales.ts:99-106` vs `200-203`. Hoy idénticos; deuda técnica que podría divergir.
- **[low] El header del Detalle dice "Mixto"** — `VentaDetallePage.tsx:223-236`, pero el desglose sí aparece en la tarjeta "Pagos" debajo. Es la excepción correcta, no un defecto.

### Descartadas / acotadas tras verificación adversarial

- **No es cierto que "nada en el sistema reconstruye el crédito por método uniendo dos fuentes":** `cash.ts:332-353` (panel "Otros medios" del cierre) y `byCardProcessor` (`reports.ts:187-209`) ya hacen ese UNION ALL. El gap es que no se aplica al reporte de deuda por cliente.
- **No es cierto que en la ficha del cliente "no se vea de dónde salió la deuda":** la tabla "Historial de Compras" sí muestra "Fiado {monto}" por venta mixta (`ClienteFichaPage.tsx:342-372`). Lo que falta es el agregado dentro del card de Saldo y la distinción de credit puro.
- **La porción tarjeta de las mixtas SÍ se concilia bien:** `byCardProcessor`/`cardSales` la distribuyen correctamente (única dimensión bien resuelta). El residuo es que `sales.payment_processor=NULL`.

## Matriz exhaustiva de escenarios

| ID | Escenario | Composición | ¿Deuda bien atribuida? | Brecha | Severidad |
|---|---|---|---|---|---|
| PAY-01 | Efectivo + Crédito con cliente (la mixta canónica) | efectivo 50.000 + crédito 30.000 = 80.000 | Monto OK, origen invisible | Los 30.000 fiados no se distribuyen al bucket "Fiado" del Resumen; no aparece en Listado/Dashboard/Export por método; en CxC/ficha no se distingue del crédito puro | high |
| PAY-02 | Tarjeta + Crédito con cliente | tarjeta 60.000 (Bancard, comp.1234) + crédito 40.000 = 100.000 | Monto OK | La tarjeta SÍ se concilia (byCardProcessor); el crédito (40.000) sufre la misma invisibilidad que PAY-01 | high |
| PAY-03 | Transferencia + Crédito con cliente | transf. 70.000 (TX-99) + crédito 30.000 = 100.000 | Monto OK | Doble invisibilidad: ni la transferencia (no hay byTransfer) ni el crédito se distribuyen en el Resumen | high |
| PAY-04 | Efectivo + Tarjeta + Crédito (3 métodos) | efvo 40.000 + tarjeta 40.000 (Dinelco, 555) + crédito 20.000 = 100.000 | Monto OK | Atribución del fiado (20.000) enterrada en "Mixto"; divergencia máxima Reportes vs Caja en "Efectivo" | high |
| PAY-05 | Efectivo + Tarjeta (sin crédito) | efvo 50.000 + tarjeta 50.000 (Bancard, 222) | Sin deuda (correcto) | Sólo visibilidad de composición ("Mixto" sin distribuir cash/card); no afecta deuda | medium |
| PAY-06 | Efectivo + Transferencia (sin crédito) | efvo 30.000 + transf. 70.000 (TX-12) | Sin deuda (correcto) | Composición invisible en Resumen/Listado/Export; sin impacto en deuda | low |
| PAY-07 | Tarjeta + Transferencia (sin efectivo ni crédito) | tarjeta 60.000 (Upay, U-1) + transf. 40.000 (TX-7) = 100.000 | Sin deuda (correcto) | Tarjeta OK; transferencia sin reporte de desglose; sin impacto en deuda | low |
| PAY-08 | Efectivo + Crédito SIN cliente (bloqueado en UI) | efvo 50.000 + crédito 30.000, cliente=null | N/A (bloqueado) | Ninguna — `canConfirm` lo impide | ninguna |
| PAY-09 | Efectivo + Crédito SIN cliente (payload manipulado) | efvo 50.000 + crédito 30.000, customerId=null | NO — fiado fantasma | El servidor no exige customerId; inserta `sale_payments.credit` sin tocar ningún balance | critical |
| PAY-10 | Mixta de dos líneas del MISMO método | efvo 30.000 + efvo 50.000 = 80.000, sin crédito | Sin deuda (correcto) | Desglose fragmentado en varias filas del mismo método; no afecta deuda | low |
| PAY-11 | Porción crédito que supera el límite de fiado | efvo 20.000 + crédito 80.000; debe 50.000, límite 100.000 | El límite se respeta (rollback) | Ninguna — cálculo UI/server consistente | ninguna |
| PAY-12 | Crédito puro vs porción crédito de mixta (asimetría) | crédito 100.000 (puro) contrastado con porciones credit de mixtas | Balance total OK, origen irreconstruible | Desglose heterogéneo: sale_payments sólo para mixtas; el bucket "Fiado" subestima el fiado real | critical |
| PAY-13 | Mixta con crédito parcialmente pagado, luego anulada con "Devolver crédito" | efvo 50.000 + crédito 50.000; ya pagó 30.000 | NO | Suma la porción credit original completa sin descontar pagos; efectivo no se reembolsa con cash_movements | critical |
| LIFE-01 | Anular mixta con caja ABIERTA + reembolsar crédito (no había pagado) | efvo 50.000 + tarjeta 30.000 + fiado 20.000 = 100.000 | Crédito OK | Efectivo (50.000) y tarjeta (30.000) no generan egreso en Movimientos de Caja; modal funde efectivo+tarjeta | medium |
| LIFE-02 | Anular mixta con caja YA CERRADA | efvo 60.000 + transf. 20.000 + fiado 40.000 = 120.000 | Crédito OK | Efectivo "fantasma" en el cierre histórico: sobrevalúa la caja cerrada en 60.000 sin rastro de egreso | high |
| LIFE-03 | Mixta con crédito, paga parte, luego anula con "Devolver crédito" | efvo 50.000 + fiado 50.000; pagó 30.000 | NO — dinero regalado | Devuelve los 50.000 originales completos (sin sale_id en customer_payments); cliente queda 30.000 a favor | critical |
| LIFE-04 | Anular mixta con crédito eligiendo "No devolver" | tarjeta 60.000 + fiado 40.000 = 100.000 | Deuda viva sin venta vigente | Se rompe la conciliación porciones-credit-vigentes vs balance; motivo sólo en texto libre de log | high |
| LIFE-05 | Mixta con crédito justo en el límite | efvo 30.000 + fiado 20.000 = 50.000 | OK (comparación estricta `>`) | Sólo visibilidad residual; sin pérdida de consistencia | ninguna |
| LIFE-06 | Mixta que excede el límite por 1 Gs | efvo 30.000 + fiado 20.001 = 50.001 | OK — rollback atómico | Ninguna; doble cálculo de creditAmount hoy idéntico (deuda técnica) | ninguna |
| LIFE-07 | Cliente con saldo A FAVOR hace mixta con crédito | efvo 40.000 + fiado 50.000 = 90.000; tenía +30.000 | Balance neto OK (-20.000) | El ticket/ficha muestran 50.000 (bruto), no el efecto neto (-20.000); no se ve que se consumió el saldo a favor | low |
| LIFE-08 | Mixta con crédito SIN cliente (gate salteado) | efvo 50.000 + fiado 30.000, customerId=null | NO — fiado fantasma | Igual que PAY-09: server no exige cliente; descuadre fiado vs balances | critical |
| LIFE-09 | Anular un pago de deuda que había saldado parte de una mixta | venta tarjeta 50.000 + fiado 50.000; pago posterior 50.000 | Balance OK | Deuda revivida no se imputa a la mixta concreta (sin sale_id) | medium |
| LIFE-10 | Cliente con mixta + crédito puro, paga parte | mixta efvo 60.000 + fiado 40.000; credit puro 60.000; pago 50.000 | Balance total OK, no atribuible | Imposible saber qué parte de los 50.000 vivos viene de mixta vs crédito puro; línea "Fiado" no se reduce | high |
| LIFE-11 | Doble anulación / anular venta ya anulada | efvo 50.000 + fiado 50.000 = 100.000 | OK — guarda `status='cancelled'` | Ninguna; idempotencia bien manejada | ninguna |
| LIFE-12 | Mixta SIN crédito anulada vía el modal mixto | efvo 70.000 + tarjeta 30.000, fiado 0 | OK | UX menor: el modal de crédito aparece aunque no haya fiado; el efectivo no genera egreso | low |
| OWN-01 | "¿Cuánto vendí a crédito/fiado hoy?" en Resumen por método | credit puro 100.000 + mixta (efvo 50.000 + fiado 30.000) | NO | El fiado real (130.000) nunca se muestra agregado: "Fiado" subestima la porción de las mixtas | critical |
| OWN-02 | "¿Cuánto recibí en efectivo hoy?" Reportes vs Caja | efvo puro 200.000 + mixta (efvo 50.000 + tarjeta 30.000) | OK (deuda) | byMethod no distribuye la porción cash de mixtas; la caja SÍ → discrepancia Reportes vs Caja | high |
| OWN-03 | "Lista de clientes que me deben y cuánto" en CxC | deuda 130.000 = 100.000 credit puro + 30.000 porción mixta | Total OK, no descomponible | No hay columna "deuda de mixtas" vs "crédito puro" ni montos por venta | high |
| OWN-04 | "Exportar las ventas a crédito del mes a Excel" desde el Listado | mixta (efvo 60.000 + fiado 40.000) + credit pura 100.000 | NO | Las mixtas con crédito se ocultan del filtro "Fiado" y, como "Mixto", no traen la porción fiada; export inservible | critical |
| OWN-05 | "Conciliar la caja al cierre del turno" | mixta (efvo 50.000 + tarjeta 30.000 + fiado 20.000) | OK (efectivo cuadra) | Fiado del turno global sin cliente; tras cerrar el desglose desaparece (no se guarda) | high |
| OWN-06 | "Ver el saldo de un cliente y de dónde viene" en la ficha | deuda 130.000 = 100.000 credit puro + 30.000 porción mixta | Total OK, origen sólo per-venta | El card de Saldo es un número único; mixtas muestran "Fiado X" por fila, credit puro no; hay que sumar a mano | high |
| OWN-07 | "La línea 'Fiado X' no refleja lo que el cliente AÚN debe" | mixta con fiado 50.000; luego pagó 30.000 | NO | Pool fungible: la línea "Fiado X" sobre-representa la deuda viva de cada mixta | high |
| OWN-08 | "Revisar el Listado y ver cuánto fue fiado en cada mixta" | mixta (efvo 50.000 + tarjeta 30.000 + fiado 20.000) = 100.000 | NO | La grilla principal muestra sólo "Mixto"; única superficie correcta es VentaDetallePage | critical |
| OWN-09 | "Exportar el Resumen por método de pago a Excel/PDF" | varias mixtas en el período | NO | El Resumen no es exportable (no está en reportConfigs) y en pantalla no desglosa | high |
| OWN-10 | "Conciliar tarjeta/transferencia de mixtas contra el adquirente" | mixta (efvo 40.000 + tarjeta Bancard 60.000) | OK (mayormente) | Tarjeta bien resuelta; residuo: `sales.payment_processor=NULL` en mixtas | medium |
| OWN-11 | "Ver el total fiado en el Dashboard" | varios deudores mixta + credit puro | Total OK | Sin descomposición por origen; mixtas recientes como "Mixto" opaco | medium |
| OWN-12 | "Auditar que la suma de deudas cuadre con lo fiado" | mixtas sin cliente + mixtas anuladas con "No devolver" | NO | Fiado sin cliente + anulaciones descuadran balance; no hay vista que detecte inconsistencias | high |

## Impacto por superficie

### Reportes › Resumen por método de pago
**Qué muestra hoy:** una fila "Mixto" (badge gris) con el total entero de todas las mixtas, y filas "Efectivo"/"Fiado"/etc. con los totales de las ventas puras de cada método. La fila "Tarjeta" sí se abre en sub-filas por procesador (incluye la porción tarjeta de las mixtas).
**Qué sale mal:** "Efectivo" y "Fiado" están **subestimados** porque no incluyen las porciones cash/credit escondidas dentro de "Mixto". El total global (KPI "Total") es correcto, pero el desglose por método debajo no reconcilia. *(`reports.ts:169-182`, `ReportesPage.tsx:678-717`.)*

### Caja / arqueo
**Qué muestra hoy:** "Efectivo esperado" y "Ventas Efectivo" SÍ incluyen correctamente la porción cash de las mixtas (el cajón cuadra). El panel "Otros medios (no afectan caja)" muestra Tarjeta (con procesador), Transferencia y Fiado como totales agregados.
**Qué sale mal:** la fila "Fiado" es un total global **sin cliente** y mezcla credit puro con porción credit de mixtas; tras cerrar la caja, todo ese desglose **desaparece** (no se persiste). El operador no puede saber desde caja qué cliente quedó debiendo. *(`cash.ts:332-353`, `CierreCajaPage.tsx:310-318`, `cash.ts:74-192`.)*

### Ficha de cliente
**Qué muestra hoy:** un card de Saldo con `customers.balance` (número único) y, en el Historial de Compras, una línea "Fiado {monto}" por cada venta **mixta**.
**Qué sale mal:** el card de Saldo no descompone el origen; la línea "Fiado" refleja la porción **original** (no la pendiente tras pagos) y sólo aparece en mixtas, no en credit puro; esas líneas no se totalizan en ningún lado. *(`ClienteFichaPage.tsx:271-307, 342-372`.)*

### Listado de ventas
**Qué muestra hoy:** columna "Método" con un badge "Mixto"; el pie de tabla suma `s.total` de todas las ventas.
**Qué sale mal:** no hay ningún importe por método en la fila; la porción fiada es indistinguible del total. `getAllSales` no carga `sale_payments` ni `customer_balance`, así que el estado "Fiado · Pagado" está muerto. Hay que abrir cada venta al detalle. *(`sales.ts:291-301`, `VentasListadoPage.tsx:299-307`.)*

### Dashboard
**Qué muestra hoy:** tabla de Ventas recientes (mixtas como "Mixto"), total de deuda = suma de `abs(balance)` de los deudores.
**Qué sale mal:** las mixtas recientes son opacas; el total fiado no tiene descomposición por origen. Refuerza la sensación, desde la pantalla de inicio, de que la app no separa la deuda de mixtas. *(`RecentSalesTable.tsx:12-18`, `DashboardPage.tsx:203`.)*

### Ticket / comprobante
**Qué muestra hoy:** "Pago: Mixto" seguido de una línea por método (ej. "Efectivo 50.000", "Tarjeta (Bancard) 30.000", "Fiado 20.000") con su comprobante. Esto está **bien** y es consistente en los 4 canales (preview, impresión, PDF, PNG, WhatsApp).
**Qué falta:** no hay una línea destacada "Saldo pendiente / Queda debiendo" ni el nuevo balance; la porción fiada es una línea más. *(`ticket.ts:198-212`.)*

### Exportación Excel/PDF
**Qué muestra hoy:** desde el Listado, una sola columna "Método" = "Mixto" y una columna Total. El Resumen por método directamente no es exportable. El único reporte de deuda exportable (Fiados Pendientes) lleva `abs(balance)` por cliente.
**Qué sale mal:** el archivo de ventas colapsa toda mixta en "Mixto" sin columnas por método ni de fiado; imposible conciliar deuda por venta fuera de la app. *(`VentasListadoPage.tsx:119-136`, `ReportesPage.tsx:129-203`.)*

## Tabla de brechas verificadas

| # | Brecha | Veredicto | Evidencia (archivo:linea) | Severidad |
|---|---|---|---|---|
| 1 | El POS emite doble representación (etiqueta `mixed` + array `payments` fiel); el defecto vive en el consumidor (byMethod), no en el productor | confirmed (severidad acotada) | `CobroModal.tsx:194-206`, `sales.ts:135-153`, `reports.ts:169-182` | medium |
| 2 | El servidor no rechaza `mixed` con porción credit sin `customerId` → fiado huérfano | confirmed | `CobroModal.tsx:197`, `sales.ts:98, 182-190, 200` | critical |
| 3 | La fila `sales` no materializa el desglose ni la porción crédito (sólo etiqueta `mixed`) | confirmed | `schema.ts:90-104`, `sales.ts:132-153` | high |
| 4 | `sale_payments` se escribe sólo para mixtas → desglose heterogéneo | partial (impacto "nada lo hace" refutado: `cash.ts:332-353` sí une) | `sales.ts:182-192, 194-198`, `CobroModal.tsx:178` | low |
| 5 | La porción credit de la mixta baja el balance idéntico al credit puro; balance sin origen | partial (mecanismo OK; impacto "imposible auditar" acotado por drill-down de ficha) | `sales.ts:200-210`, `schema.ts:47` | low |
| 6 | Balance escalar sin origen; reconstrucción requiere re-sumar `sale_payments` | partial (existe atribución per-venta en la ficha) | `sales.ts:200-210`, `ClienteFichaPage.tsx:342-372` | low |
| 7 | `pendingCredits` devuelve sólo `balance` neto; no desagrega credit puro vs mixta | confirmed | `reports.ts:111-135` | medium |
| 8 | Tabla CxC + Excel sin columna de desglose por origen | confirmed | `ReportesPage.tsx:847-897, 134-139, 207-215` | medium |
| 9 | Card de Saldo de la ficha es número único | partial (el Historial de Compras sí muestra "Fiado" per-venta) | `ClienteFichaPage.tsx:271-307, 342-348` | low |
| 10 | La línea "Fiado" de la ficha refleja porción original, no la pendiente | confirmed | `ClienteFichaPage.tsx:342-348`, `customers.ts:381-404`, `schema.ts:158-168` | medium |
| 11 | Pagos de deuda sin `sale_id` → pool fungible, no imputable | confirmed | `customers.ts:133-186, 198-260`, `schema.ts:158-168` | medium |
| 12 | Cierre de caja colapsa fiado de mixtas + credit puro en total global sin cliente | confirmed | `CierreCajaPage.tsx:310-318`, `cash.ts:332-353` | medium |
| 13 | El cierre no persiste el desglose por método ni el fiado del turno | confirmed | `cash.ts:74-192`, `schema.ts:63-74`, `reports.ts:97-109` | high |
| 14 | `byMethod` agrupa por la columna monolítica; mixta suma su total entero a "mixed" | confirmed (sólo subcaso tarjeta mitigado por `byCardProcessor`) | `reports.ts:169-182`, `ReportesPage.tsx:678` | medium |
| 15 | El render del Resumen sólo desglosa "card"; "Mixto" es fila opaca | confirmed | `ReportesPage.tsx:678-717` | high |
| 16 | `pendingCredits` no consulta `sale_payments`; total correcto pero origen invisible | confirmed (severidad: gap de auditoría, no de monto) | `reports.ts:111-135`, `ReportesPage.tsx:414` | medium |

> Las brechas de los subsistemas **listados de venta** (`getAllSales` sin `sale_payments`), **export del Listado** y **anulación** (efectivo no reembolsado, "Devolver crédito" sobre crédito ya pagado, "No devolver" deja deuda sin venta, falta de guarda de caja abierta) fueron enumeradas en el mapa de subsistemas pero no pasaron por la ronda adversarial de verificación de brechas; se documentan en "Dónde se pierde el desglose" y en la matriz de escenarios con la severidad asignada por el mapa, sin re-verificar línea por línea aquí.

## Preguntas abiertas / decisiones para el plan

Estas son decisiones de negocio/producto que el dueño y el equipo deben tomar **antes** de diseñar la solución. No son la solución técnica.

1. **¿La porción crédito de una mixta debe contar como "venta a crédito" en el Resumen por método?** Es decir, ¿queremos que el reporte "Por método de pago" distribuya las porciones de las mixtas a sus métodos reales (efectivo/tarjeta/transferencia/fiado), de modo que la suma por método cuadre contra la operación real y contra la caja? ¿O se prefiere conservar "Mixto" como categoría y agregar un desglose aparte?

2. **¿Se quiere un reporte de deuda que distribuya las porciones?** ¿Debe el reporte de Fiados Pendientes / CxC separar, por cliente, "deuda de ventas mixtas" vs "deuda de crédito puro", con montos? ¿Hasta qué granularidad: por cliente, por venta, por porción?

3. **¿La deuda debe poder atribuirse a la venta que la originó?** Hoy `customer_payments` no tiene `sale_id` y la deuda es un pool fungible. ¿El negocio necesita saber "qué venta mixta sigue impaga"? Esto implica decidir si los pagos de deuda se imputan a ventas concretas (con algún criterio: FIFO, manual, etc.) o se mantiene el pool agregado.

4. **¿La línea "Fiado X" de la ficha debe mostrar lo pendiente o lo original?** Hoy muestra la porción fiada al momento de la venta, sin restar pagos posteriores. ¿El dueño espera ver "cuánto resta de esta venta" o "cuánto se fió en su momento"? La primera opción depende de la decisión 3.

5. **¿Retroactividad sobre datos históricos?** Si se agrega desglose o atribución, ¿debe aplicarse a las ventas mixtas ya registradas (backfill), o sólo a las nuevas? Las mixtas históricas sí tienen `sale_payments`, pero los pagos de deuda históricos no tienen `sale_id` para imputar.

6. **¿La UI de listado debe mostrar el desglose junto a "Mixto"?** ¿Queremos que la grilla de ventas y/o el Dashboard muestren las porciones (al menos la fiada) sin tener que entrar al detalle? ¿Con qué formato (sub-líneas, tooltip, columnas separadas)?

7. **¿La exportación a Excel debe traer columnas por método?** ¿El dueño necesita columnas separadas (Efectivo / Tarjeta / Transferencia / Fiado) por venta para conciliar fuera de la app, o le alcanza con un reporte de fiado por venta?

8. **¿El servidor debe rechazar una mixta con crédito sin cliente?** El "fiado fantasma" (PAY-09 / LIFE-08) hoy sólo lo bloquea la UI. ¿Se quiere endurecer la validación de servidor (`credit ⇒ customerId requerido`) como invariante de integridad, aplicable también a credit puro?

9. **¿Cómo debe comportarse la anulación de mixtas?** Decisiones pendientes: (a) ¿generar un movimiento de caja de egreso explícito para la porción efectivo devuelta? (b) ¿bloquear o registrar la anulación contra una caja ya cerrada? (c) ¿al "Devolver crédito" descontar lo que el cliente ya pagó (depende de la decisión 3)? (d) ¿el modal debe separar efectivo vs tarjeta/transferencia en lugar de fundirlos?

10. **¿El cierre de caja debe persistir el desglose del turno?** ¿Se quiere guardar el desglose por método (y el fiado generado, con o sin cliente) en el registro de cierre, para poder reconstruirlo a posteriori sin recomputar desde `sales`/`sale_payments`?

11. **¿El ticket debe mostrar el saldo resultante?** ¿Agregar al comprobante una línea destacada "Queda debiendo Gs X" / nuevo saldo del cliente cuando la mixta tiene porción fiada?
