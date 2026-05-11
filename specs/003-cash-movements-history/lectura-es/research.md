# Investigación: Historial de Movimientos de Caja

**Feature**: 003-cash-movements-history
**Fecha**: 2026-05-11
**Estado**: Resuelto — 5 decisiones, 0 pendientes.

Este documento registra decisiones de diseño tomadas durante la Fase 0 del workflow de planificación. Cada sección sigue el formato: **Decisión** → **Justificación** → **Alternativas consideradas**.

---

## §1. Estrategia de tabla: extender `cash_movements` vs. introducir una tabla nueva

**Decisión.** Extender la tabla `cash_movements` existente. Ampliar el CHECK de `type` de `IN ('income','expense')` a `IN ('income','expense','opening','closing','void')`, y agregar una columna nullable `void_of INTEGER NULL REFERENCES cash_movements(id)`.

**Justificación.** La página nueva necesita un *timeline unificado* con un solo ordenamiento, un solo paginador y un solo set de filtros. Partir apertura/cierre a una tabla separada forzaría un UNION ALL en cada sitio de query, duplicaría el footprint de índices, y haría que el linkage de anulación cruce dos tablas. Extender `cash_movements` mantiene el modelo de datos coherente con cómo el resto del módulo caja ya lee de ahí (ver [getCashRegisterSummary](../../../src/main/db/queries/cash.ts#L157-L203), [closeCashRegister](../../../src/main/db/queries/cash.ts#L43-L126)) y deja que las columnas existentes `register_id`/`user_id`/`created_at` carguen el mismo significado para los tipos de fila nuevos sin renombrar nada.

**Alternativas consideradas.**

- *Tabla `cash_register_balances` nueva solo para apertura/cierre.* Rechazada: produce un UNION ALL en cada listado, y la atribución "quién lo creó" ya es redundante con `cash_registers.user_id` para aperturas — duplicarla en una segunda tabla abre un agujero de consistencia.
- *Una vista `cash_journal` nueva que materialice un set de filas unificado.* Rechazada: las vistas de SQLite en better-sqlite3 funcionan bien para lecturas pero no se pueden filtrar + paginar con binding parametrizado tan limpio como una tabla real; perderíamos el predicate pushdown del `LIMIT/OFFSET` y tendríamos que materializar la vista al momento de la query.
- *Mantener dos queries (movimientos + resúmenes de caja) y mergear en el renderer.* Rechazada: viola el principio de capa de acceso a datos (el renderer armaría un objeto de dominio), y la paginación queda mal definida cuando el merge ocurre después del `LIMIT`.

---

## §2. Ampliación del CHECK de `cash_movements.type`

**Decisión.** Usar el patrón estándar de SQLite "recrear-y-swappear": crear `cash_movements_new` con el CHECK nuevo, copiar todas las filas, dropear la vieja, renombrar la nueva, recrear índices y referencias FK. Envolver toda la secuencia en una sola transacción SQLite dentro del cuerpo de la migración v7, guardada por un chequeo de idempotencia que verifica que el CHECK nuevo ya está en su lugar (leer `sql` de `sqlite_master` y buscar los tokens nuevos).

**Justificación.** SQLite no soporta `ALTER TABLE ... ALTER COLUMN` ni `DROP CONSTRAINT`. El recrear-y-swappear es la ruta canónica soportada y es exactamente lo que frameworks como Alembic emiten para SQLite. La migración es corta (~20 líneas de SQL), corre en una transacción, y el guard de idempotencia hace que una segunda corrida sea no-op. Ya usamos chequeos `PRAGMA table_info` para idempotencia a nivel columna en las [migraciones v1, v2, v6](../../../src/main/db/index.ts) — este extiende el mismo patrón a constraints.

**Alternativas consideradas.**

- *Tirar el CHECK del todo y aplicar los tipos en la capa de aplicación.* Rechazada: el CHECK existente es una red de seguridad útil contra errores de tipeo en la capa de query (la misma razón por la cual cada otra tabla del schema usa CHECK en columnas con forma de enum: `users.role`, `sales.payment_method`, `sales.status`, `cash_registers.status`). Removerlo crearía una grieta silenciosa.
- *Usar `ALTER TABLE ... DROP CONSTRAINT` de SQLite 3.45+.* Rechazada: técnicamente está soportado en SQLite moderno pero el binding de better-sqlite3 que viene con Electron está fijado a una versión más vieja; habría que bumpear el módulo nativo, lo que cae bajo el gate del Principio I.
- *Mantener el CHECK viejo y guardar apertura/cierre/anulación en una columna hermana tipo `subtype`.* Rechazada: hace que cada lectura sea `WHERE type = 'income' AND subtype IS NULL` para distinguir filas manuales de filas sintéticas — peor forma para lectores e índices.

---

## §3. Backfill: filas sintéticas de apertura/cierre desde `cash_registers` existentes

**Decisión.** Backfill al momento de la migración. Por cada fila en `cash_registers`, insertar una fila sintética en `cash_movements` de tipo `'opening'` (monto = `opening_amount`, `created_at` = el `opened_at` de la caja, `user_id` = el dueño de la caja), y si la caja está cerrada, también insertar una fila `'closing'` (monto = `closing_amount`, `created_at` = el `closed_at`, `user_id` = el dueño de la caja). Las dos filas referencian la caja vía `register_id` como cualquier otro movimiento.

**Justificación.** La motivación declarada del dueño del comercio (FR-001, SC-001, SC-007) es conciliar movimientos *históricos* de caja — la mayor parte del valor de la feature está en poder ver qué pasó *la semana pasada*, no qué pasará *la semana que viene*. Una migración que solo emita filas sintéticas para sesiones nuevas dejaría la página casi vacía el día uno y perdería el rastro de auditoría de cada sesión cerrada antes de la fecha de migración. El costo es bajo: el backfill es un `INSERT ... SELECT` por tipo de fila, corre dentro de la misma transacción de la migración, y los datos ya existen en `cash_registers` — el backfill es una denormalización para conveniencia de lectura, no una creación de hechos.

Tampoco se propagan estas filas sintéticas de vuelta a `cash_registers.opening_amount` / `closing_amount` — esas columnas siguen siendo el sistema de registro para la UX de apertura/cierre. Las filas sintéticas en `cash_movements` son una proyección aditiva del lado de lectura. La operación de anulación está prohibida sobre filas de apertura/cierre (FR-022) precisamente porque son proyecciones de datos autoritativos que viven en otra parte; anularlas crearía una inconsistencia entre las dos tablas.

**Alternativas consideradas.**

- *Sin backfill — solo sesiones abiertas después de v7 obtienen filas.* Rechazada: SC-002 ("100% de los ingresos y egresos manuales se pueden recuperar a través de la nueva página, incluyendo los de cajas ya cerradas") fallaría el día uno para aperturas/cierres. Las filas de ingresos/egresos manuales ya existen en `cash_movements` y no se ven afectadas, pero las aperturas/cierres sí — produciendo un timeline incompleto para sesiones más viejas.
- *Calcular filas sintéticas al momento de leer con UNION ALL contra `cash_registers`.* Rechazada: ver §1 — mata el predicate pushdown del paginador.
- *Correr el backfill como job en background después de la migración.* Rechazada: introduce un estado transitorio donde la página está mal; los datos de caja son lo suficientemente chicos (las sesiones están en los pocos miles en el peor caso) que la migración termina en mucho menos de un segundo.

---

## §4. Estrategia de indexación

**Decisión.** Agregar un índice compuesto: `CREATE INDEX IF NOT EXISTS idx_cash_movements_register_created ON cash_movements(register_id, created_at DESC)`. No agregar un índice por usuario; el scoping por cajero se aplica en el handler (la entrada de la matriz es `privileged` con los tres roles) y el predicado adicional `AND user_id = ?` corre contra la slice chica por sesión que el índice compuesto ya produce.

**Justificación.** La forma dominante de query es:

```sql
SELECT ... FROM cash_movements
WHERE date(created_at) BETWEEN ? AND ?
  AND (register_id = ? OR ? IS NULL)
  AND (user_id    = ? OR ? IS NULL)
ORDER BY created_at DESC
LIMIT ? OFFSET ?
```

El índice compuesto `(register_id, created_at)` sirve la rama más selectiva (filtrar por sesión) limpiamente. El caso comodín "todas las sesiones en un rango de fechas" igual usa el índice para el ordenamiento. Agregar un índice separado `(user_id, created_at)` ayudaría solo el caso de scoping por cajero, al costo de amplificación de escritura en cada insert de movimiento. Dado que la tabla va a tener cientos de escrituras por día y se va a leer a lo sumo unas pocas veces por turno, el trade-off favorece menos índices. SC-006 (primera página < 1s en 100k filas) es alcanzable cómodamente con este único índice según mediciones en tablas de forma similar en el código ([sales](../../../src/main/db/queries/sales.ts#L137-L191)).

**Alternativas consideradas.**

- *Agregar `(user_id, created_at)` también.* Diferida. Reevaluar si SC-006 falla en datos reales, o si emerge un patrón de listado pesado por cajero. Fácil de agregar después sin migración de schema porque es puramente un índice.
- *Índice full-text en `description` para la búsqueda.* Rechazada para v1: el módulo FTS5 sumaría complejidad para una feature donde los usuarios buscan descripciones cortas y mayormente distintas. Un simple `description LIKE ?` sobre la slice acotada por fecha es lo suficientemente rápido a la escala objetivo.

---

## §5. Destino del log de auditoría para la operación de anular

**Decisión.** Reusar `auth_audit`. Cada llamada exitosa a `cashMovements:void` escribe una fila con `operation = 'cashMovements:void'`, `resolved_user_id` = el admin/supervisor que anuló, `outcome = 'allowed'`, y un payload estructurado de detalle codificado en una tabla aparte — excepto que `auth_audit` no tiene una columna `details` hoy, así que actor + outcome van a `auth_audit` y el detalle por-anulación (id del movimiento original, id del inverso, razón opcional) va a `action_logs` con `action = 'void_cash_movement'`. La escritura de dos filas queda envuelta en la misma transacción que el insert del movimiento inverso.

**Justificación.** Esto coincide con el precedente sentado por la entrada `force_close_register` de la feature 002 ([cash.ts:116-122](../../../src/main/db/queries/cash.ts#L116-L122)), que también usa `action_logs` para detalle legible por humanos por-evento mientras `auth_audit` carga el outcome de autorización estructurado. Partir las responsabilidades así significa que el AuthAlertsBanner / listado de auditoría existente igual surfaceará los intentos de anulación (permitidos y bloqueados) sin un cambio de schema, y el detalle por-anulación aterriza en el log operacional existente que el admin ya lee. FR-033 se satisface con la combinación.

**Alternativas consideradas.**

- *Agregar una tabla `void_audit`.* Rechazada: agrega un tercer destino de auditoría sin resolver nada que `action_logs` no resuelva ya.
- *Escribir solo a `auth_audit`.* Rechazada: `auth_audit` está estructurada alrededor de (operación, rol, outcome) y le falta un canal de texto libre para el linkage original→inverso; agregarle uno cambiaría la tabla para todos los consumidores.
- *Escribir solo a `action_logs`.* Rechazada: los intentos bloqueados (FR-018, cajero intenta anular) necesitan fluir por la misma ruta de falla de autorización que cualquier otro canal privilegiado, que es `auth_audit`.

---

## No-decisiones transversales

Estas surgieron pero no requirieron una decisión registrada:

- **Reutilización del contrato de paginación existente.** Confirmado ya en su lugar en [sales.ts:137](../../../src/main/db/queries/sales.ts#L137); la query nueva simplemente adopta la misma forma `{ items, total, page, perPage }`. No es decisión de diseño.
- **Persistencia de filtros durante la sesión.** FR-014 dice que el estado persiste "hasta que la página se reabra en frío". El hook del renderer mantiene el estado en URL search params, que el router ya preserva en navegación back/forward — sin mecanismo nuevo.
- **Nombre del archivo de exportación Excel.** FR-029 fija el formato. No es decisión de diseño.
- **Labels en español.** Constitución V.b y la memoria de idioma confirman strings en español en el renderer con internos en inglés. No es decisión de diseño.
