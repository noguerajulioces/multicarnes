# Contract: Formato del mensaje de WhatsApp

**Feature**: 007-receipt-share
**Producer**: `buildWhatsAppMessage(ticket: RenderedTicket): string` en
`src/renderer/src/lib/whatsapp-share.ts`

---

## Estructura del mensaje

El mensaje es la concatenación de `RenderedTicket.lines[].text` con separador
`'\n'` (newline). El alineado a columnas monoespaciado se preserva como
caracteres ASCII, así que el destinatario lee el comprobante en formato similar
al ticket impreso.

```
MULTICARNES
Av. Mariscal López 1234
Tel: (021) 555-1234
------------------------------------------------
TICKET #1248             15/05/2026 14:32
Cajero: Marta R.
Cliente: Juan Pérez
------------------------------------------------
Asado de tira
  1.250 x 32.000                       40.000
Pechuga de pollo
  2 x 18.500                           37.000
------------------------------------------------
Subtotal                               80.000
Ahorrás Gs.                            -3.000
TOTAL Gs.                              77.000
------------------------------------------------
Pago: Efectivo
Recibido                              100.000
Vuelto                                 23.000

           ¡Gracias por su compra!
```

---

## URL final

```
https://wa.me/<phone>?text=<encoded>
```

Donde:

- `<phone>` = string de dígitos puros (sin `+`, sin espacios), p.ej. `595981123456`.
- `<encoded>` = `encodeURIComponent(message)`. Convierte newlines a `%0A`,
  espacios a `%20`, ñ/tildes a su escape UTF-8.

---

## Reglas

1. **Sin formato Markdown ni HTML**: WhatsApp no interpreta `**bold**` ni
   monospace por código. Las líneas `bold: true` y `emphasized: true` del
   `RenderedTicket` se ignoran al construir el texto plano — el contenido sigue
   ahí, sólo no se destaca.
2. **Preservar alineación monoespaciada**: el `text` de cada `TicketLine` ya
   viene con padding de espacios (ver `renderTicket()`). NO recortar ni hacer
   trim. WhatsApp renderiza con fuente proporcional, así que la alineación
   "perfecta" se pierde, pero el mensaje sigue siendo legible.
3. **Sin emojis, sin caracteres de control fuera de `\n`**.
4. **Límite de longitud**: la URL completa (`https://wa.me/<phone>?text=<encoded>`)
   no debe superar 1900 caracteres. Si supera, `shareOnWhatsApp` retorna
   `{ ok: false, reason: 'too_long' }` y el caller muestra el toast definido
   en FR-012.
5. **Marca "ANULADA"**: si el caller decide que la venta es anulada, debe
   anteponer al `lines` (antes de pasarlo al builder) algo como:

   ```ts
   { text: '*** ANULADA ***', align: 'center', bold: true }
   ```

   El builder no decide esto; sólo serializa lo que recibe.

---

## API

```ts
// src/renderer/src/lib/whatsapp-share.ts

export function buildWhatsAppMessage(ticket: RenderedTicket): string

export function buildWhatsAppUrl(
  ticket: RenderedTicket,
  phone: string  // ya normalizado
):
  | { ok: true; url: string }
  | { ok: false; reason: 'too_long' }

export function shareOnWhatsApp(
  ticket: RenderedTicket,
  phone: string  // ya normalizado
):
  | { ok: true }
  | { ok: false; reason: 'too_long' }
// Internamente arma la URL y llama window.open(url, '_blank').
```

---

## Comportamiento de apertura

`window.open(url, '_blank')` → atrapado por `setWindowOpenHandler` en
[src/main/index.ts:125](../../src/main/index.ts#L125) → `shell.openExternal(url)`
→ el sistema operativo decide qué cliente abre la URL `wa.me`:

- WhatsApp Desktop instalado → se abre con el chat al número y el mensaje
  pegado, esperando el "Enviar" del usuario.
- Sin WhatsApp Desktop → browser por defecto → WhatsApp Web → escaneo QR si la
  sesión no está activa.
- Móvil (no aplica acá, pero el formato es portátil): app de WhatsApp.

**El sistema NO envía el mensaje automáticamente**. La acción siempre exige el
"Enviar" final del cajero. Esto es intencional: cumple expectativas legales
(no enviamos mensajes a usuarios sin consentimiento) y operacionales (el
cajero puede agregar contexto al mensaje antes de enviarlo).
