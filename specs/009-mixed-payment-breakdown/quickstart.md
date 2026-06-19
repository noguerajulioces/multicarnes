# Quickstart — Verificación de 009 Visibilidad y desglose de ventas mixtas

Sin suite automatizada (constitución §VII): la verificación es por gates de build
+ pruebas manuales end-to-end + chequeos de reconciliación. El criterio de éxito
clave es que **los montos cuadren**: suma de métodos == total neto, y efectivo
del Resumen == efectivo de la Caja.

## 0. Gates de build (obligatorios)

```bash
npm run typecheck:node   # main + preload + shared
npm run typecheck:web    # renderer
npm run lint             # cero errores; no introducir warnings nuevos
```

## 1. DB fresca — caso canónico de reconciliación (US1)

Sembrar en un período un día con tres ventas (caja abierta del mismo cajero):
- Efectivo puro: **Gs. 100.000**
- Crédito puro (con cliente): **Gs. 100.000**
- **Mixta Gs. 100.000** = efectivo 50.000 + fiado 30.000 + tarjeta 20.000 (Bancard)

Abrir **Reportes › Resumen "Por método de pago"** del período y verificar:

| Método | Esperado |
|---|---|
| Efectivo | **150.000** (100.000 + 50.000) |
| Fiado | **130.000** (100.000 + 30.000) |
| Tarjeta | **20.000** |
| **Suma de métodos** | **300.000 == total neto del período** (SC-001/FR-004) |

- No aparece ninguna fila "Mixto" con monto (SC-006).
- Leyenda informativa "1 venta mixta distribuida" (`mixedCount`), sin sumar dinero
  (FR-005).
- La sub-fila "Tarjeta › por procesador" (`byCardProcessor`) sigue mostrando
  Bancard 20.000 y cuadra con el bucket Tarjeta (no se rompió tarjeta).

**Reconciliación con Caja (SC-002/FR-014)**: cerrar (o ver el resumen de) la Caja
de ese registro y verificar que el **efectivo esperado == 150.000**, idéntico al
bucket Efectivo del Resumen, al guaraní. *(Usar un período de un solo turno para
que el conjunto de ventas sea el mismo; ver riesgo de scope fechas vs register en
research.md.)*

## 2. DB existente — sin migración (SC-007)

Con una base que ya tiene ventas mixtas históricas:
- Abrir el Resumen y confirmar que las mixtas históricas **reflejan su desglose
  inmediatamente**, sin paso de migración ni backfill.
- Confirmar que los valores de `byCardProcessor` y el **efectivo del arqueo no
  cambiaron** respecto de antes del release (no se rompió lo que ya andaba).

## 3. Visibilidad de deuda (US2)

Cliente con: una venta a crédito puro de **100.000** + una mixta con porción fiada
de **30.000**.
- **Fiados Pendientes (CxC)**: el cliente aparece con su **saldo deudor correcto**
  y una columna **"Origen mixta" = 30.000** (rotulada como generación histórica,
  distinta del saldo vivo).
- **Ficha del cliente**: en el historial, la venta a crédito puro muestra **"Fiado
  en esta venta 100.000"** y la mixta **"Fiado en esta venta 30.000"** (etiquetado
  consistente; es el fiado original, no el saldo pendiente).
- Cross-check: Σ "Fiado en esta venta" de la ficha == `credit_generated +
  mixed_credit_generated` del CxC para ese cliente.

## 4. Listado y export (US3)

- **Filtro "Solo ventas con fiado"**: incluye tanto el crédito puro como la mixta
  con porción fiada (antes el filtro "Fiado" excluía las mixtas).
- **Fila de la mixta**: muestra el desglose por método (al menos "Fiado Gs
  30.000") sin abrir el detalle (FR-008).
- **Export a Excel/PDF**: el archivo trae columnas por método (Efectivo / Tarjeta
  / Transferencia / Fiado) que separan las porciones, no una sola columna "Mixto"
  (FR-010). El total por fila == suma de sus porciones.
- Confirmar que ya **no** aparece el estado muerto "Fiado · Pagado".

## 5. Guard de servidor — fiado sin cliente (FR-013 / SC-009)

- **UI**: en el POS, intentar confirmar una venta con porción a fiado **sin
  cliente** → el botón sigue bloqueado (`CobroModal`), comportamiento actual.
- **Servidor (defensa en profundidad)**: invocar `createSale` con un payload que
  tenga porción `method='credit'` (o `payment_method='credit'`) y `customerId`
  null → debe **rechazar con el Error** y no escribir ninguna fila (transacción
  revertida). Probar también crédito puro sin cliente.
- **No-regresión**: una venta con cliente y porción fiada, y una venta sin fiado
  (efectivo/tarjeta/transferencia o mixta sin crédito), se registran **idénticas**
  a hoy.

## 6. Edge cases a tocar al menos una vez

- Venta mixta **anulada**: excluida de todos los desgloses y totales (FR-012).
- Mixta con **dos porciones del mismo método** (efectivo + efectivo): se suman en
  un solo bucket, no aparecen dos líneas.
- Mixta con **descuento**: las porciones suman el total neto; los buckets cuadran.
- Cliente con **saldo a favor** que hace mixta con fiado: el "Fiado en esta venta"
  muestra la porción bruta; el saldo del card refleja el efecto neto.

## Definición de "hecho"

- [ ] Gates de build en verde (typecheck:node, typecheck:web, lint).
- [ ] Caso canónico (§1) cuadra: 150.000 / 130.000 / 20.000, suma == neto.
- [ ] Efectivo del Resumen == efectivo de la Caja (§1).
- [ ] DB existente sin migración; arqueo y tarjeta sin cambios (§2).
- [ ] CxC + ficha muestran origen de mixtas (§3).
- [ ] Listado + filtro + export con desglose (§4).
- [ ] Guard FR-013 rechaza fiado sin cliente, no rompe ventas legítimas (§5).
- [ ] Edge cases §6 verificados.
