# Feature Specification: 010 — Fondo de caja y retiro al cierre

**Feature Branch**: `010-cash-float-close`
**Created**: 2026-09-07
**Status**: Implemented on branch `010-cash-float-close` (sin plan/tasks; este spec es la lista de aceptación)
**Input**: La dueña del negocio (conversación de WhatsApp del 2026-09-07)
explica que dejan siempre un **fondo fijo de efectivo** en el cajón (aprox.
600.000 Gs) como base para el día siguiente. Lo cargan como apertura y, al
cerrar, el sistema muestra el efectivo contado **total**, que incluye ese fondo;
quien controla tiene que restarlo a mano cada vez para saber cuánto se retira o
se entrega, y ahí se confunden. El fondo no es exacto todos los días (redondean
para no entregar monedas: quedan 590.000 o 620.000). Pide un ítem en el cierre
para cargar "lo que dejo en caja" y que el sistema calcule el resto o, como
mínimo, que las **observaciones del cierre salgan impresas** para anotarlo ahí.
Verificado en el código: hoy no existe el concepto de fondo ni de retiro, y las
notas del cierre se guardan pero **no aparecen** ni en el comprobante PDF ni en
el historial de cajas. Análisis previo relacionado:
[docs/cierre-de-caja-analisis.md](../../docs/cierre-de-caja-analisis.md)
(recomendación 6: proponer la apertura a partir del cierre anterior).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Indicar cuánto queda en caja y ver cuánto retirar al cerrar (Priority: P1)

Quien cierra la caja cuenta el efectivo y lo carga como hoy. Debajo, un campo
**"Efectivo que queda en caja (fondo para el próximo turno)"** viene precargado
con el fondo por defecto del negocio y se puede corregir (por ejemplo a 590.000
si ese día redondearon para no dejar monedas). En vivo aparece la línea
**"A retirar / entregar" = contado − lo que queda**. El arqueo (esperado,
diferencia, cuadra / sobró / faltó) sigue exactamente igual: el fondo no lo
toca. Al confirmar, el monto que quedó se guarda junto con el cierre y la
pantalla "Caja cerrada" muestra, además del veredicto del arqueo, "Queda en
caja" y "Retiro / entrega".

**Why this priority**: es el pedido principal y la causa concreta de la
confusión. Hoy el único número disponible al cerrar es el total contado, que
mezcla el fondo con la recaudación, y la resta se hace de cabeza y se anota en
papel. Sin esto, quien controla no puede saber desde el sistema cuánto se
retiró y cuánto quedó.

**Independent Test**: abrir caja con 600.000, registrar ventas en efectivo por
590.000, ir al cierre y contar 1.190.000: esperado 1.190.000 y diferencia 0;
"Queda en caja" precargado con 600.000 y "A retirar" 590.000. Corregir "Queda
en caja" a 620.000: "A retirar" pasa a 570.000 y el arqueo no cambia. Confirmar
y verificar que la vista "Caja cerrada" muestra 620.000 / 570.000.

**Acceptance Scenarios**:

1. **Given** una caja abierta con apertura 600.000 y ventas en efectivo por
   590.000, **When** quien cierra ingresa un contado de 1.190.000, **Then** ve
   esperado 1.190.000, diferencia 0, "Queda en caja" precargado con el fondo por
   defecto (600.000) y "A retirar / entregar" 590.000, todo antes de confirmar.
2. **Given** lo anterior, **When** corrige "Queda en caja" a 620.000, **Then**
   "A retirar / entregar" pasa a 570.000 y esperado y diferencia no cambian.
3. **Given** un contado de 400.000 con "Queda en caja" precargado en 600.000,
   **When** intenta confirmar, **Then** el sistema no permite el cierre e indica
   que no puede quedar en caja más de lo contado; al bajar el valor a 400.000 o
   menos, permite confirmar.
