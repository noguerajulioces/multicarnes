# Quickstart manual: Estado "leído" en notificaciones del header

**Feature**: 006-notif-read-state · **Branch**: `006-notif-read-state` · **Fecha**: 2026-05-14

Guía de validación manual end-to-end. Ejecutar después de implementar `notifications.store.ts` y los cambios en `Header.tsx`. Toma ~10 minutos para cubrir las tres historias de usuario + casos borde críticos.

> Requisito previo: `npm run dev` levanta la app sin errores en consola (Principio VII / Quality Gates). `npm run typecheck` y `npm run lint` pasan en verde antes de empezar el quickstart.

---

## Setup

1. Levantar la app: `npm run dev`.
2. Tener al menos un usuario por rol disponible para login: un admin/supervisor (ve ambas categorías) y un cajero (solo ve "Stock bajo").
3. Tener cargados en la base local:
   - Al menos 1 producto con `stock <= min_stock` (para alertas "Stock bajo").
   - Al menos 1 cliente con `balance < 0` (para alertas "Cobros pendientes").
   - Si no hay datos, crear los registros vía las pantallas de Productos y Ventas-a-crédito antes de empezar.

---

## Test 1 — Historia de Usuario 1 (P1): leer el dropdown lo vacía

1. Iniciar sesión como **supervisor** o **admin**.
2. Observar el ícono de campana en el header. Confirmar que muestra un **badge numérico** con el total de alertas no leídas (≥ 1).
3. Hacer clic en la campana para abrir el dropdown.
4. Confirmar que el dropdown lista las alertas no leídas (al menos "Cobros pendientes" o "Stock bajo"). El header del dropdown dice "X nueva(s)".
5. Cerrar el dropdown haciendo clic fuera.
6. **Aceptación**: el badge numérico **desaparece** y la campana queda sin contador.
7. Abrir nuevamente el dropdown sin que haya cambiado el conjunto de alertas.
8. **Aceptación**: el dropdown muestra el estado vacío con el texto **"Sin notificaciones pendientes"** (las filas previamente leídas ya no aparecen).
9. Navegar a otra pantalla (ej. Ventas) y volver al header.
10. **Aceptación**: el badge sigue oculto.
11. Refrescar la app (Cmd+R / Ctrl+R en dev) y abrir el dropdown.
12. **Aceptación**: el badge sigue oculto y el dropdown sigue mostrando "Sin notificaciones pendientes".

✅ FR-002, FR-003, FR-004, FR-009, FR-012 verificadas.

## Test 2 — Historia de Usuario 2 (P2): alerta verdaderamente nueva re-enciende el badge

1. Continuar con la sesión de supervisor del Test 1 (badge oculto).
2. Abrir otra ventana / pestaña en el POS y crear una **venta a crédito a un cliente que NO estaba previamente en saldo deudor**. Confirmar la venta.
3. Esperar como máximo 60 segundos (intervalo de refresh) **o** abrir y cerrar el dropdown para forzar el refresh.
4. **Aceptación**: el badge vuelve a aparecer con `"1"` (solo el cliente recién entrado).
5. Abrir el dropdown.
6. **Aceptación**: el badge desaparece nuevamente.

✅ FR-005, FR-006 verificadas, SC-003 verificada.

## Test 3 — FR-007 (no re-notificar por la misma entidad continua)

1. Con el badge oculto del Test 2, generar **otra venta a crédito al MISMO cliente** que ya está en saldo deudor (su `balance` se hace más negativo, pero no cambia su pertenencia al conjunto).
2. Esperar 60 s o re-abrir el dropdown para forzar refresh.
3. **Aceptación**: el badge **NO** reaparece. El cliente sigue en la lista interna pero ya estaba marcado como "visto".

✅ FR-007 verificada.

## Test 4 — Reentrada de entidad al conjunto

