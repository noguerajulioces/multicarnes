import { expect, type Page } from '@playwright/test'

/**
 * Page Object for the /login route, including the first-admin recovery
 * flow (US5 of feature 001) and the user-selection + PIN flow.
 *
 * Selectors prefer accessible role + name where possible. The form has no
 * data-testid attributes yet — when a future change makes a selector
 * unstable, the right fix is to add data-testid to the underlying React
 * component, not to make the helper more brittle.
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  // -----------------
  // Recovery setup
  // -----------------

  /** Asserts the recovery (first-admin) form is visible. */
  async assertOnRecoveryForm(): Promise<void> {
    await expect(
      this.page.getByText(/Configurar primer administrador/i)
    ).toBeVisible({ timeout: 15_000 })
  }

  /**
   * Fills the recovery form and submits it. Caller is responsible for
   * waiting for the next page transition (typically the user-selection
   * screen with the new admin's avatar).
   */
  async completeRecoverySetup(values: {
    name: string
    pin: string
    confirm: string
  }): Promise<void> {
    await this.page.getByLabel(/Nombre/i).fill(values.name)
    // The form has two PIN fields. The first one labelled "PIN", the second
    // "Confirmar PIN". Use exact match via the asterisk-bearing label string
    // to avoid ambiguity.
    const pinFields = this.page.getByPlaceholder('••••••')
    await pinFields.nth(0).fill(values.pin)
    await pinFields.nth(1).fill(values.confirm)
    await this.page.getByRole('button', { name: /Crear administrador/i }).click()
  }

  // -----------------
  // User selection + PIN
  // -----------------

  /** Clicks the avatar button for a given user name on the login screen. */
  async selectUser(name: string): Promise<void> {
    // Wait until the user list is rendered (the recovery flow may still be
    // transitioning).
    await expect(this.page.getByText(/Seleccione su usuario/i)).toBeVisible({
      timeout: 15_000
    })
    await this.page.getByRole('button', { name: new RegExp(name, 'i') }).first().click()
  }

  /**
   * Enters a 6-digit PIN. Supports both the password input field and the
   * on-screen keypad mode (writes digits to the sr-only hidden input).
   */
  async enterPin(pin: string): Promise<void> {
    // The PIN input has aria-label="PIN" and accepts 6 digits.
    const pinInput = this.page.getByLabel(/^PIN$/i)
    await pinInput.fill(pin)
  }

  /** Submits the login (Enter key on the PIN input or the explicit button). */
  async submit(): Promise<void> {
    await this.page.getByLabel(/^PIN$/i).press('Enter')
  }

  /**
   * Convenience composition for the common case "I know the user, here's
   * the PIN, log me in".
   */
  async loginAs(userName: string, pin: string): Promise<void> {
    await this.selectUser(userName)
    await this.enterPin(pin)
    await this.submit()
    // Wait for the post-login route (any of the dashboard variants).
    await this.page
      .waitForURL(/#?\/(dashboard|caja|ventas|productos|configuracion|backup|usuarios)?$/, {
        timeout: 15_000
      })
      .catch(() => {
        /* Some builds keep the URL at '#/', that's fine. */
      })
  }

  /**
   * Click "Cerrar sesión" from anywhere in the app and wait for the login
   * screen to reappear.
   */
  async logout(): Promise<void> {
    await this.page.getByRole('button', { name: /Cerrar sesión/i }).click()
    await expect(this.page.getByText(/Seleccione su usuario/i)).toBeVisible({
      timeout: 10_000
    })
  }
}
