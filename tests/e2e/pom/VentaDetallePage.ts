import { expect, type Page } from '@playwright/test'

/**
 * Page Object for the sale detail / cancellation page at /ventas/:id.
 *
 * Covers the new "Anular" flow added in 002-review-fixes US3, including
 * the MixedCancellationModal branch.
 */
export class VentaDetallePage {
  constructor(private readonly page: Page) {}

  /** Navigates by sale id via in-app routing (hash route). */
  async open(saleId: number): Promise<void> {
    await this.page.evaluate((id) => {
      window.location.hash = `/ventas/${id}`
    }, saleId)
    await expect(this.page.getByText(new RegExp(`Venta #${saleId}`, 'i'))).toBeVisible({
      timeout: 10_000
    })
  }

  /** Asserts the Anular button is visible (admin/supervisor only). */
  async assertCanCancel(): Promise<void> {
    await expect(this.page.getByRole('button', { name: /Anular/i })).toBeVisible()
  }

  async assertCannotCancel(): Promise<void> {
    await expect(this.page.getByRole('button', { name: /Anular/i })).toHaveCount(0)
  }

  /**
   * Click Anular for a non-mixed sale; the global ConfirmHost dialog opens.
   * Confirms via the visible "Anular" danger button.
   */
  async cancelNonMixed(): Promise<void> {
    await this.page.getByRole('button', { name: /Anular/i }).click()
    // ConfirmHost danger button uses the same "Anular" label per the test plan.
    await this.page
      .getByRole('button', { name: /^Anular$/i })
      .last()
      .click()
    await this.assertCancelled()
  }

  /**
   * Click Anular for a mixed-payment sale; the MixedCancellationModal opens.
   * Pass `refund=true` to apply the credit refund, `false` to leave the
   * balance unchanged.
   */
  async cancelMixed(refund: boolean): Promise<void> {
    await this.page.getByRole('button', { name: /Anular/i }).click()
    await expect(this.page.getByText(/Anular venta mixta/i)).toBeVisible()
    const label = refund ? /Devolver crédito/i : /No devolver/i
    await this.page.getByRole('button', { name: label }).click()
    await this.assertCancelled()
  }

  /** Waits until the page reflects the cancelled status badge.
   *  The badge text is exactly "Anulada"; we use exact: true so the audit
   *  log line "Venta #N anulada" does not match.
   */
  async assertCancelled(): Promise<void> {
    await expect(this.page.getByText('Anulada', { exact: true })).toBeVisible({
      timeout: 10_000
    })
  }
}