4. **Given** que confirma el cierre, **When** aparece la vista "Caja cerrada",
   **Then** muestra el veredicto del arqueo y, además, "Queda en caja" y
   "Retiro / entrega" con los montos confirmados.
5. **Given** un cierre con faltante (contado 1.150.000 contra esperado
   1.190.000) y "Queda en caja" 600.000, **When** confirma, **Then** el faltante
   de 40.000 se informa como hoy y el retiro es 550.000 (contado − lo que
   queda); el faltante no se descuenta dos veces.
6. **Given** un cierre con retraso donde no se sabe el conteo y se ingresa 0,
   **When** intenta confirmar, **Then** "Queda en caja" también debe ser 0 (no
   puede quedar más de lo contado) y el resto del flujo de cierre con retraso
   (notas obligatorias) se mantiene.
7. **Given** un cierre confirmado con contado 1.190.000 y retiro 590.000,
   **When** se consulta el historial de movimientos de caja de ese turno,
   **Then** el movimiento de cierre refleja el contado total (1.190.000) y no
   existe ningún movimiento por el retiro.

---

### User Story 2 — El comprobante del cierre muestra el fondo, el retiro y las observaciones (Priority: P1)

Quien controla recibe el comprobante PDF del cierre y ve, en el bloque "Caja
(efectivo)", además del arqueo de siempre, las líneas **"Queda en caja (fondo)"**
y **"Retiro / entrega"**. Si quien cerró escribió observaciones, salen impresas
**completas** al pie del comprobante, identificadas como observaciones del
cierre. Ya no hace falta restar a mano ni entrar al sistema a buscar la nota.

**Why this priority**: es la alternativa mínima que pidió la dueña y que hoy
cree que ya funciona ("eso sale impreso, ¿sí?"); no funciona: las notas se
guardan pero no se imprimen en ningún lado. Es lo que le permite a quien
controla verificar la rendición sin abrir la app.

**Independent Test**: cerrar con contado 1.190.000, "Queda en caja" 600.000 y
la nota "Quedó en caja 600.000 para mañana"; descargar el comprobante y
verificar las dos líneas nuevas y el pie con la nota textual. Cerrar otra caja
sin nota y verificar que no aparece ningún pie de observaciones vacío.

**Acceptance Scenarios**:

1. **Given** un cierre confirmado con fondo 600.000 y contado 1.190.000,
   **When** descarga el comprobante, **Then** el bloque "Caja (efectivo)"
   incluye "Queda en caja (fondo) 600.000" y "Retiro / entrega 590.000" a
   continuación del resultado del arqueo, con el retiro destacado.
2. **Given** un cierre con observaciones, **When** descarga el comprobante,
   **Then** las observaciones aparecen completas y textuales (sin recortes) en
   un pie identificado como observaciones del cierre.
3. **Given** un cierre sin observaciones, **When** descarga el comprobante,
   **Then** no se imprime ninguna sección de observaciones vacía.
4. **Given** un cierre con retiro 0 (se dejó todo en caja), **When** descarga
   el comprobante, **Then** "Retiro / entrega" muestra 0 y "Queda en caja"
   muestra el contado completo.

---

### User Story 3 — Configurar el fondo de caja por defecto (Priority: P2)

El Admin entra a Configuración y define **"Fondo de caja por defecto"** (por
ejemplo 600.000). Desde entonces, cada cierre precarga ese valor en "Queda en
caja" y cada apertura sin un cierre previo con fondo lo propone como monto
inicial. Viene sembrado en 600.000 desde la instalación (decisión del
2026-09-07); si el Admin lo deja en 0, el cierre precarga 0. Cambiarlo afecta
sólo los cierres futuros.

**Why this priority**: evita tipear 600.000 en cada cierre y deja asentada la
regla del negocio en un solo lugar. Sin esto la feature sigue funcionando
(precarga 0 y se corrige a mano), por eso no es P1.

