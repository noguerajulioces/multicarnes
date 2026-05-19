# Quickstart QA — 008 Tipos de pago en la cobranza de deuda

QA manual por user story. No hay test suite automatizada para esta UI
(consistente con specs 001–007). Ejecutar contra una DB con datos
realistas, idealmente una copia productiva restaurada en dev.

## Setup

1. `npm run dev` — levantar la app.
2. Confirmar que la migración v10 corrió: ver en logs
   `[migrations] applied v10`. Si no, abrir la DevTools y revisar.
3. Verificar PRAGMA (opcional, vía script o sqlite3 CLI):
   `PRAGMA table_info(customer_payments);` debe listar `affects_cash`.

## QA — User Story 1 (P1): Pago Efectivo afecta caja

**Pre**: usuario con rol cajero logueado, su caja abierta con
saldo inicial conocido (ej. 100.000), cliente con saldo `-100.000`.

1. Ir a Clientes → seleccionar el cliente con deuda.
2. Click en **Registrar Pago**.
3. Confirmar que el selector aparece con **Efectivo (afecta caja)**
   pre-seleccionado.
4. Ingresar monto `30.000`, nota `"Pago parcial"`.
5. Click **Guardar**.
6. Verificar:
   - Toast de éxito.
   - El saldo del cliente cambia a `-70.000`.
   - El Historial de Pagos del cliente lista la fila nueva con badge
     verde "Efectivo" y la nota.
7. Ir a **Caja → Movimientos**.
8. Verificar que aparece un movimiento `income` de `30.000` con
   descripción `Pago de deuda — <nombre del cliente> (Pago parcial)`.
9. Cerrar caja:
   - Esperado: efectivo esperado incluye los 30.000 del pago.
   - Si el monto contado es igual al inicial + 30.000, la diferencia es
     0.

**Resultado esperado**: ✅ pago reflejado en cliente, historial y caja.

## QA — User Story 2 (P1): Pago "Descuento de sueldo" no afecta caja

**Pre**: usuario con rol cajero, caja abierta, cliente con saldo
`-60.000`.

1. Ir al detalle del cliente.
2. Click **Registrar Pago**.
3. Cambiar el selector a **Descuento de sueldo (no afecta caja)**.
4. Ingresar `60.000`, nota `"Descuento agosto"`.
5. Click **Guardar**.
6. Verificar:
   - Toast de éxito.
   - Saldo del cliente queda en `0`.
   - Historial de Pagos muestra fila con badge ámbar
     "Descuento de sueldo".
7. Ir a **Caja → Movimientos**.
8. Verificar que **no apareció** ningún movimiento por 60.000
   en este intervalo de tiempo.
9. Cerrar caja:
   - Esperado: efectivo esperado **NO incluye** estos 60.000.

**Resultado esperado**: ✅ saldo actualizado pero caja intacta.

## QA — User Story 1 + edge case: sin caja abierta

**Pre**: usuario con rol cajero, **sin** caja abierta (cerró la caja al
mediodía o todavía no la abrió hoy). Cliente con deuda.

1. Detalle del cliente → **Registrar Pago**.
2. El selector está en **Efectivo**.
3. El botón **Guardar** debe estar **deshabilitado** con un mensaje
   visible: "Necesitás abrir caja para registrar pagos en efectivo".
4. Cambiar el selector a **Descuento de sueldo**.
5. El botón **Guardar** se habilita.
6. Ingresar monto y guardar → exitoso, sin caja involucrada.
7. Volver a **Efectivo** y, sin abrir caja, intentar guardar via DevTools
   (force-click el botón disabled vía `removeAttribute('disabled')` para
   simular un cliente malicioso).
8. **El handler del backend debe rechazarlo** con error claro
   "Necesitás una caja abierta para registrar pagos en efectivo." y nada
   se persiste.

**Resultado esperado**: ✅ doble bloqueo (UI + backend).

## QA — User Story 3 (P2): Distinción visual en Historial

**Pre**: un cliente con al menos:
- 1 pago previo a esta release (insertado antes de la migración),
- 1 pago Efectivo nuevo,
- 1 pago Descuento de sueldo nuevo.

1. Ir al detalle del cliente.
2. Tabla "Historial de Pagos":
   - Fila pre-release: badge verde "Efectivo".
   - Fila Efectivo nueva: badge verde "Efectivo".
   - Fila Descuento de sueldo: badge ámbar "Descuento de sueldo".
3. Cronómetro mental: identificar el tipo de cada fila en
   ≤ 3 segundos sin leer la nota.

**Resultado esperado**: ✅ tipos visualmente discriminables.

## QA — Permisos: cajero puede registrar pagos

**Pre**: usuario rol `cajero` logueado.

1. Ir a un cliente y abrir el modal.
2. El botón **Registrar Pago** debe estar disponible (antes no lo estaba).
3. Registrar un pago en Efectivo y en Descuento de sueldo en pruebas
   sucesivas.

**Resultado esperado**: ✅ ambos modos accesibles para cajero.

## QA — Permisos: cajero NO puede editar/eliminar pagos

**Pre**: usuario rol `cajero`, un pago ya registrado por él en el
historial.

1. Click en el ícono de editar (✏️) del pago.
2. Esperado: ya sea el botón está oculto, o al intentar guardar, el
   backend rechaza con error de permisos
   (`customers:updatePayment` sigue admin/supervisor).

**Resultado esperado**: ✅ cajero registra pero no modifica.

## QA — Auditoría en `action_logs`

Después de cualquier QA exitoso, abrir DevTools y ejecutar (vía consola
del proceso main si hay un debug bridge, o directamente sobre la DB con
sqlite3):

```sql
SELECT action, details
FROM action_logs
WHERE action = 'add_customer_payment'
ORDER BY id DESC LIMIT 5;
```

Cada fila debe tener `details` JSON con `affects_cash` y, cuando
`affects_cash=true`, también `register_id` no-null.

## Rollback de prueba

Para probar que la migración no destruye datos:

1. Hacer backup manual antes de actualizar (la app ya lo hace
   automáticamente).
2. Después de aplicar v10, restaurar el backup
   `pre-migrate-v10-*.db`.
3. La app debe arrancar normalmente con el schema previo.

Sólo necesario verificar una vez antes de release.

## Criterios de aceptación al cerrar QA

- ✅ Todos los QA arriba pasaron en una corrida limpia.
- ✅ `npm run typecheck` pasa sin errores (typecheck:node + typecheck:web).
- ✅ `npm run lint` pasa sin nuevos warnings.
- ✅ La feature 005-promotional-pricing, 003-cash-movements-history y
  002-review-fixes siguen funcionando (smoke test: registrar una venta
  en efectivo, verla en Movimientos de Caja, validar que el cierre
  cuadra). Esto cubre Principio VI (no regresión).
