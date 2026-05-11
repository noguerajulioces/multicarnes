import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '..', '..', '..')
const APP_ENTRY = join(REPO_ROOT, 'out', 'main', 'index.js')

interface LaunchedApp {
  app: ElectronApplication
  window: Page
  userDataDir: string
  /** Disposes the temp userData dir AND closes the app. Always call in afterEach. */
  cleanup: () => Promise<void>
}

/**
 * Launches the packaged Electron app against a fresh, throw-away userData dir.
 * The app boots with an empty database, so the first window shows the recovery
 * (setup-first-admin) flow. Use helpers/setup.ts to walk through it.
 */
export async function launchApp(): Promise<LaunchedApp> {
  const userDataDir = await mkdtemp(join(tmpdir(), 'pos-e2e-'))

  const app = await electron.launch({
    args: [APP_ENTRY, `--user-data-dir=${userDataDir}`],
    // Smoke tests shouldn't be affected by user-level preferences from a
    // developer machine, so we point Electron at a clean profile.
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  })

  // The main window opens after a splash transition (~1.5s). Pick the first
  // BrowserWindow that isn't the splash — the splash is `frame: false` and
  // doesn't expose the full app. We wait for the renderer's React tree.
  const allWindows = await waitForMainWindow(app)
  const window = allWindows

  // Wait until the renderer is fully ready: the login page or the recovery
  // setup form must be in the DOM. Either signals a healthy boot.
  await window.waitForSelector('text=/Configurar primer administrador|Iniciar sesión|Bienvenido/i', {
    timeout: 30_000
  })

  return {
    app,
    window,
    userDataDir,
    cleanup: async () => {
      try {
        await app.close()
      } catch {
        /* app already closed */
      }
      await rm(userDataDir, { recursive: true, force: true })
    }
  }
}

// Wait for the main BrowserWindow (not the splash) to be present.
// Strategy: poll firstWindow() and check its URL is the renderer's index.html.
async function waitForMainWindow(app: ElectronApplication): Promise<Page> {
  // Give the splash time to finish; the main window opens after that.
  const start = Date.now()
  while (Date.now() - start < 30_000) {
    const windows = app.windows()
    for (const w of windows) {
      const url = w.url()
      if (url.includes('index.html') || url.startsWith('http://localhost') || url.includes('renderer')) {
        return w
      }
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('Main renderer window never appeared within 30s')
}

/**
 * Evaluate code in the renderer process. Useful for asserting on store state
 * or calling window.api directly to bypass slow UI navigation.
 *
 * Example:
 *   const list = await ipc(window, () => window.api.heldTickets.list())
 *   const id   = await ipc(window, (arg) => window.api.heldTickets.remove(arg), ticketId)
 */
export function ipc<T>(window: Page, fn: () => T | Promise<T>): Promise<T>
export function ipc<T, Arg>(
  window: Page,
  fn: (arg: Arg) => T | Promise<T>,
  arg: Arg
): Promise<T>
export function ipc<T, Arg>(
  window: Page,
  fn: ((arg: Arg) => T | Promise<T>) | (() => T | Promise<T>),
  arg?: Arg
): Promise<T> {
  if (arg === undefined) {
    return window.evaluate(fn as () => T | Promise<T>)
  }
  return window.evaluate(fn as (arg: Arg) => T | Promise<T>, arg as Arg)
}