**Independent Test**: sin configurar, abrir el cierre y verificar que "Queda en
caja" precarga 0. Configurar 600.000 como Admin y verificar que el siguiente
cierre precarga 600.000. Cambiarlo a 500.000 y verificar que los cierres ya
hechos conservan su fondo. Verificar que Supervisor y Cajero no pueden editar
el ajuste pero sí reciben la precarga al cerrar.

**Acceptance Scenarios**:

1. **Given** el fondo por defecto en 0 (desactivado por el Admin), **When** se
   abre la pantalla de cierre, **Then** "Queda en caja" precarga 0 y "A retirar
   / entregar" es igual al contado.
2. **Given** que el Admin configura 600.000, **When** cualquier usuario
   autorizado a cerrar abre la pantalla de cierre, **Then** "Queda en caja"
   precarga 600.000.
3. **Given** un Supervisor o un Cajero, **When** entra a Configuración,
   **Then** no puede modificar el fondo por defecto, pero su cierre sí lo
   recibe precargado.
4. **Given** que el Admin cambia el fondo de 600.000 a 500.000, **When** se
   consultan cierres anteriores, **Then** conservan el fondo que se registró en
   su momento.
5. **Given** que el Admin ingresa un valor negativo o vacío, **When** guarda,
   **Then** el sistema lo rechaza (negativo) o lo interpreta como "no
   configurado" (vacío o 0), con un mensaje claro.

---

### User Story 4 — La apertura propone el efectivo que quedó del cierre anterior (Priority: P2)

Al abrir la caja, el monto de apertura viene precargado con lo que quedó en el
último cierre, con la leyenda **"Quedó del cierre anterior (fecha): Gs. X"**.
Se puede editar si el efectivo real es otro (por ejemplo, si se retiró plata
después del cierre). Si el último cierre no registró fondo, propone el fondo
por defecto; si tampoco existe, 0, manteniendo la confirmación actual para
abrir en 0.

**Why this priority**: cierra el ciclo. Si quedaron 582.000 y al día siguiente
abren con 600.000 de memoria, el cierre siguiente muestra un faltante fantasma
de 18.000 (escenario "apertura inflada" del análisis previo). Proponer el monto
real elimina esa fuente de descuadre sin quitarle control a quien abre.

**Independent Test**: cerrar con "Queda en caja" 620.000; ir a la apertura y
verificar que precarga 620.000 con la leyenda y la fecha del cierre; aceptar sin
editar; cerrar sin ventas ni movimientos con contado 620.000 y verificar
diferencia 0.

**Acceptance Scenarios**:

1. **Given** un último cierre con "Queda en caja" 620.000, **When** se abre la
   pantalla de apertura, **Then** el monto precarga 620.000 y la leyenda indica
   que proviene del cierre anterior, con su fecha.
2. **Given** la precarga, **When** quien abre modifica el monto (por ejemplo a
   600.000 porque retiraron 20.000 después del cierre), **Then** la apertura
   registra 600.000: el valor editado manda.
3. **Given** un último cierre sin fondo registrado (anterior a esta versión) y
   un fondo por defecto de 600.000, **When** se abre la apertura, **Then**
   precarga 600.000 y la leyenda indica que es el fondo por defecto.
4. **Given** que no hay cierre con fondo ni fondo por defecto, **When** se abre
   la apertura, **Then** precarga 0 y se mantiene la confirmación actual para
   abrir sin efectivo.
5. **Given** la precarga de 620.000 aceptada sin editar, **When** se cierra la
   caja sin ventas ni movimientos con contado 620.000, **Then** la diferencia
   es 0.

---

### User Story 5 — Historial de cajas con fondo, retiro y observaciones (Priority: P3)

En Reportes › Cajas, cada cierre muestra **"Quedó"** y **"Retiro"** junto a
Esperado, Contado y Diferencia, y las observaciones del cierre se pueden leer
sin salir del reporte. Las exportaciones del historial incluyen esos datos. Los
cierres anteriores a esta versión muestran "—" en Quedó y Retiro.

