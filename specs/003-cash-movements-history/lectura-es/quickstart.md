# Quickstart: Movimientos de Caja — Verificación Manual

**Feature**: 003-cash-movements-history
**Fecha**: 2026-05-11
**Audiencia**: QA / dev haciendo verificación manual después de que la implementación aterrice.

Estos chequeos juntos ejercitan FR-001 a FR-033 y SC-001 a SC-008. Están escritos para correrse contra un build vivo (`npm run dev` o un `pos-multicarnes-1.x.0-setup.exe` instalado) sobre una base que tenga al menos una caja cerrada, al menos un ingreso manual, al menos un egreso manual, y al menos dos usuarios cajeros.

## Prerrequisitos

- Dos cuentas cajero (`cajero-a`, `cajero-b`) y un admin (`dueño`).
- Una `pos.db` poblada previa a esta migración. Si tu DB de dev está vacía, corré `scripts/auth-smoke.ts` una vez para seedear usuarios y una caja de muestra, después agregá un par de movimientos por `CajaPage`.
- Conteos de filas pre-migración capturados (para §2.5):

  ```sh
  sqlite3 ~/Library/Application\ Support/pos-multicarnes/pos.db \
    "SELECT COUNT(*) FROM cash_movements;"
  ```

## §1. Entrada de sidebar & visibilidad por rol (FR-001, FR-009, FR-010, FR-015, FR-018)

1. Loguearse como **dueño** (admin). Observar una entrada nueva en el sidebar "Movimientos de Caja". Hacer click. La página renderiza, defaulteando al rango de fechas de hoy.
2. Verificar que la barra de filtros expone: rango de fechas, multi-select de tipo, dropdown de cajero (habilitado), dropdown de caja, búsqueda de descripción, selector de tamaño de página, botón Exportar.
3. Verificar que cada fila muestra el botón de acción "Anular" cuando aplica. Verificar que el botón anular **no** se muestra en filas donde `type IN ('opening', 'closing', 'void')` ni en filas ya anuladas.
4. Cerrar sesión. Loguearse como **cajero-a**. Observar que la entrada del sidebar está visible.
5. Abrir la página. El filtro de Cajero está bloqueado en "cajero-a" (control deshabilitado). El botón "Anular" **no aparece** en ninguna fila.
6. Manipular el request vía consola de DevTools: `window.api.cashMovements.list({ userId: <id de cajero-b> })`. Verificar que los items retornados siguen conteniendo solo filas donde `userId === <id de cajero-a>` — es decir, el override del lado servidor funcionó.
7. Manipular vía DevTools: `window.api.cashMovements.void(<id de un movimiento>)`. Verificar que la llamada rechaza con error de autorización y que aparece una entrada en `auth_audit` con `outcome='blocked-insufficient-role'`.

✅ Pasa si el scoping de cajero-a-sí-mismo no se puede bypasear y anular es solo-admin.

## §2. Migración v7 contra una base existente poblada (FR-002, FR-003)

1. Antes de lanzar, snapshotear `pos.db` a `pos.db.pre-v7.bak`.
2. Lanzar la app. La migración corre al arranque.
3. Verificar estado del schema:

   ```sql
   SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;
   -- → 7
   PRAGMA table_info(cash_movements);
   -- → incluye una columna void_of con type INTEGER, notnull=0
   SELECT sql FROM sqlite_master WHERE type='table' AND name='cash_movements';
   -- → CHECK(type IN ('income','expense','opening','closing','void'))
   ```

4. Verificar backfill:

   ```sql
   -- Cada caja tiene exactamente una fila de apertura.
   SELECT cr.id, COUNT(*) FROM cash_registers cr
   LEFT JOIN cash_movements cm ON cm.register_id = cr.id AND cm.type = 'opening'
   GROUP BY cr.id HAVING COUNT(*) <> 1;
   -- → 0 filas
   -- Cada caja CERRADA tiene exactamente una fila de cierre.
   SELECT cr.id, COUNT(*) FROM cash_registers cr
   LEFT JOIN cash_movements cm ON cm.register_id = cr.id AND cm.type = 'closing'
   WHERE cr.status = 'closed' GROUP BY cr.id HAVING COUNT(*) <> 1;
   -- → 0 filas
   ```

5. Verificar que ninguna fila de ingreso/egreso manual se perdió o duplicó:

   ```sql
   SELECT COUNT(*) FROM cash_movements WHERE type IN ('income','expense');
   -- → coincide con el conteo pre-migración de §Prerrequisitos
   ```

6. **Seguridad en re-ejecución**: cerrar la app, modificar `schema_migrations` para borrar la fila de v7, reabrir. La migración corre de nuevo, sin filas duplicadas (los guards `NOT EXISTS` hacen su trabajo), sin excepción.

✅ Pasa si la migración es forward-compatible, idempotente, y sin pérdida.

## §3. Filtrado, paginación, búsqueda (FR-005–FR-014, SC-006)

