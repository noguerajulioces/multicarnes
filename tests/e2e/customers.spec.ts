import { test } from '@playwright/test'


test.describe('Customers', () => {

  test.fixme('customer-8-1 — create customer with name only (P2)', async () => {
    // Steps: /clientes → "Nuevo Cliente" → name only → submit.
    // Expected: customer appears in the list.
  })

  test.fixme('customer-8-2 — create employee customer (P2)', async () => {
    // Steps: as above, tick "Es empleado".
    // Expected: list shows "Empleado" badge.
  })

  test.fixme('customer-8-3 — cannot delete customer with sales history (P2)', async () => {
    // Preconditions: customer has 1 credit sale.
    // Steps: delete attempt.
    // Expected: toast shows reason; customer NOT deleted.
  })

  test.fixme('customer-8-4 — register payment decreases balance (P2)', async () => {
    // Preconditions: customer balance ₲100,000.
    // Steps: ficha → "Registrar Pago" → ₲40,000.
    // Expected: balance drops to ₲60,000.
  })

  test.fixme('customer-8-5 — delete payment refunds balance (P3)', async () => {
    // Preconditions: customer balance ₲60,000 with one ₲40,000 payment.
    // Steps: edit payment → "Eliminar".
    // Expected: balance back to ₲100,000.
  })

  test.fixme('customer-8-6 — cashier blocked from customer CRUD (P3)', async () => {
    // Preconditions: cashier logged in.
    // Expected: sidebar has no "Clientes" entry; direct nav blocked.
  })
})
