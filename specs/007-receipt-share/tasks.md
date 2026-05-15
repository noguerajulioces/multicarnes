---
description: "Task list for feature 007-receipt-share"
---

# Tasks: Compartir Comprobante de Venta

**Input**: Design documents from `/specs/007-receipt-share/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: El proyecto no usa tests automatizados para UI/IPC (constitución v1.1.0, sección "Development Workflow"). La validación se hace manualmente vía [quickstart.md](quickstart.md). No se incluyen tareas de tests unitarios o de integración salvo la suite `npm run typecheck` + `npm run lint`.

**Organization**: Tareas agrupadas por user story para implementación y validación independiente. La spec define 4 user stories: US1 (WhatsApp, P1), US2 (PNG, P2), US3 (PDF, P2), US4 (historial, P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos diferentes, sin dependencias bloqueantes).
- **[Story]**: A qué user story pertenece la tarea (US1, US2, US3, US4). Setup, Foundational y Polish no llevan etiqueta de story.

## Path Conventions

Estructura Electron del proyecto (ver [plan.md](plan.md) sección "Source Code"):

- Renderer puro: `src/renderer/src/lib/`, `src/renderer/src/modules/ventas/`, `src/renderer/src/modules/ventas-listado/`
- Main (handlers + DB): `src/main/ipc/`, `src/main/db/queries/`
- Preload: `src/preload/index.ts` + `src/preload/index.d.ts`
- Tipos compartidos: `src/shared/types.ts`

---

## Phase 1: Setup

**Purpose**: Preparar archivos vacíos para los nuevos módulos puros del renderer. No hay configuración de proyecto ni nuevas dependencias (Principio I).

- [X] T001 Crear los archivos vacíos (con un export placeholder) que se irán llenando: `src/renderer/src/lib/phone.ts`, `src/renderer/src/lib/whatsapp-share.ts`, `src/renderer/src/lib/ticket-image.ts`. Verificar que `npm run typecheck` siga pasando. _(Implícito — los archivos se crearon directamente con contenido en T008/T009/T015.)_

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: La IPC `sales:logShare` la consumen las 3 user stories (US1, US2, US3) para cumplir FR-013. Debe estar entera antes de tocar las stories.

**⚠️ CRITICAL**: Ninguna user story puede empezar hasta que esta fase esté completa, porque cada handler de botón debe llamar a `window.api.sales.logShare(...)`.

- [X] T002 Agregar los tipos del contrato IPC a `src/shared/types.ts`: `ShareChannel = 'whatsapp' | 'pdf' | 'image'`, `LogShareRequest`, `LogShareResponse` según [contracts/ipc-sales-logShare.md](contracts/ipc-sales-logShare.md).
- [X] T003 Implementar `logSaleShare(userId, saleId, channel, target)` en `src/main/db/queries/sales.ts`: valida que el sale exista, inserta en `action_logs` con `action='sale.share'` y `details=JSON({saleId, channel, target})`. Devuelve `{ ok: true, logId }` o `{ ok: false, error }`.
- [X] T004 Registrar el handler `ipcMain.handle('sales:logShare', ...)` en `src/main/ipc/sales.ipc.ts` (vía `registerAuthorized`) + entrada en `src/main/auth/matrix.ts`. Delega a `salesQuery.logSaleShare(...)` con `ctx.userId`.
- [X] T005 [P] Exponer `sales.logShare(req)` en `src/preload/index.ts` (binding `ipcRenderer.invoke('sales:logShare', req)`).
- [X] T006 [P] Agregar el tipo `logShare(...)` dentro de `ApiSales` en `src/preload/index.d.ts` según [contracts/ipc-sales-logShare.md](contracts/ipc-sales-logShare.md).
- [ ] T007 Smoke test manual: abrir DevTools en dev, ejecutar `await window.api.sales.logShare({saleId: 1, channel: 'pdf'})`, verificar en SQLite que aparece una fila nueva en `action_logs` con `action='sale.share'` y `details` correcto. _(Deferido a QA humano — requiere correr la app.)_

**Checkpoint**: La IPC de logging funciona end-to-end. Las stories pueden empezar.

---

## Phase 3: User Story 1 — Enviar por WhatsApp (Priority: P1) 🎯 MVP

**Goal**: El cajero puede entregar el comprobante de una venta recién confirmada vía WhatsApp en texto plano, con el número del cliente pre-completado (o entrada manual si no hay cliente).

**Independent Test**: Confirmar una venta con cliente que tiene teléfono → tocar "Enviar por WhatsApp" en el modal post-venta → WhatsApp Desktop/Web se abre con el chat correcto y el mensaje pegado conteniendo el comprobante completo. Ver [quickstart.md](quickstart.md) US1 Caso A.

### Implementation for User Story 1

- [X] T008 [P] [US1] Implementar `normalizePhone(input: string): NormalizedPhone` en `src/renderer/src/lib/phone.ts` según [research.md](research.md) Decisión 3.
- [X] T009 [P] [US1] Implementar `buildWhatsAppMessage(ticket)`, `buildWhatsAppUrl(ticket, phone)` y `shareOnWhatsApp(ticket, phone)` en `src/renderer/src/lib/whatsapp-share.ts` según [contracts/whatsapp-message-format.md](contracts/whatsapp-message-format.md).
- [X] T010 [US1] Crear `src/renderer/src/modules/ventas/PhoneInputModal.tsx` con input + validación en vivo + botón Continuar deshabilitado mientras el input sea inválido.
- [X] T011 [US1] Extender `src/renderer/src/modules/ventas/TicketPreviewModal.tsx` con el botón "WhatsApp" + handler `handleWhatsApp()` + `dispatchWhatsApp(phone)` que llama `shareOnWhatsApp` y luego `window.api.sales.logShare`.
- [X] T012 [US1] Toast `'El comprobante es muy largo para WhatsApp. Descargá el PDF o la imagen y compartilo manualmente.'` cuando `shareOnWhatsApp` devuelve `{ok:false, reason:'too_long'}` (cumple FR-012).
- [X] T013 [US1] `getSaleById` ampliada con `c.phone AS customer_phone`; `Sale.customer_phone?` agregado a `@shared/types`. Sin migración SQL.
- [ ] T014 [US1] Ejecutar manualmente [quickstart.md](quickstart.md) US1 Casos A, B y C. Verificar que cada acción de WhatsApp registra una fila en `action_logs` con `channel='whatsapp'` y el `target` normalizado. _(Deferido a QA humano.)_

**Checkpoint**: US1 funcional. El cliente ya puede recibir comprobante sin impresora.

---

## Phase 4: User Story 2 — Descargar como imagen PNG (Priority: P2)

**Goal**: El cajero puede bajar el comprobante como PNG para guardar o compartir por cualquier canal alternativo a WhatsApp.

**Independent Test**: Confirmar una venta → tocar "Descargar imagen" → se baja `comprobante-<id>.png` legible con el mismo contenido que la vista previa. Ver [quickstart.md](quickstart.md) US2.

### Implementation for User Story 2

- [X] T015 [P] [US2] Implementar `downloadTicketImage(ticket, fileName)` en `src/renderer/src/lib/ticket-image.ts` con Canvas 2D + oversample 2× (Decisión 1 de research.md).
- [X] T016 [US2] Botón "Imagen" (icono `ImageDown`) en `TicketPreviewModal.tsx` + handler `handleImage()` con `downloadTicketImage` + `logShare({channel:'image'})`.
- [ ] T017 [US2] Ejecutar manualmente [quickstart.md](quickstart.md) US2: descargar PNG de una venta con promo y de una venta con pago mixto, verificar que "Ahorrás Gs." y el desglose de pagos aparecen. Verificar fila en `action_logs` con `channel='image'`, `target=null`. _(Deferido a QA humano.)_

**Checkpoint**: US2 funcional. El comprobante también se puede entregar como imagen.

---

## Phase 5: User Story 3 — Descargar como PDF (Priority: P2)

**Goal**: La descarga de PDF (ya existente en el modal post-venta) ahora también queda auditada en `action_logs`. La capacidad de bajar PDF desde el historial se desbloquea automáticamente vía la reutilización del modal en `VentaDetallePage` (ya cableada — ver [src/renderer/src/modules/ventas-listado/VentaDetallePage.tsx:193](../../src/renderer/src/modules/ventas-listado/VentaDetallePage.tsx#L193)).

**Independent Test**: Bajar PDF desde el modal post-venta y desde el detalle de venta de un histórico → ambos archivos son idénticos en contenido al ticket; cada descarga inserta una fila en `action_logs`. Ver [quickstart.md](quickstart.md) US3.

### Implementation for User Story 3

- [X] T018 [US3] `handlePdf()` ahora llama `logShare({channel:'pdf'})` después de `downloadTicketPdf` (filename actualizado a `comprobante-${sale.id}.pdf` para alinear con la imagen).
- [ ] T019 [US3] Ejecutar manualmente [quickstart.md](quickstart.md) US3 Caso A: confirmar que el botón PDF del modal post-venta sigue funcionando byte-idéntico al comportamiento previo, y que ahora también inserta una fila en `action_logs` con `channel='pdf'`, `target=null`. _(Deferido a QA humano.)_

**Checkpoint**: US3 funcional. La descarga PDF está auditada y el flujo previo no se rompe.

---

## Phase 6: User Story 4 — Acceso desde historial (Priority: P3)

**Goal**: Los 3 canales (WhatsApp, imagen, PDF) están disponibles también desde el detalle de venta en el historial. Esto se obtiene "gratis" porque `VentaDetallePage` ya reusa `TicketPreviewModal` (línea 193); las tareas acá son (1) inyectar la marca "ANULADA" cuando corresponde y (2) validar la reutilización.

**Independent Test**: Abrir cualquier venta vieja desde el listado → tocar los 3 botones de compartir → comportamiento idéntico al modal post-venta. Para una venta anulada, los 3 formatos muestran "*** ANULADA ***". Ver [quickstart.md](quickstart.md) US4.

### Implementation for User Story 4

- [X] T020 [US4] Helper puro `withVoidMarker(ticket, isVoided)` agregado en `TicketPreviewModal.tsx`: antepone una línea centrada `*** ANULADA ***` + separador cuando `sale.status === 'cancelled'`. Como `ticket` se calcula con `useMemo` y se reutiliza en preview, WhatsApp, imagen y PDF, los 4 canales muestran la marca.
- [ ] T021 [US4] Ejecutar manualmente [quickstart.md](quickstart.md) US4 (incluye Caso especial: venta anulada). Verificar que el preview en pantalla, el mensaje WhatsApp, la imagen y el PDF muestran la marca "ANULADA" cuando aplica, y que `closeLabel="Cerrar"` se respeta en `VentaDetallePage` (sin regresión). _(Deferido a QA humano.)_

**Checkpoint**: Las 4 user stories completas; auditoría completa.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: No-regresión, type safety y validación end-to-end.

- [X] T022 [P] `npm run typecheck` (node + web) pasa limpio.
- [X] T023 [P] `npm run lint` pasa con 0 errores; 29 warnings, todos pre-existentes en archivos no tocados (`VentasPage.tsx`, `BackupPage.tsx`, etc.). Cero warnings nuevos introducidos por la feature.

### Bug fixes durante QA

- [X] FIX-001 Bug latente en `ticket-pdf.ts`: el ancho de página se dimensionaba por `mm` físicos del thermal printer (`80mm → 242.77pt`) pero el texto se padding-a a `cols` caracteres (`48 × 5.4pt = 259.2pt`), recortando ~3 chars del borde derecho. Síntomas reportados por el usuario durante T019: `TOTAL Gs.    10` (debía ser `10.000`), `15/05/2026 ` (hora cortada), `Pago: ` (método cortado). Igual problema en `ticket-image.ts` (más visible — recortaba ~7 chars). Fix: dimensionar `widthPt` / `cssWidth` desde `cols × char_advance` en lugar de mm. Constitution-clean: defect fix, no opportunistic edit (Principio VI(a)).
- [~] T024 No-regresión parcial: `npm run build` compila limpio (0 warnings, 0 errors, 8 s). Falta validación manual del flujo de impresión térmica + comparación byte-by-byte del ticket impreso vs el previo — _deferido a QA humano con impresora física._
- [X] T025 Bloque `<!-- SPECKIT START -->` en `CLAUDE.md` apunta a 007-receipt-share, verificado.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias.
- **Foundational (Phase 2)**: Depende de Setup. **Bloquea** todas las user stories porque cada una llama a `window.api.sales.logShare`.
- **User Stories (Phases 3–6)**: Todas dependen de Foundational completo.
  - US1 (P1) es el MVP; debe terminar antes de demostrar valor al cliente.
  - US2 (P2) y US3 (P2) son independientes entre sí y pueden ir en paralelo.
  - US4 (P3) se apoya en US1, US2, US3 ya estando en el modal (necesita que los 3 botones existan en `TicketPreviewModal` para que `VentaDetallePage` los herede).
- **Polish (Phase 7)**: Depende de todas las stories que se quieran shippear.

### User Story Dependencies

- **US1 (P1)**: Depende solo de Foundational (T002–T007). Independientemente testeable.
- **US2 (P2)**: Depende solo de Foundational. Independientemente testeable. **No depende de US1.**
- **US3 (P2)**: Depende solo de Foundational. **No depende de US1 ni US2.** Es la story más liviana (capacidad existente, solo se agrega log).
- **US4 (P3)**: Depende de que las stories que vayan a shippearse junto estén en `TicketPreviewModal` (porque su test valida la reutilización). Si se shippea sólo US1+US4, la heredada será sólo WhatsApp; si se shippea todo, heredan los 3 botones.

### Within Each User Story

- T008, T009 (US1) y T015 (US2) son archivos puros sin imports cruzados → marcados `[P]` y pueden ir en paralelo.
- T010 (PhoneInputModal) bloquea a T011 (botón en TicketPreviewModal) porque T011 lo importa.
- T013 (extender query) puede bloquear T011 si `customer_phone` aún no llega al renderer — hacer T013 antes que el cableado final.
- La validación manual de cada story (T014, T017, T019, T021) cierra esa story.

### Parallel Opportunities

Dentro de Phase 2 (Foundational):

- T005 y T006 son archivos distintos (`preload/index.ts` y `preload/index.d.ts`) → `[P]`.

Entre stories (cuando se hace en equipo, no aplica para un solo dev):

- Después de T007, un dev puede tomar US1 (T008–T014) mientras otro toma US2 (T015–T017) y otro US3 (T018–T019). Convergen en US4.

Dentro de US1:

- T008 (phone.ts) y T009 (whatsapp-share.ts) son archivos distintos sin imports cruzados → `[P]`.

### Parallel Example: User Story 1

```bash
# Lanzar en paralelo (un solo dev puede alternar; en equipo va a 2 personas):
Task: "Implement normalizePhone() in src/renderer/src/lib/phone.ts (T008)"
Task: "Implement buildWhatsAppMessage/Url/share in src/renderer/src/lib/whatsapp-share.ts (T009)"