**Why this priority**: es la vista de control posterior (quien revisa varios
días seguidos). Aporta valor pero el comprobante del cierre (US2) ya cubre la
verificación diaria.

**Independent Test**: con dos cierres nuevos (uno con nota) y uno anterior a la
versión, abrir el historial y verificar columnas, retiro = contado − quedó, la
nota legible, "—" en el cierre antiguo, y que la exportación incluye Quedó,
Retiro y Observaciones.

**Acceptance Scenarios**:

1. **Given** cierres registrados con esta versión, **When** se abre el
   historial de cajas, **Then** cada fila muestra Quedó y Retiro, con Retiro
   igual a Contado − Quedó.
2. **Given** un cierre con observaciones, **When** se consulta su fila,
   **Then** las observaciones se leen completas sin salir del reporte.
3. **Given** un cierre anterior a esta versión, **When** se lista, **Then**
   Quedó y Retiro muestran "—" y no se inventa ningún retiro.
4. **Given** una exportación del historial (Excel o PDF), **When** se genera,
   **Then** incluye Quedó, Retiro y Observaciones; los cierres sin datos
   exportan la celda vacía.

---

### Edge Cases

- **"Queda en caja" mayor que el contado**: no se permite confirmar; mensaje
  claro y el botón de confirmar deshabilitado hasta corregir. El retiro nunca
  es negativo.
- **Cierre con retraso con contado 0**: "Queda en caja" debe ser 0 (regla
  anterior); las notas siguen siendo obligatorias como hoy.
- **Fondo por defecto no configurado**: el cierre precarga 0; la apertura
  propone lo que quedó del último cierre o 0.
- **Cierre anterior a esta versión (sin fondo registrado)**: se muestra "—" en
  fondo y retiro; ningún cálculo, ningún error; la apertura siguiente cae al
  fondo por defecto o a 0.
- **Cambio del fondo por defecto entre cierres**: afecta sólo precargas futuras;
  los cierres ya registrados conservan su valor.
- **Efectivo real distinto de la propuesta al abrir** (se retiró plata después
  del cierre, o se repuso): quien abre edita el monto; la apertura sigue siendo
  "lo que hay realmente en el cajón".
- **Fondo con monedas o redondeado** (589.500, 620.000): cualquier monto entero
  no negativo es válido; no se exige que coincida con el fondo por defecto. Si
  difiere, el sistema puede mostrar una aclaración informativa, nunca bloquear.
- **Retiro 0** (se deja todo en caja): válido; el comprobante y el historial
  muestran retiro 0.
- **Faltante o sobrante junto con fondo**: el arqueo se informa como hoy; el
  retiro es siempre contado − lo que queda, sin sumar ni restar la diferencia.
- **Observaciones largas o con saltos de línea**: se imprimen completas, con
  saltos, sin truncar.
- **Observaciones vacías**: no se imprime ninguna sección vacía ni un guion.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La pantalla de cierre de caja MUST ofrecer un campo "Efectivo que
  queda en caja (fondo para el próximo turno)", en guaraníes enteros, no
  negativo, además del contado y las notas actuales.
- **FR-002**: El campo "Queda en caja" MUST precargarse con el fondo por defecto
  del negocio cuando sea mayor que 0 (viene sembrado en 600.000) y con 0 en
  caso contrario, y MUST poder editarse en cada cierre.
- **FR-003**: La pantalla de cierre MUST mostrar en vivo la línea "A retirar /
  entregar" igual a contado − "Queda en caja", actualizada ante cualquier cambio
  de cualquiera de los dos valores y visible antes de confirmar.
- **FR-004**: El sistema MUST impedir confirmar un cierre cuando "Queda en caja"
  supera el contado, con un mensaje que lo explique; el retiro nunca puede ser
  negativo.
- **FR-005**: El arqueo MUST permanecer sin cambios: efectivo esperado y
  diferencia se calculan exactamente como hoy y el fondo no interviene en
  ninguno de los dos.