1. Cobrar (cancelar deuda) al cliente del Test 3 hasta que su `balance >= 0`. La fila desaparece del dropdown.
2. Refrescar y confirmar que el badge sigue oculto (no había nada no leído).
3. Generar **una nueva venta a crédito al mismo cliente** (ahora vuelve a tener `balance < 0`).
4. **Aceptación**: el badge **sí reaparece** con `"1"` porque la entidad salió del conjunto y volvió a entrar (Decisión D-03 / FR-006).

✅ FR-006, FR-010 verificadas.

## Test 5 — Historia de Usuario 3 (P3): click directo en una fila

1. Provocar al menos una alerta no leída (badge ≥ 1).
2. Hacer clic directo en una fila del dropdown ("Cobros pendientes" o "Stock bajo"). Confirmar que la app navega a la pantalla correspondiente (Reportes o Productos) y que el dropdown se cierra.
3. Volver al header (navegar atrás, o ir al Dashboard).
4. **Aceptación**: el badge ya está oculto para esa categoría.
5. Abrir el dropdown una vez más.
6. **Aceptación**: la fila clickeada en el paso 2 ya no aparece (quedó marcada como leída por el cierre del dropdown que disparó la navegación).

✅ FR-002 (variante por click), FR-012 (fila oculta tras leer), SC-006 (navegación preservada).

## Test 6 — Caso borde: cambio de usuario en el mismo dispositivo

1. Como **supervisor**, dejar el badge en cero (todo leído).
2. Cerrar sesión.
3. Iniciar sesión como **otro usuario admin distinto** (ID diferente).
4. **Aceptación**: el nuevo usuario ve el badge **encendido** con todas las alertas vigentes (su conjunto "seen" está vacío para esta instalación).
5. Cerrar sesión y volver a iniciar como el supervisor original.
6. **Aceptación**: para el supervisor, el badge sigue oculto (su estado "seen" persistió).

✅ FR-008, FR-009 verificadas.

## Test 7 — Caso borde: rol cajero

1. Iniciar sesión como **cajero**.
2. **Aceptación**: el dropdown muestra solo "Stock bajo" (no "Cobros pendientes"). El conteo del badge ignora `pending_credits`.
3. Abrir el dropdown → badge se apaga para "Stock bajo".
4. Asegurar (con otro login no-cajero) que un cambio en "Cobros pendientes" NO enciende el badge del cajero.
5. **Aceptación**: el badge del cajero permanece apagado mientras no haya cambios en stock.

✅ FR-011 verificada para rol cajero, regresión no introducida.

## Test 8 — Dropdown vacío

1. Con un usuario admin, sin alertas vigentes (todos los productos con stock OK, todos los clientes con balance ≥ 0). Alternativa: con alertas vigentes pero todas ya leídas en sesiones previas.
2. **Aceptación**: la campana se ve sin badge. Al abrir el dropdown se muestra el estado **"Sin notificaciones pendientes"** sin filas ni listado.

✅ FR-004, FR-012 (estado vacío).

## Test 9 — Persistencia entre cierres de la app

1. Con un usuario admin, abrir y cerrar el dropdown una vez para marcar todas las alertas existentes como leídas (badge a cero).
2. **Cerrar completamente** la aplicación Electron (Cmd+Q / Alt+F4).
3. Volver a abrir la app e iniciar sesión con el mismo usuario.
4. **Aceptación**: el badge aparece oculto si el conjunto de alertas no cambió mientras la app estaba cerrada (SC-005). Si entró una alerta nueva mientras estaba cerrada, el badge muestra el conteo solo de ese ítem nuevo, y al abrir el dropdown se ve solo esa fila nueva.

✅ FR-009, SC-005 verificadas.

---

## Quality gates antes de mergear

- `npm run typecheck` → 0 errores.
- `npm run lint` → 0 errores nuevos.
- `npm run dev` → app levanta y todos los tests 1–9 anteriores pasan en un solo intento manual.
- Verificación visual: ninguna otra pantalla (Productos, Reportes, Caja, Dashboard) cambió su comportamiento como efecto colateral (Principio VII).
