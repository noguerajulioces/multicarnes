# Especificación: Historial de Movimientos de Caja

**Rama de la feature**: `003-cash-movements-history`
**Creado**: 2026-05-11
**Estado**: Borrador
**Entrada**: Pedido del usuario — "Página de Historial de Movimientos de Caja: una nueva entrada en el sidebar llamada 'Movimientos de Caja' que liste todos los movimientos de caja (ingresos y egresos manuales, apertura y cierre) con paginación del lado del servidor, filtros y exportación a Excel. Reemplaza la limitación actual donde CajaPage solo muestra los movimientos de la caja abierta."

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia 1 — Historial auditable de movimientos manuales de caja (Prioridad: P1)

Como dueño del comercio (admin) que concilia el flujo diario de caja con mi contador, necesito un único lugar donde pueda ver cada ingreso y egreso manual hecho en la caja, en cualquier rango de fechas y de cualquier cajero, para verificar qué se metió o sacó de la caja por fuera de las ventas.

Hoy, una vez que una caja se cierra, los movimientos individuales que produjeron sus totales no son visibles en ninguna parte — solo el resumen del cierre en Reportes → Cierres Caja. Recuperar el detalle exige abrir la base de datos a mano.

**Por qué esta prioridad**: Es la motivación principal de la feature. Sin esta historia la página no tiene razón de existir. Desbloquea la conciliación contable, que hoy es manual y propensa a errores.

**Prueba independiente**: Abrir la nueva entrada "Movimientos de Caja" en el sidebar. Confirmar que la página lista todos los movimientos manuales (ingresos y egresos) de todas las cajas (abiertas y cerradas), ordenados por fecha descendente, paginados, con cajero y caja visibles por fila.

**Escenarios de aceptación**:

1. **Dado que** un admin está logueado y hay movimientos manuales en varias cajas cerradas, **cuando** abre Movimientos de Caja sin filtros, **entonces** los movimientos más recientes aparecen primero, con fecha/hora, tipo, descripción, monto, cajero, y un link al detalle del cierre en Reportes.
2. **Dado que** un admin está en la página, **cuando** define un rango de fechas que cubre solo la semana pasada, **entonces** la lista se actualiza para mostrar solo movimientos creados en ese rango y la paginación vuelve a la página 1.
3. **Dado que** un admin filtra por la cajera "María" y tipo "egreso", **cuando** se actualiza la lista, **entonces** solo se ven los egresos creados por María.
4. **Dado que** un admin ve un resultado filtrado que ocupa varias páginas, **cuando** hace click en "Exportar a Excel", **entonces** el archivo descargado contiene todas las filas de todas las páginas que coinciden con los filtros, no solo la página visible.

---

### Historia 2 — El cajero solo ve sus propios movimientos (Prioridad: P2)

Como cajero, quiero consultar mis propios ingresos y egresos pasados para verificar lo que registré durante mis turnos, pero no debo ver movimientos de otros cajeros ni información financiera sensible más allá de mi propia actividad.

**Por qué esta prioridad**: Útil para autoservicio del cajero y reduce interrupciones a los supervisores por dudas rutinarias del estilo "¿registré eso?". Importante para confianza y para minimizar exposición de datos, pero secundario al caso de auditoría de P1.

**Prueba independiente**: Loguearse como cajero. Abrir Movimientos de Caja. Confirmar que solo se ven filas donde el cajero es el creador, el filtro de cajero queda fijo a su propia identidad, y no hay controles para anular o modificar entradas.

**Escenarios de aceptación**:

1. **Dado que** un cajero está logueado y otros cajeros crearon movimientos, **cuando** abre Movimientos de Caja, **entonces** solo se listan sus propios movimientos y el filtro "Cajero" está fijado a su propio nombre y no es editable.
2. **Dado que** un cajero ve sus movimientos, **cuando** mira cualquier fila, **entonces** no hay acción "Anular" visible.
3. **Dado que** un cajero exporta sus movimientos a Excel, **cuando** abre el archivo, **entonces** contiene solo sus propias filas.

---

### Historia 3 — Anular un movimiento mal registrado (Prioridad: P2)

Como admin o supervisor, cuando un cajero registra un ingreso o egreso por error (monto mal, descripción mal o duplicado), necesito cancelar su efecto sobre los totales de la caja sin borrar la entrada original del historial, para que la traza de auditoría quede intacta y el saldo de caja se corrija.

