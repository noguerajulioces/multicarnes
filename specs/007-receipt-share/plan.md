# Implementation Plan: Compartir Comprobante de Venta

**Branch**: `007-receipt-share` (working on `main`) | **Date**: 2026-05-15 | **Spec**: [spec.md](spec.md)
**Input**: [specs/007-receipt-share/spec.md](spec.md)

## Summary

Reemplazar la impresora térmica ausente con tres canales alternativos de entrega
del comprobante de venta: (1) envío por WhatsApp con el comprobante formateado en
texto plano, (2) descarga como imagen PNG, (3) descarga como PDF (ya implementada,
se extiende su disponibilidad al historial). Las tres acciones también quedan
disponibles desde el detalle de venta en el historial (US4). Cada acción se
audita en `action_logs`. No requiere migración de base de datos, no incorpora
nuevas dependencias y no abre nuevos canales IPC sensibles más allá de un
endpoint pequeño para registrar la acción de compartir.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), React 19, Electron 39
**Primary Dependencies**: jspdf (ya instalado, reutilizado), Canvas 2D API nativa
del navegador (para PNG), `setWindowOpenHandler` ya configurado en
`src/main/index.ts:125` (delega `window.open` externo a `shell.openExternal`).
Sin nuevas dependencias.
**Storage**: SQLite (`better-sqlite3`) — sólo escritura en `action_logs`; sin
schema change.
**Testing**: Manual QA por user story (no hay test suite automatizado para UI
en este proyecto). Quickstart documenta los pasos.
**Target Platform**: Aplicación desktop Electron (macOS/Windows/Linux). El link
de WhatsApp abre el cliente disponible (WhatsApp Desktop si está instalado, si
no WhatsApp Web en el browser del sistema).
**Project Type**: Aplicación desktop (Electron renderer + main + preload + shared).
**Performance Goals**: Apertura de WhatsApp en <2 s desde el clic; generación
de PNG/PDF en <500 ms para tickets típicos (<20 ítems).
**Constraints**: URL de `wa.me` ≤ ~2000 caracteres (límite práctico, FR-012).
Sin red para PDF/PNG (offline-capable). El número de teléfono se normaliza
en el renderer antes de enviarse. Sin agregar dependencias (Principio I).
**Scale/Scope**: Pequeño — ~3 funciones puras nuevas en `src/renderer/src/lib/`,
2 botones nuevos en `TicketPreviewModal.tsx`, mismos 2 + reuso del PDF en
`VentaDetallePage.tsx`, 1 nueva IPC `sales:logShare`, 1 modal pequeño para
pedir número manual.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluado contra constitution v1.1.0:

| Principio | Estado | Notas |
|-----------|--------|-------|
| **I. Locked Tech Stack** | ✅ PASS | Cero dependencias nuevas. `jspdf` ya está aprobado; el PNG se renderiza con Canvas 2D nativo; WhatsApp es una URL externa abierta por `shell.openExternal` (vía handler existente). |
| **II. Strict Types & SRP** | ✅ PASS | Tres archivos puros (`whatsapp-share.ts`, `ticket-image.ts`, `phone.ts`) cada uno con una responsabilidad. UI permanece en componentes; orquestación en los modals existentes. |
| **III. Layered Data Access** | ✅ PASS | El nuevo log de auditoría se inserta vía repositorio existente (`src/main/db/queries/`). Los IPC handlers no tocan SQL directo. |
| **IV. Main/Renderer Boundary** | ✅ PASS | Una nueva IPC: `sales:logShare`. Tipada en preload, registrada en main, consumida en renderer vía `window.api.sales.logShare`. `window.open(wa.me/...)` es interceptado por el `setWindowOpenHandler` que ya existe en `src/main/index.ts:125`; no se importa `shell` ni `child_process` desde el renderer. |
| **V.a Hardware en main** | ✅ PASS | Sin cambios en la cadena de impresora térmica. |
| **V.b Formatters en renderer** | ✅ PASS | `ticket-image.ts` y el nuevo generador de texto WhatsApp toman datos de tipos compartidos y devuelven Blob/string. Sin imports de UI o stores. La entrada (`sale`, `business`, teléfono) viene de la SQLite local + entrada manual del cajero (mismo nivel de confianza que los formatters actuales). |
| **VI. Schema & Feature Preservation** | ✅ PASS | Sin migración. El `TicketPreviewModal` existente se extiende con 2 botones nuevos; los botones existentes (PDF / Imprimir) no se modifican. El detalle de venta gana las acciones pero su flujo principal se conserva. |
| **VII. Simplicity & Approval** | ✅ PASS | Reusa `renderTicket()` ya validado para ambos PDF e imagen — sin segundo modelo de datos para el ticket. El "logShare" sigue el patrón ya usado por otras IPC (ej. `cash-movements.ipc.ts`). |

