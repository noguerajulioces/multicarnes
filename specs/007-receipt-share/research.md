# Phase 0 — Research

**Feature**: 007-receipt-share
**Date**: 2026-05-15

Resuelve las decisiones técnicas con suficiente nivel de detalle para que Phase 1
pueda producir contratos y data-model sin ambigüedad.

---

## Decisión 1 — Cómo generar la imagen PNG del comprobante

**Decision**: Renderizar a `<canvas>` usando **Canvas 2D API nativa** del browser
(disponible en el renderer de Electron), iterando sobre `RenderedTicket.lines` y
dibujando cada línea con `ctx.fillText`. Exportar como `Blob` con
`canvas.toBlob(cb, 'image/png')` y disparar la descarga con un anchor temporal.

**Rationale**:

- **No agrega dependencias** (Principio I: locked stack). El stack aprobado no
  incluye `html2canvas` ni `dom-to-image`.
- Mirror exacto del enfoque de `ticket-pdf.ts`: ambas funciones reciben el mismo
  `RenderedTicket` y recorren `lines[]`. Cero divergencia visual entre PDF e
  imagen.
- Fuente monoespaciada (Courier o el equivalente del sistema) para que la
  alineación de columnas del ticket (left/right, `parts`) se preserve igual que
  en el PDF.
- Rendimiento: dibujar ~40 líneas de texto sobre un canvas es O(n) trivial,
  <50 ms en hardware típico de POS.

**Alternatives considered**:

- `html2canvas` sobre el componente `Ticket.tsx`: rechazada — nueva dependencia
  prohibida por Principio I; introduce un parser de DOM/CSS pesado para un caso
  donde el modelo ya está en líneas planas.
- Re-aprovechar el PDF y convertirlo a imagen via `pdfjs`: aún más dependencias,
  más latencia, ningún beneficio.
- Generar SVG y luego rasterizar: complejidad sin valor.

**Implementation notes**:

- Ancho del canvas: derivado de `RenderedTicket.width` (58 o 80 mm) escalado a
  pixeles a ~3.78 px/mm (96 dpi). Para 80 mm → ~302 px de ancho; oversample 2×
  para nitidez → 604 px width interno, mostrado al 50 %.
- Alto: `lines.length * lineHeight + márgenes`, con `lineHeight ≈ 16 px`.
- Fondo blanco, texto negro, `font: '13px/16px "Courier New", monospace'`.
- Líneas `bold: true` con `font-weight: bold`; `emphasized: true` con tamaño +1.

---

## Decisión 2 — Cómo abrir WhatsApp desde el renderer sin nueva IPC