**Por qué esta prioridad**: Sin esto, un movimiento mal registrado o queda incorrecto para siempre o alguien edita la base a mano. Las dos opciones son inaceptables para un sistema pensado para auditoría. El pedido original prefirió explícitamente "append-only con reversas" sobre ediciones destructivas.

**Prueba independiente**: Como admin, ubicar un movimiento en la lista, hacer click en "Anular", confirmar. La fila original queda visible pero marcada como anulada, y aparece un nuevo movimiento inverso en la lista referenciando al original. Los totales de la caja en Reportes reflejan un efecto neto cero del par.

**Escenarios de aceptación**:

1. **Dado que** un admin ve un movimiento manual no anulado, **cuando** hace click en "Anular" y confirma, **entonces** la fila original queda visualmente marcada como anulada (por ejemplo, monto tachado y un badge), y aparece un nuevo movimiento inverso con tipo opuesto y mismo monto absoluto, linkeado al original.
2. **Dado que** un movimiento ya fue anulado, **cuando** el admin mira su fila, **entonces** la acción "Anular" no se muestra, y la fila indica claramente "Anulado por [referencia al movimiento inverso]".
3. **Dado que** un admin anula un movimiento que pertenece a una caja cerrada, **cuando** vuelve al resumen del cierre en Reportes → Cierres Caja, **entonces** los totales del cierre no cambian (las anulaciones no alteran retroactivamente cierres históricos; crean su propia entrada de auditoría en el período actual).
4. **Dado que** un cajero mira cualquier fila, **cuando** observa la columna de acciones, **entonces** no hay control de anulación visible, sin importar quién creó la entrada original.

---

### Historia 4 — Rastrear un movimiento hasta su caja (Prioridad: P3)

Como cualquier usuario autorizado, cuando veo un movimiento en la lista y necesito contexto (a qué turno pertenecía, cuál fue el balance de cierre de ese día), quiero saltar directo al detalle del cierre en Reportes desde la fila, para no tener que correlacionar a mano por fecha y cajero.

**Por qué esta prioridad**: Calidad de vida. La feature funciona sin esto — el usuario puede navegar a Reportes a mano — pero el link ahorra fricción significativa durante la conciliación.

**Prueba independiente**: Hacer click en el id de la caja (o su ícono de link) en cualquier fila. El navegador navega al detalle de "Cierre Caja" correspondiente en el módulo Reportes, acotado a esa sesión.

**Escenarios de aceptación**:

1. **Dado que** un usuario hace click en el id de la caja en cualquier fila, **cuando** se registra el click, **entonces** es llevado al detalle del Cierre de Caja exactamente de esa sesión.
2. **Dado que** el movimiento pertenece a una caja todavía abierta, **cuando** el usuario hace click en el id de la caja, **entonces** es llevado a la página actual de la caja (CajaPage) en lugar de un detalle de cierre.

---

### Casos límite

- **Anular una anulación**: Un admin intenta anular un movimiento inverso que fue creado para cancelar otra entrada. El sistema debe impedirlo (las anulaciones no son anulables) para evitar ambigüedad recursiva. La acción "Anular" queda oculta para cualquier fila cuyo tipo sea "void".
- **Rango de fechas amplio**: Un usuario define un rango de 12 meses que retorna 50.000+ filas. La paginación y los filtros deben seguir respondiendo; la exportación debe completarse sin freezar la UI, o advertir al usuario si excede un umbral de seguridad.
- **Cajero eliminado**: Un movimiento fue creado por un usuario cajero que después fue removido. La fila debe seguir mostrando el nombre del cajero (snapshotado) y no romper.
- **Anulación concurrente**: Dos admins hacen click en "Anular" sobre la misma fila al mismo tiempo. Solo debe crearse un movimiento inverso; el segundo intento debe ser rechazado con un mensaje claro.
- **Caja reabierta/editada externamente**: Si las entradas de apertura/cierre de una sesión se modifican directo en la base, la lista refleja el estado actual en la próxima carga. La página no cachea datos viejos.
- **Movimiento con monto cero**: La validación río arriba debe impedir la creación; la lista no debe crashear si existe alguno en datos legados.
- **Cajero degradado / suspendido**: Un cajero que perdió acceso intenta abrir la página. El guard de auth lo deniega; mismo enforcement que cualquier otra página autenticada.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Listado y paginación**