**Gates resolved**: All ✅. No `[NEEDS CLARIFICATION]`. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/007-receipt-share/
├── plan.md              # Este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
│   ├── ipc-sales-logShare.md
│   └── whatsapp-message-format.md
└── checklists/
    └── requirements.md  # Generado por /speckit-specify
```

### Source Code (repository root)

Archivos nuevos:

```text
src/renderer/src/lib/
├── phone.ts               # NEW — normalizar/validar números (+595 default)
├── ticket-image.ts        # NEW — renderiza RenderedTicket → PNG Blob (Canvas 2D)
└── whatsapp-share.ts      # NEW — RenderedTicket + phone → URL wa.me, openExternal
```

Archivos modificados:

```text
src/renderer/src/modules/ventas/
└── TicketPreviewModal.tsx          # Agrega 2 botones (WhatsApp, Imagen)

src/renderer/src/modules/ventas-listado/
└── VentaDetallePage.tsx            # Agrega los 3 botones de compartir + imprimir

src/main/db/queries/
└── sales.ts                        # Agrega logSaleShare(...) que escribe action_logs

src/main/ipc/
└── sales.ipc.ts                    # Registra handler 'sales:logShare'

src/preload/
├── index.ts                        # Expone window.api.sales.logShare
└── index.d.ts                      # Tipo de ApiSales.logShare(...)
```

Archivos NO tocados (preservación):

```text
src/renderer/src/lib/ticket.ts      # renderTicket() es la fuente común — sin cambios
src/renderer/src/lib/ticket-pdf.ts  # downloadTicketPdf() ya funciona — sin cambios
src/main/db/schema.ts               # Sin migración
```

**Structure Decision**: Single Electron project con separación main/preload/renderer/shared
(estructura ya establecida — Principio I no permite reorganizar). Toda la lógica de
formateo del comprobante para los 3 canales vive en `src/renderer/src/lib/` como
módulos puros (data in, blob/string out), exactamente como ya hace
`ticket-pdf.ts`. La única superficie nueva en main es la IPC de logging.

## Complexity Tracking

> No hay violaciones a la constitución. Sin justificaciones de complejidad pendientes.

## Phase 0 — Outline & Research

Ver [research.md](research.md). Resumen de decisiones:

1. **PNG sin nueva dependencia** → Canvas 2D API nativa, replicando el bucle de
   líneas de `ticket-pdf.ts`. Rechazada `html2canvas` (nueva dep, ataca Principio I).
2. **Apertura de WhatsApp desde renderer** → `window.open('https://wa.me/...', '_blank')`
   atrapado por `setWindowOpenHandler` existente; sin nueva IPC para shell.
3. **Normalización de teléfonos** → función pura `normalizePhone()` con `+595` como
   default y validación de longitud razonable (9–14 dígitos).
4. **Logging de auditoría** → una IPC nueva pequeña `sales:logShare(saleId, channel, target?)`
   en lugar de extender una IPC existente — más explícito y testeable.
5. **Detección de mensaje demasiado largo** → contar caracteres después de
   `encodeURIComponent` y avisar si la URL completa supera 1900 caracteres.

## Phase 1 — Design & Contracts

Ver:

- [data-model.md](data-model.md) — entidades reutilizadas y el shape del log de auditoría.
- [contracts/ipc-sales-logShare.md](contracts/ipc-sales-logShare.md) — contrato IPC.
- [contracts/whatsapp-message-format.md](contracts/whatsapp-message-format.md) — formato del texto WhatsApp.
- [quickstart.md](quickstart.md) — pasos manuales de QA, uno por user story.

Re-evaluación post-diseño: los contratos cumplen Principios IV (IPC tipada),
V.b (formatters puros) y VII (mismas funciones puras alimentan tres canales).
**Gates aún ✅.**

Agent context actualizado en `CLAUDE.md` (bloque entre `<!-- SPECKIT START -->`
y `<!-- SPECKIT END -->`) apuntando al nuevo plan y resumiendo la feature.

## Next

Ejecutar `/speckit-tasks` para descomponer en tareas implementables y secuenciadas.