# Luego en orden:
Task: "Build PhoneInputModal.tsx (T010)"
Task: "Wire WhatsApp button in TicketPreviewModal.tsx (T011)"
Task: "Handle too_long toast (T012)"
Task: "Ensure customer_phone reaches the renderer (T013)"
Task: "Run quickstart US1 (T014)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (T001) — Setup minimal.
2. Phase 2 (T002–T007) — IPC `sales:logShare` end-to-end.
3. Phase 3 (T008–T014) — WhatsApp share.
4. **STOP y VALIDAR**: Quickstart US1 entero, confirmar que el cliente puede recibir comprobante por WhatsApp.
5. Si el cliente acepta el MVP, deployar y pasar a US2/US3/US4.

Este MVP cubre el dolor principal del cliente (no tiene impresora; necesita una vía de entrega). US2, US3 y US4 son enhancements.

### Incremental Delivery

1. Setup + Foundational → infra lista.
2. US1 → entrega MVP por WhatsApp.
3. US2 → agrega imagen PNG.
4. US3 → audita la descarga PDF existente.
5. US4 → habilita re-envío desde historial + marca ANULADA.
6. Polish → typecheck/lint/no-regresión.

Cada paso es deployable de forma independiente.

### Parallel Team Strategy

Con 2 devs:

1. Dev A: Phase 1 + Phase 2 (Foundational).
2. Una vez T007 verde:
   - Dev A: US1 (T008–T014).
   - Dev B: US2 (T015–T017) + US3 (T018–T019).
3. Cualquiera: US4 (T020–T021) — tiene que esperar a que los 3 botones convivan en el modal.
4. Cualquiera: Polish (T022–T025).

---

## Notes

- `[P]` = archivos distintos sin dependencias bloqueantes.
- `[US?]` etiqueta la story a la que pertenece la tarea — útil para trazabilidad PR ↔ spec.
- Cada user story es completable y validable independientemente vía [quickstart.md](quickstart.md).
- Sin tests automatizados: la validación pasa por quickstart + typecheck + lint.
- Commit por tarea o por grupo lógico pequeño (US-tag en el commit message ayuda al review).
- Detener en cada Checkpoint para validar antes de avanzar.
- Evitar: editar `src/renderer/src/lib/ticket.ts` o `ticket-pdf.ts` (Principio VI — preservación de features que funcionan). La feature se construye encima, no en lugar de.