**Decision**: Usar `window.open('https://wa.me/<phone>?text=<encoded>', '_blank')`
desde el renderer. El handler `setWindowOpenHandler` registrado en
[src/main/index.ts:125](../../src/main/index.ts#L125) ya intercepta y delega a
`shell.openExternal(details.url)`, devolviendo `{ action: 'deny' }` para no
abrir una segunda BrowserWindow.

**Rationale**:

- Cero código nuevo en main para la apertura — el handler ya estaba en el
  proyecto desde antes (verificado en línea 125–128).
- Mantiene Principio IV: el renderer NO importa `shell`, `child_process` ni
  `electron`. Solo llama a `window.open`, un API estándar del browser.
- Comportamiento esperado por el usuario final: `wa.me` abre WhatsApp Desktop
  si está instalado; si no, abre WhatsApp Web en el browser del sistema.
- Funciona también en Windows/Linux/macOS sin código condicional.

**Alternatives considered**:

- Nueva IPC `shell:openExternal(url)`: redundante, dado que el handler ya
  existe; agrega superficie IPC sin beneficio.
- `location.href = 'whatsapp://send?...'`: schema custom, no estandarizado,
  inconsistente entre plataformas y versiones del cliente.

**Implementation notes**:

- Sanitizar el `phone` a sólo dígitos antes de armarlo (ver Decisión 3).
- `encodeURIComponent(message)` para el texto, preserva saltos de línea como
  `%0A` y caracteres especiales (ñ, tildes).
- Capturar el caso `phone === ''` antes de construir la URL → mostrar modal de
  entrada manual.

---

## Decisión 3 — Normalización y validación de números de teléfono

**Decision**: Función pura `normalizePhone(input: string): { ok: true, phone: string } | { ok: false, reason: string }`
en `src/renderer/src/lib/phone.ts`:

1. Quitar todo lo que no sea dígito o `+` (espacios, guiones, paréntesis, puntos).
2. Si empieza con `+`, conservar el código de país tal cual; sacar el `+` final.
3. Si empieza con `00`, reemplazar por nada (notación internacional alternativa).
4. Si empieza con `0`, asumir local Paraguay → sacar el `0` inicial y anteponer
   `595`.
5. Si NO empieza con `+`, `00` ni `0` y tiene 9 dígitos típicos paraguayos
   (ej. `981 123 456` → `981123456`), anteponer `595`.
6. Validar longitud final entre 9 y 15 dígitos (rango razonable internacional E.164).
7. Devolver el string sólo-dígitos (sin `+`) — es el formato que `wa.me` acepta.

**Rationale**:

- Paraguay-first porque es el deployment target (constitution V.b habla de
  contexto local). Acepta gracilmente números ya con código de país por si el
  cliente carga `+595981...` o `+5491134...` (cliente argentino, etc.).
- Función pura → testeable, sin side-effects, sin imports de stores ni UI.
- Estricta en longitud para evitar abrir WhatsApp con basura y mostrar un error
  al usuario en su lugar.

**Alternatives considered**:

- `libphonenumber-js`: nueva dependencia con bundle ~150 KB — rechazada por
  Principio I para un caso donde la heurística simple cubre el 99 % del uso
  paraguayo.
- No validar y dejar que WhatsApp falle: peor UX, el usuario ya tocó "Enviar".

**Implementation notes**:

- Default country code expuesto como const `DEFAULT_COUNTRY_CODE = '595'` para
  que un día se pueda cambiar sin tocar la heurística.
- Tests con casos: `'0981 123 456'`, `'+595 981 123 456'`, `'981 123 456'`,
  `'(0981) 123-456'`, `'00595981123456'`, `'abc'`, `''`, `'12'`.

---

## Decisión 4 — Logging de auditoría: nueva IPC `sales:logShare`

**Decision**: Agregar una IPC nueva `sales:logShare({ saleId, channel, target })`
donde `channel ∈ {'whatsapp','pdf','image'}` y `target` es el número (si
`channel='whatsapp'`) o `null`. El handler inserta una fila en `action_logs` con
`user_id = ctx.userId`, `action = 'sale.share'`, `details = JSON({saleId, channel, target})`.

**Rationale**:

- FR-013 exige auditoría; sin IPC, el renderer no puede escribir `action_logs`
  (Principio III: schema knowledge no sale del repo layer).
- Una IPC dedicada es más explícita que sobrecargar una existente y permite
  testear el contrato de manera aislada.
- El patrón es idéntico al usado por `cash-movements.ipc.ts` (línea 247) y otras
  IPC de auditoría — no es abstracción nueva.

**Alternatives considered**:

- Loguear desde el componente con `console.log` o store local: no cumple FR-013
  (queremos persistencia en `action_logs`).
- Piggyback en `sales:getById` (loguear cada lectura del comprobante): rompe la
  semántica del action_log — distinguir "vi el comprobante" de "lo compartí" es
  útil para auditoría y soporte.

**Implementation notes**:

- El handler valida que `saleId` existe (fail si no) pero NO valida que el sale
  pertenezca al user — un supervisor puede re-enviar comprobantes de otros
  cajeros (caso de uso real: el cliente vuelve y pide su ticket).
- `target` se persiste tal como vino del renderer ya normalizado, para que la
  auditoría refleje qué número se usó.
- Si `channel='whatsapp'` y `target` queda vacío, igual se registra — la
  auditoría capta la intención aun si la apertura falló.

---

## Decisión 5 — Detección de mensaje demasiado largo

**Decision**: Antes de construir la URL `wa.me`, calcular el largo de
`encodeURIComponent(message)` y verificar que `https://wa.me/<phone>?text=<encoded>`
no supere **1900 caracteres**. Si supera, mostrar un toast: "El comprobante es
muy largo para WhatsApp. Descargá el PDF o la imagen y compartilo manualmente."

**Rationale**:

- `wa.me` no documenta un límite oficial, pero en la práctica URLs ≥2048 chars
  fallan en algunos browsers (IE/Edge legacy) y mobile clients. 1900 deja
  margen para el dominio + número + slashes + querystring.
- FR-012 lo exige.
- Cae con gracia ofreciendo los otros dos canales que no tienen ese límite.

**Alternatives considered**:

- Partir el mensaje en chunks y abrir múltiples WhatsApp consecutivos: terrible
  UX, rompe el flujo del cajero.
- Resumir el mensaje (sólo total, sin items) cuando es muy largo: pierde
  información clave del comprobante.

**Implementation notes**:

- El cálculo se hace una vez en `buildWhatsAppUrl(...)`; si supera el límite la
  función devuelve `{ ok: false, reason: 'too_long' }` y el caller decide qué
  toast mostrar.
- Casos reales que disparan esto: ventas mayoristas con 80+ líneas — raro pero
  posible.

---

## Decisión 6 — Punto de acceso desde el historial (US4)

**Decision**: Agregar los 3 botones (WhatsApp / Imagen / PDF) en
[VentaDetallePage.tsx](../../src/renderer/src/modules/ventas-listado/VentaDetallePage.tsx),
ubicados con los controles de acción existentes (presumiblemente "Imprimir",
"Anular"). Reutiliza exactamente las mismas funciones que el modal post-venta
(`shareOnWhatsApp`, `downloadTicketImage`, `downloadTicketPdf`).

**Rationale**:

- US4 lo pide explícitamente.
- Como las funciones son puras (`RenderedTicket` → acción), no hay nada que
  duplicar — sólo cablear los botones.
- Permite re-compartir ventas pasadas sin tocar el flujo post-venta.

**Alternatives considered**:

- Página nueva "Compartir comprobante": agrega navegación innecesaria para una
  acción de 1 clic.
- Solo desde el modal post-venta (descartar US4): cae bajo prioridad P3,
  podría diferirse — pero como el costo marginal es bajo (cableado) y la spec
  lo lista, lo incluimos en esta iteración.

**Implementation notes**:

- Para una venta anulada, anteponer una línea visible "*** ANULADA ***" en el
  array `lines` antes de pasar al renderer (afecta texto WhatsApp, PNG y PDF).
- Reuso de `business` (settings) y `width` (config thermal) igual que en el
  modal post-venta.
