# Quickstart — Manual QA

**Feature**: 007-receipt-share
**Run command**: `npm run dev`
**Pre-requisitos**: DB con al menos un cliente con teléfono (`+595981123456`),
un producto con stock, y `business_name`/`business_phone` cargados en
Configuración.

Estos pasos manuales cubren los 4 user stories de la spec. No hay test
automatizado para UI — cumplir todos = feature lista para merge.

---

## US1 — Enviar comprobante por WhatsApp (P1)

### Caso A: cliente con teléfono cargado

1. Loguearse como cajero. Abrir caja.
2. Crear venta con 1–3 productos (alguno con promo si querés validar FR-009 acá).
3. Asociar un cliente que tenga teléfono cargado (p.ej. "Juan Pérez +595981...").
4. Cobrar (efectivo o mixto, da igual).
5. En el modal post-venta, pulsar **"Enviar por WhatsApp"**.
6. **Esperado**: se abre el cliente WhatsApp (Desktop o Web) con el chat del
   número correcto y el mensaje pre-completado mostrando el comprobante
   completo: header del negocio, ticket #, fecha, items con cantidad y precio,
   total, método de pago, vuelto (si efectivo), "¡Gracias por su compra!".
7. Verificar que `Ahorrás Gs.` aparece si la venta tenía un producto promo.
8. Verificar que cada método aparece detallado si la venta fue mixta.
9. En la DB, comprobar que hay una fila nueva en `action_logs` con
   `action='sale.share'`, `details.channel='whatsapp'` y el `target` correcto.

### Caso B: cliente sin teléfono (o "Consumidor final")

1. Repetir 1–4 pero sin cliente asociado (o con cliente sin teléfono).
2. Pulsar **"Enviar por WhatsApp"**.
3. **Esperado**: aparece un modal pequeño pidiendo el número de destino.
4. Ingresar `0981 123 456` (formato local) → debería normalizar a `595981123456`.
5. Pulsar "Continuar".
6. **Esperado**: idéntico al Caso A desde el paso 6.

### Caso C: número inválido

1. Repetir 1–4 sin cliente.
2. Pulsar **"Enviar por WhatsApp"** → modal de número.
3. Ingresar `abc` o vacío o `12`.
4. **Esperado**: el botón "Continuar" queda deshabilitado o muestra mensaje
   "Número inválido"; no se abre WhatsApp.

---

## US2 — Descargar comprobante como imagen PNG (P2)

1. Repetir el flujo de venta de US1 hasta el modal post-venta.
2. Pulsar **"Descargar imagen"**.
3. **Esperado**: se descarga `comprobante-<id>.png` a la carpeta de Descargas
   del sistema.
4. Abrir el archivo:
   - Texto legible, monospace, columnas alineadas.
   - Mismas líneas que se ven en la vista previa del modal.
   - Si la venta tenía promo, la línea "Ahorrás Gs." aparece.
   - Si la venta fue mixta, los métodos aparecen detallados.
5. Verificar fila nueva en `action_logs` con `channel='image'`, `target=null`.

---

## US3 — Descargar comprobante como PDF (P2)

### Caso A: desde modal post-venta (regresión)

1. Cerrar una venta como en US1.
2. Pulsar **"Descargar PDF"** (botón que ya existía).
3. **Esperado**: se descarga `comprobante-<id>.pdf` con el mismo contenido del
   ticket (regresión del comportamiento existente, no debe haber cambiado).
4. Verificar fila nueva en `action_logs` con `channel='pdf'`, `target=null`.
   **Nota**: si el botón pre-existente no llamaba a `logShare`, la fila aparece
   por primera vez ahora — es la nueva instrumentación, no un cambio funcional.

### Caso B: desde detalle de venta en historial (ver US4)

Ver pasos en US4.

---

## US4 — Compartir / descargar desde historial (P3)

1. Cerrar al menos 1 venta antes de empezar este test (p.ej. la de US1).
2. Ir a **Listado de Ventas**.
3. Abrir el detalle de una venta cualquiera.
4. Verificar que aparecen los 3 botones: **WhatsApp**, **PDF**, **Imagen**.
5. **WhatsApp**: pulsar → comportamiento idéntico a US1 (incluido fallback a
   modal de número si el cliente no tenía teléfono).
6. **PDF**: pulsar → descarga `comprobante-<id>.pdf`.
7. **Imagen**: pulsar → descarga `comprobante-<id>.png`.
8. Cada acción registra una nueva fila en `action_logs`.

### Caso especial: venta anulada

1. Tomar una venta anulada (anular una de prueba primero si hace falta).
2. Abrir su detalle.
3. Pulsar cualquiera de los 3 botones de compartir.
4. **Esperado**: el comprobante (en los 3 formatos) muestra la línea
   `*** ANULADA ***` centrada al inicio del cuerpo.

---

## Edge cases — chequeos rápidos

| Caso                                                       | Pasos rápidos                                                             | Esperado                                                                                  |
|------------------------------------------------------------|---------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| Venta con 50+ ítems                                        | Crear venta muy larga, pulsar WhatsApp                                    | Toast "El comprobante es muy largo para WhatsApp. Descargá el PDF o la imagen…"; no se abre WhatsApp. |
| Caracteres especiales (ñ, tildes) en producto              | Crear producto "Pollo a la parrilla — niño"; venderlo; compartir WhatsApp | El mensaje pegado en WhatsApp muestra correctamente los caracteres.                       |
| Sin internet, descargar PDF/imagen                         | Desconectar wifi; cerrar venta; bajar PDF y PNG                           | Ambas descargas funcionan offline.                                                        |
| Sin internet, abrir WhatsApp                               | Desconectar wifi; intentar WhatsApp                                       | La URL se abre igual; WhatsApp Web/Desktop mostrará su propio error de conexión.          |
| `business_name`/`business_phone` vacíos en Configuración   | Vaciar los campos en Configuración; cobrar; compartir                     | Comprobante se genera; las líneas vacías se omiten; no aparece "undefined".               |
| Compartir la misma venta dos veces                         | Pulsar WhatsApp dos veces seguidas                                        | Dos filas independientes en `action_logs`.                                                |
| Cliente con `phone` en formato raro (`(0981) 555-1234`)    | Asociar cliente; pulsar WhatsApp                                          | Se normaliza a `595981551234` antes de abrir; WhatsApp recibe el número limpio.           |

---

## Verificación de regresión

Antes de cerrar el ticket de la feature:

- [ ] El botón **"Imprimir"** del modal post-venta sigue funcionando (envía a la
      impresora térmica si está configurada). NO debe haber cambiado nada del
      flujo de impresión.
- [ ] El comprobante térmico que sale por la impresora (cuando la haya) es
      byte-idéntico al de antes de esta feature (mismo `renderTicket` →
      mismo `print:ticket` IPC).
- [ ] `npm run typecheck` pasa en limpio.
- [ ] `npm run lint` pasa en limpio.
- [ ] Build de release (`npm run build`) compila sin warnings nuevos.
