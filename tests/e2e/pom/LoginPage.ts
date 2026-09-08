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
    await expect(this.page.getByText(/Configurar primer administrador/i)).toBeVisible({
      timeout: 15_000
    })
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
    await this.page
      .getByRole('button', { name: new RegExp(name, 'i') })
      .first()
      .click()
  }

  /**
   * Enters a 6-digit PIN. The login screen's PIN input uses placeholder
   * "••••••". The non-keypad mode renders a standard <Input>; the keypad
   * mode renders an sr-only <input> with aria-label="PIN" — we fall back
   * to that one if the visible placeholder field isn't found.
   */
  async enterPin(pin: string): Promise<void> {
    const placeholder = this.page.getByPlaceholder('••••••').first()
    if (await placeholder.isVisible().catch(() => false)) {
      await placeholder.fill(pin)
      return
    }
    await this.page.getByLabel(/^PIN$/i).fill(pin)
  }

  /** Submits the login. The "Ingresar" button is the canonical submit. */
  async submit(): Promise<void> {
    await this.page.getByRole('button', { name: /Ingresar/i }).click()
  }

  /**
   * Convenience composition for the common case "I know the user, here's
   * the PIN, log me in".
   */
  async loginAs(userName: string, pin: string): Promise<void> {
    await this.selectUser(userName)
    await this.enterPin(pin)
    await this.submit()
    // Wait for the post-login route. The renderer redirects to
    // /caja/apertura when no register is open, otherwise to /dashboard.
    // We accept any in-app route as long as the login screen is no longer
    // visible (the "Seleccione su usuario" text is gone).
    await expect(this.page.getByText(/Seleccione su usuario/i)).toBeHidden({
      timeout: 15_000
    })
  }

  /**
   * Click "Cerrar sesión" from anywhere in the app and wait for the login
   * screen to reappear.
   *
   * The sidebar's logout handler triggers a synchronous zustand reset plus a
   * hash navigation (`#/login`). On Windows CI the HashRouter remount + the
   * LoginPage useEffect IPC fan-out (users.getActive, auth.recoveryNeeded,
   * settings.getAll) can take several seconds when the suite has been
   * running for a while. We first wait for the URL to settle on /login,
   * then for the user-selection header — both with the same 20 s ceiling
   * the playwright.config.ts comment warns about.
   */
  /** Closes an auto-opened @reactour/tour, if any, so its mask stops
   *  intercepting clicks. No-op when no tour is showing. */
  private async dismissTour(): Promise<void> {
    const mask = this.page.locator('.reactour__mask')
    if ((await mask.count()) === 0) return
    const close = this.page.locator('.reactour__close-button')
    if ((await close.count()) > 0) await close.first().click()
    else await this.page.keyboard.press('Escape')
    await mask.waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {})
  }

  async logout(): Promise<void> {
    const button = this.page.getByRole('button', { name: /Cerrar sesión/i })
    await this.dismissTour()
    try {
      await button.click({ timeout: 5_000 })
    } catch {
      // A page tour auto-opens ~600 ms after the screen mounts and its mask
      // swallows pointer events. On a loaded machine the tour can win the race
      // against this click; dismiss it and try once more.
      await this.dismissTour()
      await button.click()
    }
    await this.page.waitForURL(/#\/login$/, { timeout: 20_000 })
    await expect(this.page.getByText(/Seleccione su usuario/i)).toBeVisible({
      timeout: 20_000
    })
  }
}