- **FR-006**: Al confirmar, el sistema MUST guardar el monto que quedó en caja
  junto con el registro del cierre; el retiro MUST derivarse siempre como
  contado − lo que quedó y no se almacena por separado.
- **FR-007**: La vista "Caja cerrada" posterior al cierre MUST mostrar "Queda
  en caja" y "Retiro / entrega" junto al veredicto del arqueo.
- **FR-008**: El comprobante PDF del cierre MUST incluir, en el bloque "Caja
  (efectivo)" y a continuación del resultado del arqueo, las líneas "Queda en
  caja (fondo)" y "Retiro / entrega", esta última destacada.
- **FR-009**: El comprobante PDF del cierre MUST imprimir las observaciones del
  cierre completas y textuales, en un pie identificado como tal, únicamente
  cuando no estén vacías.
- **FR-010**: El sistema MUST ofrecer en Configuración un ajuste "Fondo de caja
  por defecto" en guaraníes, editable sólo por Admin, cuyo valor MUST ser
  legible por cualquier usuario autorizado a abrir o cerrar la caja; vacío o 0
  significa "no configurado". El ajuste MUST venir sembrado en 600.000 tanto en
  instalaciones nuevas como al actualizar, sin pisar un valor ya cambiado por
  el Admin.
- **FR-011**: Cambiar el fondo por defecto MUST afectar sólo las precargas
  futuras; los cierres ya registrados MUST conservar el fondo que se guardó en
  su momento.
- **FR-012**: La pantalla de apertura MUST precargar el monto con, en este
  orden: el efectivo que quedó registrado en el cierre más reciente (sólo si
  ese cierre lo registró; no se busca hacia atrás en cierres anteriores), el
  fondo por defecto, o 0; MUST indicar con una leyenda el origen del valor
  (cierre anterior con fecha, o fondo por defecto) y MUST permitir editarlo. La
  confirmación actual para abrir en 0 se mantiene.
- **FR-013**: El historial de cajas MUST mostrar las columnas "Quedó" y
  "Retiro" (Retiro = Contado − Quedó) y MUST permitir leer las observaciones de
  cada cierre sin salir del reporte.
- **FR-014**: Las exportaciones del historial de cajas MUST incluir Quedó,
  Retiro y Observaciones.
- **FR-015**: Los cierres anteriores a esta versión MUST seguir visibles y
  exportables sin errores, mostrando "Quedó" y "Retiro" como no disponibles
  ("—"); no se rellenan ni se estiman valores históricos.
- **FR-016**: Registrar el fondo al cierre MUST estar disponible exactamente
  para quienes hoy pueden cerrar la caja (Admin, Supervisor, o el Cajero que
  abrió esa caja), sin permisos nuevos.
- **FR-017**: El retiro MUST NOT generar ningún movimiento de caja ni alterar el
  contado registrado del cierre; el movimiento de cierre que ya se registra en
  el historial de movimientos sigue reflejando el contado total.
