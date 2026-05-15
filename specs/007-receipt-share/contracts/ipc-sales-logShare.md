# IPC Contract: `sales:logShare`

**Feature**: 007-receipt-share
**Channel**: `sales:logShare`
**Direction**: Renderer → Main (`ipcRenderer.invoke`)
**Auth**: Requiere sesión activa (ctx.userId presente). El handler rechaza si
no hay usuario autenticado.

---

## Request

```ts
interface LogShareRequest {
  saleId: number
  channel: 'whatsapp' | 'pdf' | 'image'
  target?: string | null   // teléfono normalizado para whatsapp; null/omitido para los otros
}
```

Validación en el handler:

| Campo      | Regla                                                                       | Si falla                                       |
|------------|-----------------------------------------------------------------------------|------------------------------------------------|
| `saleId`   | Integer positivo. La venta debe existir.                                    | Retorna `{ ok: false, error: 'sale_not_found' }`. |
| `channel`  | Uno de `'whatsapp' \| 'pdf' \| 'image'`                                     | Retorna `{ ok: false, error: 'invalid_channel' }`. |
| `target`   | Si `channel === 'whatsapp'`: string de 9–15 dígitos. Si otro: ignorado.     | Retorna `{ ok: false, error: 'invalid_target' }`. |

---

## Response

```ts
type LogShareResponse =
  | { ok: true; logId: number }
  | { ok: false; error: 'sale_not_found' | 'invalid_channel' | 'invalid_target' | 'unauthenticated' }
```

---

## Side-effects

Inserta una fila en `action_logs`:

```sql
INSERT INTO action_logs (user_id, action, details)
VALUES (?, 'sale.share', ?);
```

- `user_id` = `ctx.userId` (del session del IPC handler).
- `details` = `JSON.stringify({ saleId, channel, target: target ?? null })`.

No modifica ninguna otra tabla.

---

## Preload binding

```ts
// src/preload/index.ts
sales: {
  // ...existing methods...
  logShare(req: LogShareRequest): Promise<LogShareResponse>
}
```

```ts
// src/preload/index.d.ts  (dentro de ApiSales)
logShare(req: {
  saleId: number
  channel: 'whatsapp' | 'pdf' | 'image'
  target?: string | null
}): Promise<
  | { ok: true; logId: number }
  | { ok: false; error: 'sale_not_found' | 'invalid_channel' | 'invalid_target' | 'unauthenticated' }
>
```

---

## Caller responsibilities

El renderer DEBE:

1. Llamar a `window.api.sales.logShare(...)` **después** de disparar la acción
   (abrir WhatsApp / iniciar descarga), no antes. Logueamos intención
   consumada, no intención pendiente.
2. NO bloquear el flujo del usuario esperando la respuesta — la llamada es
   fire-and-forget desde el punto de vista UX (un `.catch(console.error)` basta).
3. Para WhatsApp, pasar `target` ya normalizado (`normalizePhone(...)` exitoso).

---

## Test scenarios (manual, en quickstart)

- Compartir por WhatsApp → 1 fila nueva en `action_logs` con
  `action='sale.share'` y `details.channel='whatsapp'` con el `target` correcto.
- Descargar PDF → 1 fila con `channel='pdf'` y `target=null`.
- Descargar imagen → 1 fila con `channel='image'` y `target=null`.
- Re-compartir la misma venta dos veces → 2 filas independientes.
- `saleId` inexistente → respuesta `{ok:false, error:'sale_not_found'}`; sin
  fila escrita.
