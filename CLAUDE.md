<!-- SPECKIT START -->
Active feature: **009-mixed-payment-breakdown** — hacer visible el desglose de
las ventas mixtas para verificar deuda y conciliar por método. Hoy una mixta se
guarda como `sales.payment_method='mixed'` (etiqueta monolítica) con su desglose
real en `sale_payments`, pero los reportes agregan por la etiqueta sin
explotarlo. Solución de **capa de lectura** que reusa el patrón `UNION ALL` ya
presente (`byCardProcessor`/`otherMethodsTotals`): (1) reescribir `byMethod` de
`salesSummary` para distribuir las porciones a sus buckets reales (el efectivo
del Resumen pasa a usar la misma fórmula que la Caja) + `mixedCount` informativo;
(2) `pendingCredits` gana `credit_generated`/`mixed_credit_generated` y la ficha
etiqueta "Fiado en esta venta" en crédito puro y mixto; (3) `getAllSales` adjunta
`sale_payments` por batch + opt `creditOnly` + `Sale.credit_portion`, con export
por método. Más un guard de servidor en `createSale` (FR-013): toda porción de
crédito —pura o mixta— exige cliente. **Cero IPC nuevas, cero dependencias, cero
migración** (el desglose ya vive en `sale_payments`).

Plan: [specs/009-mixed-payment-breakdown/plan.md](specs/009-mixed-payment-breakdown/plan.md).
Spec: [specs/009-mixed-payment-breakdown/spec.md](specs/009-mixed-payment-breakdown/spec.md).
Análisis: [specs/009-mixed-payment-breakdown/flows.md](specs/009-mixed-payment-breakdown/flows.md).

Prior feature: **008-debt-payment-types** — el modal "Registrar Pago"
del detalle del cliente ofrece dos modos: (1) **Efectivo (afecta caja)**
inserta `customer_payments` + `cash_movements` (income) en la caja
abierta del cobrador, dentro de una única `db.transaction()`; (2)
**Descuento de sueldo (no afecta caja)** sólo inserta `customer_payments`.
Disponible para todos los clientes y los tres roles operativos
(Admin/Supervisor/Cajero — la matriz amplía `customers:addPayment` para
incluir cajero). Migración aditiva v10:
`customer_payments.affects_cash INTEGER NOT NULL DEFAULT 1`, sin backfill
de movimientos históricos. Sin nuevas IPC; el parámetro `affectsCash` se
agrega al payload de `customers:addPayment`.

Plan: [specs/008-debt-payment-types/plan.md](specs/008-debt-payment-types/plan.md).
Spec: [specs/008-debt-payment-types/spec.md](specs/008-debt-payment-types/spec.md).

Prior feature: **007-receipt-share** — entrega del comprobante de venta por
canales alternativos a la impresora térmica (que el cliente todavía no tiene):
(1) WhatsApp como texto plano vía `wa.me/<phone>?text=<encoded>` abierto por
el `setWindowOpenHandler` ya existente en `src/main/index.ts`; (2) descarga
como imagen PNG generada en Canvas 2D (sin nuevas dependencias); (3) descarga
como PDF reutilizando `downloadTicketPdf` existente. Disponible desde el
modal post-venta y desde el detalle de venta en el historial. Una nueva IPC
`sales:logShare` registra cada acción en `action_logs`. Sin migración SQLite,
sin nuevas dependencias.
Reference: [specs/007-receipt-share/](specs/007-receipt-share/).

Earlier feature: **006-notif-read-state** — header notification dropdown gains
a per-user "read" state with inbox semantics: the dropdown lists only rows
with unread alerts, "marks as read" when the dropdown closes, and renders
"Sin notificaciones pendientes" once everything is read. The bell badge
silences after the close and re-lights only when a *new* entity enters the
alert set (a new debtor customer or a new product below min stock).
Renderer-only: `useNotificationStore`
(`src/renderer/src/store/notifications.store.ts`) persists seen IDs to
`localStorage` under `notif:seen:<userId>:<category>` and exposes
`selectUnseenCount` / `selectUnseenForCategory` consumed by
`NotificationBell` in `Header.tsx`. No SQLite migration, no new IPC channels,
no new dependencies.
Reference: [specs/006-notif-read-state/](specs/006-notif-read-state/).

Earlier feature: **005-promotional-pricing** — per-product promo price managed
by Admin/Supervisor and consumed automatically by the POS. Five additive
columns on `products` (toggle, fixed-Gs or %-off, optional date range), a
pure `isPromoActive(product, now)` decision in `src/renderer/src/lib/promo.ts`,
cart lines snapshot the price at add-to-cart, and the receipt prints an
"Ahorrás" totals line when any line was sold under promo. Additive migration
v8; no new IPC channels; reuses existing `products:*` and `action_logs`.
Reference: [specs/005-promotional-pricing/](specs/005-promotional-pricing/).

Earlier feature: **004-logout-cash-close** — block logout when the signed-in
user owns an open cash register, with a one-click shortcut into the existing
close-register flow. Per-user IPC query (`cash:getMyOpenRegister`) scoped to
`ctx.userId`, a `useLogoutGuard` hook that gates `auth.store.logout()`, and a
shared `LogoutBlockedModal`. No schema change; no new dependencies.
Reference: [specs/004-logout-cash-close/](specs/004-logout-cash-close/).

Earlier landed feature: **003-cash-movements-history** — "Movimientos de Caja"
page with server-side pagination, role-aware filters, append-only voiding,
and Excel export. Backed by an additive `cash_movements` migration (v7) plus a
one-time backfill of synthetic opening/closing rows.
Reference: [specs/003-cash-movements-history/](specs/003-cash-movements-history/).

Even earlier (landed): **002-review-fixes** — three correctness fixes from
the round-2 code review (held tickets per-cashier, purchase reception audit
attribution, mixed-payment cancellation UX) plus two fold-ins.
Reference: [specs/002-review-fixes/](specs/002-review-fixes/).

Earliest landed feature: **001-ipc-authorization** — server-side authorization
for privileged operations (US1–US5 + Round-2 cleanups). Manual quickstart
Tests 1–9 deferred until QA runs them against a live build.
Reference: [specs/001-ipc-authorization/](specs/001-ipc-authorization/).

Project-wide context:
- Stack: Electron 39 + React 19 + TypeScript 5.9 + Tailwind v4, better-sqlite3, Zustand.
  See [.specify/memory/constitution.md](.specify/memory/constitution.md) for the
  full set of locked-stack rules and engineering principles (v1.1.0).
- Codebase inventory: [.specify/memory/functional-spec.md](.specify/memory/functional-spec.md).
- Known gaps & risk register: [.specify/memory/gap-analysis.md](.specify/memory/gap-analysis.md).
- All committed docs (README, docs/*.md, specs) are written in English.
<!-- SPECKIT END -->