1. Como **dueño**, setear rango de fechas = últimos 30 días. Verificar que los controles de paginación muestran `Total: N` y que las páginas navegan correctamente.
2. Setear el filtro de tipo a `{ egreso }`. Confirmar que solo aparecen egresos.
3. Setear el filtro de cajero a `cajero-a`. Confirmar que solo aparecen filas de `cajero-a`.
4. Setear el filtro de caja a una sesión específica. Confirmar que solo aparecen filas de esa sesión.
5. Tipear `gasolina` (o cualquier substring conocido por matchear una descripción) en la búsqueda. Confirmar que el filtrado es case-insensitive y match parcial.
6. Cambiar el tamaño de página a 100. Confirmar que cambian las filas por página; la cantidad de páginas baja en consecuencia.
7. Aplicar un filtro, navegar a la página 3, después cambiar un filtro. Confirmar que la página vuelve a 1.
8. Aplicar filtros, navegar a /ventas, volver. Confirmar que los filtros se preservan (URL search params).
9. Reload en frío (Ctrl+R / reiniciar la app). Los filtros se resetean al default (hoy).

**Chequeo de performance (SC-006).** Contra una DB poblada (≥10k movimientos alcanza), la primera página retorna en bastante menos de un segundo. Medir: en el tab Network de DevTools, inspeccionar la duración del roundtrip IPC.

## §4. Flujo de anulación (FR-019–FR-025, SC-004, SC-008)

1. Como **dueño**, ubicar una fila de egreso manual. Hacer click en "Anular". Confirmar la acción.
2. Dentro de 5 segundos (SC-004), observar:
   - El monto de la fila original está tachado y aparece un badge "Anulado".
   - Una nueva fila con `type=void` aparece, mismo monto absoluto, descripción con prefijo `[ANULACIÓN]`, linkeada al original.
   - El botón "Anular" desaparece del original.
3. Hacer click en "Anular" otra vez sobre el *mismo* original vía DevTools (`window.api.cashMovements.void(<id>)`). Verificar que la llamada rechaza con `'Este movimiento ya fue anulado.'` y que no se crea una segunda fila inversa.
4. Intentar anular una fila `opening` vía DevTools. Verificar `'Las aperturas y cierres no se anulan desde esta página. Editá el cierre de caja.'`
5. Intentar anular la fila void misma vía DevTools. Verificar `'No se puede anular una anulación.'`
6. Verificar que `auth_audit` tiene exactamente una fila nueva con `operation='cashMovements:void'` y `outcome='allowed'`. Verificar que `action_logs` tiene una fila nueva con `action='void_cash_movement'` y un `details` con forma JSON con los dos ids.

**Integridad del par (SC-008).**

```sql
-- Cada void tiene exactamente un original.
SELECT id FROM cash_movements WHERE type='void' AND void_of IS NULL; -- → 0 filas
-- Ningún par de voids apunta al mismo original.
SELECT void_of, COUNT(*) FROM cash_movements
WHERE type='void' GROUP BY void_of HAVING COUNT(*) > 1; -- → 0 filas
```

## §5. Navegación cruzada (FR-031, FR-032)

1. Hacer click en el id de la caja en cualquier fila de una sesión *cerrada*. Confirmar que el navegador va a Reportes → Cierres Caja con esa sesión expandida.
2. Hacer click en el id de la caja en una fila de la sesión *actualmente abierta*. Confirmar que el navegador va a CajaPage (la página de caja abierta).
3. En un original anulado, hacer click en el link "anulado por" en la fila. Confirmar que la URL/filtro cambia para destacar la fila inversa.
4. En una fila void, hacer click en el link "anulación de". Confirmar que destaca el original.

## §6. Exportación a Excel (FR-026–FR-030, SC-005)

1. Como **dueño**, aplicar filtros que produzcan ~50 filas. Hacer click en Exportar.
2. El archivo se descarga como `movimientos-caja_<desde>_<hasta>.xlsx`. Abrirlo; cada fila filtrada está presente.
3. Aplicar filtros que produzcan >100 filas pero <5000. Click en Exportar. Verificar que el archivo contiene *todas* las filas a través de todas las páginas, no solo la página visible. Medir: debería completarse dentro de 10 segundos.
4. Aplicar filtros que produzcan >5000 filas. Click en Exportar. Verificar que el archivo se completa dentro de 30 segundos.
5. Aplicar filtros que producirían >10000 filas. Verificar que un prompt avisa al usuario antes de generar y ofrece estrechar el rango de fechas.

## §7. Integración con caja abierta (emisión sintética)

1. Como cualquier cajero, abrir una caja nueva desde CajaPage.
2. Recargar la página "Movimientos de Caja". La sesión nueva aparece con una fila `opening` (`amount = opening_amount`, `description = 'Apertura de caja'`, `created_at` = la hora de apertura).
3. Agregar un ingreso manual desde CajaPage. Recargar. El ingreso nuevo aparece como fila separada.
4. Cerrar la caja desde CierreCajaPage. Recargar Movimientos de Caja. Aparece una fila `closing` con el monto contado y (si hay) la diferencia anotada en la descripción.

✅ Pasa si la emisión sintética dentro de `openCashRegister` / `closeCashRegister` funciona sin cambiar la UX existente.

## §8. Extensión del smoke-test

El chequeo automatizado nuevo en `scripts/auth-smoke.ts` ejercita:

- El scoping del cajero no se puede bypasear pasando un `opts.userId` de otro usuario (FR-015, FR-017).
- Una sola anulación crea exactamente una inversa con el original preservado (FR-019, FR-021).
- Una segunda anulación sobre el mismo original es rechazada (FR-025).
- Una anulación de una fila `opening` es rechazada (FR-022).
- Una anulación de una fila `void` es rechazada (FR-023).

Correr:

```sh
npm run typecheck && tsx scripts/auth-smoke.ts
```

Esperado: verde, con una sección nueva "cash movements void invariants" al final.