- **FR-001**: El sistema DEBE exponer una nueva entrada de sidebar "Movimientos de Caja" visible solo para usuarios autenticados.
- **FR-002**: La página DEBE listar movimientos de tipo: ingreso manual, egreso manual, apertura de caja, cierre de caja, y entradas inversas (anulaciones).
- **FR-003**: La lista NO DEBE incluir las porciones en efectivo de las ventas; esas siguen en el listado de ventas existente.
- **FR-004**: Los resultados DEBEN estar ordenados por timestamp del movimiento, descendente por defecto, con el más reciente primero.
- **FR-005**: El sistema DEBE paginar resultados del lado del servidor, tamaño por defecto 25, configurable a 10/25/50/100.
- **FR-006**: El total de resultados DEBE mostrarse junto a los controles de paginación para que el usuario sepa el tamaño del set filtrado.

**Filtrado**

- **FR-007**: El usuario DEBE poder filtrar por un rango de fechas (desde / hasta), defaulteando al día actual en la primera carga.
- **FR-008**: El usuario DEBE poder filtrar por tipo de movimiento usando un control multi-select (ingreso, egreso, apertura, cierre, anulación).
- **FR-009**: Los usuarios admin y supervisor DEBEN poder filtrar por cajero (cualquier usuario con rol cajero o superior).
- **FR-010**: Los usuarios cajero DEBEN tener el filtro de cajero fijado a su propia identidad y el control deshabilitado.
- **FR-011**: El usuario DEBE poder filtrar por un id específico de caja, presentado como dropdown de sesiones recientes.
- **FR-012**: El usuario DEBE poder buscar texto libre en el campo descripción (case-insensitive, match parcial).
- **FR-013**: Aplicar o cambiar cualquier filtro DEBE resetear la paginación a la página 1 y actualizar resultados.
- **FR-014**: El estado de los filtros DEBE persistir dentro de la sesión (por ejemplo, navegar lejos y volver preserva los filtros hasta que la página se reabra en frío).

**Autorización**

- **FR-015**: La lista DEBE scopear filas a la identidad del usuario que pidió cuando tiene rol cajero: solo se retornan movimientos donde el cajero es el creador.
- **FR-016**: Admin y supervisor DEBEN ver todos los movimientos sin importar el cajero.
- **FR-017**: La autorización DEBE estar aplicada en el servidor, no solo ocultando controles en UI. Cualquier intento de un cajero de consultar movimientos de otro usuario DEBE ser rechazado.
- **FR-018**: La acción de anular DEBE estar disponible solo para roles admin y supervisor, tanto en UI como en el servidor.

**Anulación**

- **FR-019**: Anular un movimiento DEBE crear un nuevo movimiento de efecto inverso (ingreso ↔ egreso; apertura ↔ cierre no permitido — ver FR-022) con el mismo monto absoluto y una descripción que referencie al original.
- **FR-020**: El movimiento inverso DEBE estar linkeado al original por una referencia estructural (para que la UI muestre "anulado por" / "anulación de").
- **FR-021**: El movimiento original DEBE permanecer en la tabla; NO DEBE ser borrado ni reescrito.
- **FR-022**: Los movimientos de apertura y cierre NO DEBEN ser anulables desde esta página. Los ajustes a balances de apertura/cierre pertenecen al flujo de cierre de caja.
- **FR-023**: Un movimiento inverso (anulación) NO DEBE ser anulable.
- **FR-024**: Después de una anulación exitosa, la lista DEBE reflejar tanto el original (marcado como anulado) como la nueva entrada inversa sin refresh manual.
- **FR-025**: Los intentos de anulación sobre un movimiento ya anulado DEBEN ser rechazados con un mensaje claro y legible.

**Exportación**

- **FR-026**: El usuario DEBE poder exportar el resultado filtrado actual a un archivo Excel (.xlsx).
- **FR-027**: La exportación DEBE incluir todas las filas que coinciden con los filtros actuales, en todas las páginas — no solo las filas visibles en la página actual.
- **FR-028**: Las columnas exportadas DEBEN incluir: fecha/hora, tipo, descripción, monto, nombre del cajero, id de la caja, flag de anulación, y referencia a la entrada inversa cuando aplica.
- **FR-029**: El nombre del archivo exportado DEBE incluir el rango de fechas del filtro (ej.: `movimientos-caja_2026-05-01_2026-05-11.xlsx`).
- **FR-030**: Si el resultado filtrado excede un umbral seguro (sugerido: 10.000 filas), el sistema DEBE avisar al usuario antes de generar el archivo y ofrecer estrechar el rango de fechas.

**Navegación cruzada**

