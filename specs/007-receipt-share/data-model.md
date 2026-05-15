# Phase 1 — Data Model

**Feature**: 007-receipt-share
**Date**: 2026-05-15

Esta feature **no introduce nuevas tablas ni columnas**. Reutiliza el modelo
existente y agrega una nueva acción a `action_logs`.

---

## Entidades reutilizadas (sin cambios)

### Sale (`sales` + `sale_items` + `sale_payments`)

Fuente: `src/main/db/queries/sales.ts`, tipos en `@shared/types`.

Atributos relevantes consumidos por la feature:

- `id`, `created_at`, `user_name`, `customer_id`, `customer_name`
- `subtotal`, `discount`, `total`
- `payment_method`, `payment_processor`, `payment_reference`
- `items[]` (con `product_name`, `quantity`, `unit_price`, `subtotal`,
  `normal_price` para promo)
- `payments[]` (cuando es mixto)
- `voided` / `status` (para marcar "ANULADA" si corresponde — verificar el
  campo exacto durante la implementación; spec lo da por existente)

No se agregan columnas. El comprobante se arma íntegramente con campos ya
persistidos.

### Customer (`customers`)

Atributo consumido: `phone` (string, opcional).

Si `customer.phone` está presente y validable por `normalizePhone()`, se usa
como destinatario de WhatsApp pre-completado. Si no, el flujo cae a entrada
manual.

### AppSetting

Claves consumidas (todas ya existentes):

- `business_name`
- `business_address`
- `business_phone`
- `thermal_printer_width` (58 o 80, define `cols` en `renderTicket`)

### action_logs (extensión, no migración)

Schema actual (ver `src/main/db/schema.ts:165`):

```sql
CREATE TABLE IF NOT EXISTS action_logs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,             -- JSON serializado
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Nueva acción registrada por esta feature**:

| Campo        | Valor                                                                                                                                                  |
|--------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| `action`     | `'sale.share'`                                                                                                                                         |
| `details`    | JSON: `{ "saleId": <number>, "channel": "whatsapp" \| "pdf" \| "image", "target": <string\|null> }`                                                    |
| `user_id`    | Usuario autenticado en sesión (ctx.userId del IPC)                                                                                                     |
| `created_at` | DEFAULT — momento del clic                                                                                                                              |

Notas:

- `target` sólo se completa cuando `channel === 'whatsapp'`; contiene el número
  normalizado (sólo dígitos). Para `pdf` / `image` queda `null`.
- Se registra UNA fila por acción de compartir. Si el cajero comparte la misma
  venta por WhatsApp dos veces, se registran dos filas.

---

## Modelos in-memory (renderer-side, no persistidos)

### `RenderedTicket` (reuso)

Ya definido en [src/renderer/src/lib/ticket.ts:45](../../src/renderer/src/lib/ticket.ts#L45):

```ts
interface RenderedTicket {
  width: 58 | 80
  cols: number
  lines: TicketLine[]
}

interface TicketLine {
  text: string
  bold?: boolean
  align?: 'left' | 'center' | 'right'
  emphasized?: boolean
  parts?: { left: string; right: string }
}
```

Esta misma estructura alimenta los tres canales:

- **Texto WhatsApp**: une `lines.map(l => l.text).join('\n')`, sin formato bold
  ni emphasized (WhatsApp ignora monospace plano; el alineado a columnas
  monoespaciado se preserva como caracteres).
- **PNG**: dibuja cada línea en canvas con la fuente y estilo correspondiente.
- **PDF**: ya funciona (`downloadTicketPdf` en `ticket-pdf.ts`).

### `NormalizedPhone` (nuevo, renderer)

```ts
type NormalizedPhone =
  | { ok: true; phone: string }     // dígitos puros sin '+', ej. "595981123456"
  | { ok: false; reason: 'empty' | 'invalid_chars' | 'too_short' | 'too_long' }
```

Producido por `normalizePhone(input: string)` en `src/renderer/src/lib/phone.ts`.

### `WhatsAppShareResult` (nuevo, renderer)

```ts
type WhatsAppShareResult =
  | { ok: true }
  | { ok: false; reason: 'too_long' | 'invalid_phone' }
```

Producido por `shareOnWhatsApp(ticket, phone)` en
`src/renderer/src/lib/whatsapp-share.ts`.

---

## State transitions

Ninguna entidad cambia de estado. La feature es **read + audit-write only**:

- Lee: `sales`, `sale_items`, `sale_payments`, `customers`, `app_settings`.
- Escribe: una fila en `action_logs` por acción de compartir.

---

## Constraints derivadas de los requerimientos

- **FR-009 (Ahorrás)**: la lógica de promo savings ya está en
  [ticket.ts:162-179](../../src/renderer/src/lib/ticket.ts#L162-L179) y se
  hereda automáticamente en los tres canales al reutilizar `renderTicket`.
- **FR-010 (Pago mixto)**: ídem — `ticket.ts:202-212` ya enumera `payments[]`.
- **FR-011 (ANULADA)**: las funciones `shareOnWhatsApp`, `downloadTicketImage`,
  `downloadTicketPdf` reciben el `RenderedTicket` ya armado; el caller (modal
  post-venta o detalle de venta) decide si anteponer la línea de marca según
  `sale.voided`/equivalente.
- **FR-014 (campos vacíos)**: `renderTicket` ya hace `if (business.name)` /
  `if (business.address)` / `if (business.phone)` antes de pushar las líneas,
  así que no hay riesgo de "undefined" en la salida.
