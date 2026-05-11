import { expect, type Page } from '@playwright/test'

/**
 * Page Object for the persistent sidebar navigation. Each method navigates
 * to the corresponding route via the visible link; the test layer should
 * never rely on URL strings directly because the renderer uses hash-based
 * routing in some paths.
 */
export class SidebarNav {
  constructor(private readonly page: Page) {}

  async goToDashboard(): Promise<void> {
    await this.page.getByRole('link', { name: /Dashboard|Inicio/i }).click()
  }

  async goToSales(): Promise<void> {
    // The POS landing is sometimes labelled "Ventas" (POS) and sometimes
    // "Punto de venta" depending on copy iterations. Use whichever is visible.
    const link = this.page
      .getByRole('link', { name: /Ventas|Punto de venta|POS/i })
      .first()
    await link.click()
  }

  async goToSalesList(): Promise<void> {
    await this.page.getByRole('link', { name: /Historial|Ventas listado|Listado/i }).click()
  }

  async goToCustomers(): Promise<void> {
    await this.page.getByRole('link', { name: /Clientes/i }).click()
  }

  async goToProducts(): Promise<void> {
    await this.page.getByRole('link', { name: /Productos/i }).click()
  }

  async goToPurchases(): Promise<void> {
    await this.page.getByRole('link', { name: /Compras/i }).click()
  }

  async goToCash(): Promise<void> {
    await this.page.getByRole('link', { name: /Caja/i }).click()
  }

  async goToReports(): Promise<void> {
    await this.page.getByRole('link', { name: /Reportes/i }).click()
  }

  async goToUsers(): Promise<void> {
    await this.page.getByRole('link', { name: /Usuarios/i }).click()
  }

  async goToBackup(): Promise<void> {
    await this.page.getByRole('link', { name: /Backup/i }).click()
  }

  async goToSettings(): Promise<void> {
    await this.page.getByRole('link', { name: /Configuración|Configuracion/i }).click()
  }

  /**
   * Asserts that the sidebar shows a given module link. Useful to verify
   * that role gating hides/shows the right entries.
   */
  async assertHasLink(name: RegExp): Promise<void> {
    await expect(this.page.getByRole('link', { name })).toBeVisible()
  }

  async assertNoLink(name: RegExp): Promise<void> {
    await expect(this.page.getByRole('link', { name })).toHaveCount(0)
  }
}