- **FR-031**: Cada fila DEBE linkear desde su id de caja al detalle de cierre correspondiente en Reportes → Cierres Caja, o a la página de caja abierta si la sesión sigue abierta.
- **FR-032**: Las filas anuladas DEBEN mostrar un control para navegar directo a la entrada inversa, y viceversa.

**Auditoría**

- **FR-033**: Cada operación de anulación DEBE registrarse en el log de auth/auditoría existente con: id del usuario actor, id del movimiento original, id del movimiento inverso, timestamp, y razón si se provee.

### Entidades clave

- **Movimiento de Caja**: Entrada que registra dinero moviéndose hacia adentro o afuera de una caja, por fuera de una venta. Tiene un tipo, un monto, una descripción, un usuario creador, una referencia a la caja, un timestamp de creación, y una referencia opcional a un movimiento original que está anulando.
- **Caja (Sesión)**: Un ciclo abrir/cerrar de la caja durante el cual se registran ventas y movimientos manuales. Sirve como contenedor de scope para los movimientos y como destino de link de la fila.
- **Usuario (Cajero)**: El actor que crea movimientos. Sirve tanto como referencia foránea en cada movimiento como dimensión de filtro. El rol cajero define el scoping por fila; los roles admin y supervisor desbloquean la visibilidad inter-cajero y la acción de anular.
- **Referencia de Anulación**: El link estructural entre un movimiento original y su entrada inversa de cancelación. Lleva la semántica de auditoría ("este movimiento fue anulado" / "este movimiento es la anulación de otro").

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: El dueño del comercio puede producir una lista completa y filtrable de cada movimiento manual de caja para cualquier rango de fechas en menos de 30 segundos, sin abrir la base, sin escribir una query, y sin contactar soporte.
- **SC-002**: El 100% de los ingresos y egresos manuales registrados en el sistema son recuperables a través de la nueva página, incluyendo los de cajas ya cerradas.
- **SC-003**: Un cajero abriendo la página solo ve sus propios movimientos; ningún escenario de prueba produce una fuga inter-cajero mediante manipulación de filtros, edición de URL o requests repetidos.
- **SC-004**: Un admin puede anular un movimiento mal registrado y tener la corrección del balance reflejada en la página de la caja abierta (para sesiones abiertas) o en el historial de auditoría (para sesiones cerradas) dentro de los 5 segundos de confirmar la acción.
- **SC-005**: Las exportaciones de hasta 5.000 filas se completan en menos de 10 segundos en el hardware objetivo; las exportaciones de 5.000–10.000 filas se completan en menos de 30 segundos y avisan al usuario antes de generar el archivo por encima de ese umbral.
- **SC-006**: Las consultas filtradas (rango de fechas + tipo + cajero + caja) retornan la primera página de resultados en menos de 1 segundo para datasets de hasta 100.000 movimientos totales.
- **SC-007**: El tiempo que el dueño del comercio gasta conciliando caja diaria con su contador baja de forma medible (objetivo informal: de ~30 min/semana de cruzar referencias a mano a menos de 5 min).
- **SC-008**: Ninguna operación de anulación en producción resulta en registros pareados inconsistentes (cada original anulado tiene exactamente una inversa; cada inversa referencia exactamente un original).

## Suposiciones

- El schema actual de `cash_movements` puede absorber el linkage de anulación con un cambio aditivo; no se requiere reescribir registros pasados.
- El modelo de roles existente (cajero / supervisor / admin) es la fuente autoritativa de "quién ve qué" y "quién puede anular". No se introduce un rol nuevo.
- El módulo Reportes → Cierres Caja existente ya muestra la vista de detalle por sesión a la que las filas linkean; no se requieren cambios en esa vista como parte de esta feature más allá de aceptar deep links.
- La utility existente de exportación a Excel usada en el listado de ventas es reusable para la exportación de movimientos; si no, la UX visual es consistente con la exportación de ventas (mismo lugar del botón, mismo loading state, misma convención de nombre de archivo).
- La creación manual de nuevos movimientos queda fuera de scope para esta página. La creación sigue viviendo en la página de caja abierta (CajaPage) para no tocar el flujo del cajero.
- Diseño mobile-first responsive no es requerido; la aplicación es solo desktop (Electron).
- Español es el idioma para todos los labels visibles en esta página; la documentación técnica (este spec, el plan, el archivo de tareas) sigue en inglés, consistente con features anteriores en este código.
- Los objetivos de performance asumen que el dataset productivo no excederá ~100.000 movimientos manuales en ningún rango de fechas práctico; si se aproxima ese techo, podría requerirse indexación adicional o políticas de archivo, y se abordaría en otra feature.