- **FR-018**: Cuando "Queda en caja" difiere del fondo por defecto configurado,
  el sistema MAY mostrar una aclaración informativa (por ejemplo, "difiere del
  fondo por defecto de 600.000"), pero MUST NOT bloquear el cierre por ese
  motivo.

### Key Entities *(include if feature involves data)*

- **Turno de caja (registro de caja)**: hoy guarda apertura, contado al cierre,
  efectivo esperado, diferencia y notas. Gana un atributo nuevo: **efectivo que
  quedó en caja** al cierre (fondo para el turno siguiente), ausente en los
  turnos anteriores a esta versión. El **retiro** es un valor derivado (contado
  − quedó), no un atributo.
- **Fondo de caja por defecto**: ajuste global del negocio, un único monto en
  guaraníes, administrado por Admin; alimenta la precarga del cierre y, en
  segundo orden, la de la apertura.
- **Comprobante de cierre**: el documento que se descarga tras cerrar; pasa a
  incluir fondo, retiro y observaciones.
- **Movimiento de caja "cierre"**: la fila que ya se registra al cerrar con el
  contado total; no cambia con esta feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100% de los cierres nuevos, el monto a retirar está visible
  antes de confirmar, en la vista posterior al cierre y en el comprobante, sin
  que nadie tenga que restar a mano.
- **SC-002**: Para cualquier cierre, el efectivo esperado y la diferencia son
  idénticos a los que se obtenían antes de esta feature (desvío de 0 Gs): el
  arqueo no cambia.
- **SC-003**: El 100% de las observaciones de cierre no vacías aparecen
  completas en el comprobante y son legibles desde el historial.
- **SC-004**: La apertura del turno siguiente propone el monto que quedó en el
  100% de los casos en que el cierre previo lo registró; aceptarlo sin editar y
  cerrar sin ventas ni movimientos produce diferencia 0.
- **SC-005**: Un Admin configura o cambia el fondo por defecto en menos de un
  minuto y el cambio se refleja en el siguiente cierre.
- **SC-006**: El 100% de los cierres anteriores a la versión siguen visibles y
  exportables sin errores, con fondo y retiro marcados como no disponibles.
- **SC-007**: La actualización no requiere pasos manuales, reinstalación ni
  pérdida de datos: cero intervenciones en el local.
- **SC-008**: Quien controla puede responder "¿cuánto se retiró hoy y cuánto
  quedó en caja?" leyendo sólo el comprobante, en menos de 10 segundos.

## Assumptions

- **Decisiones confirmadas el 2026-09-07 con el dueño del proyecto**: el
  comprobante del cierre se imprime en papel y también se mira en pantalla
  (ambos caminos quedan cubiertos); el fondo es casi siempre 600.000, por lo
  que el ajuste se siembra en ese valor y el Admin sólo lo toca si cambia.
- **Idioma del documento**: este spec se escribe en español por preferencia del
  autor para los artefactos de Spec Kit, aun cuando la regla del repo pide
  documentación en inglés. Se deja constancia una vez para esta feature.
- **Una sola caja**: el sistema admite una única caja abierta a la vez; "último
  cierre" significa el cierre más reciente del negocio, sin importar quién lo
  hizo.
- **El retiro ocurre después del arqueo**: contar, registrar lo que queda y
  confirmar; recién entonces se saca la plata. Por eso el retiro no es un
  movimiento de caja: la plata sale del cajón fuera de la vida del turno, y el
  cierre registra el contado total tal como hoy.
- **Precedencia de la precarga**: en el cierre, fondo por defecto o 0; en la
  apertura, lo que quedó del último cierre, luego el fondo por defecto, luego 0.
  Un fondo por defecto vacío o en 0 se interpreta como "no configurado".
- **Sin datos históricos inventados**: los cierres previos no tienen fondo
  registrado y se muestran como no disponibles; no se hace relleno ni
  estimación.
- **Comprobante = PDF descargable**: hoy no existe impresión térmica del cierre
  y esta feature no la agrega; la verificación en papel se hace con el PDF y la
  verificación en pantalla con la vista "Caja cerrada".
- **Restricciones fijadas por el autor**: sin dependencias nuevas, cambio de
  esquema aditivo y compatible con los datos existentes, y el fondo por defecto
  guardado entre los ajustes del negocio ya existentes. El cierre existente se
  extiende con un dato opcional. Excepción decidida al implementar
  (2026-09-07): la apertura necesita leer el último cierre y un Cajero puede
  abrir caja pero no puede listar el historial completo, así que se agregó una
  única consulta de sólo lectura que devuelve exclusivamente los montos del
  cierre más reciente, disponible para los tres roles.
- **Fuera de alcance**: registrar automáticamente un egreso por el retiro;
  fondos distintos por usuario o por turno; validar que el fondo dejado
  coincida con el fondo por defecto (sólo se informa); cambiar la fórmula del
  arqueo; impresión térmica del cierre; mostrar el fondo en la página de
  historial de movimientos de caja.
