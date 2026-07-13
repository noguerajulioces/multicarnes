import { app, shell, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import iconPng from '../../resources/icon.png?asset'
import iconIco from '../../resources/icon.ico?asset'
import { initDatabase, getImagesDir } from './db'
import { registerUsersIpc } from './ipc/users.ipc'
import { registerProductsIpc } from './ipc/products.ipc'
import { registerSalesIpc } from './ipc/sales.ipc'
import { registerCustomersIpc } from './ipc/customers.ipc'
import { registerCashIpc } from './ipc/cash.ipc'
import { registerCashMovementsIpc } from './ipc/cash-movements.ipc'
import { registerPurchasesIpc } from './ipc/purchases.ipc'
import { registerReportsIpc } from './ipc/reports.ipc'
import { registerBackupIpc } from './ipc/backup.ipc'
import { registerNotificationsIpc } from './ipc/notifications.ipc'
import { registerPrintIpc } from './ipc/print.ipc'
import { registerHeldTicketsIpc } from './ipc/held-tickets.ipc'
import { registerAuthIpc } from './ipc/auth.ipc'
import { listRegisteredChannels } from './auth/guard'
import { assertMatrixCoverage } from './auth/self-test'
import { installSessionListeners } from './auth/session'
import { refreshRecoveryMode } from './auth/recovery'
import { initAutoUpdater } from './updater'
import { pathToFileURL } from 'url'

let splashWindow: BrowserWindow | null = null
let splashShownAt = 0

// Module-scoped so the single-instance 'second-instance' handler can reach the
// live window to restore/focus it. Nulled on 'closed'.
let mainWindow: BrowserWindow | null = null

// Minimum time the splash stays visible after it actually appears, in ms.
// If the renderer is ready sooner, we wait this long; if it takes longer,
// no extra delay is added.
const SPLASH_MIN_MS = 1500
const SPLASH_FADE_MS = 250

function createSplash(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    center: true,
    show: false,
    backgroundColor: '#CC1C1C'
  })
  splash.loadFile(join(__dirname, '../../resources/splash.html'))
  splash.once('ready-to-show', () => {
    splashShownAt = Date.now()
    splash.show()
  })
  return splash
}

function closeSplashWithFade(onClosed: () => void): void {
  if (!splashWindow || splashWindow.isDestroyed()) {
    onClosed()
    return
  }
  const win = splashWindow
  const steps = 10
  const stepMs = SPLASH_FADE_MS / steps
  let i = 0
  const tick = (): void => {
    if (!win || win.isDestroyed()) {
      onClosed()
      return
    }
    i += 1
    win.setOpacity(Math.max(0, 1 - i / steps))
    if (i >= steps) {
      win.close()
      splashWindow = null
      onClosed()
      return
    }
    setTimeout(tick, stepMs)
  }
  setTimeout(tick, stepMs)
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    icon: process.platform === 'win32' ? iconIco : iconPng,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  mainWindow = win

  win.on('ready-to-show', () => {
    const elapsed = splashShownAt > 0 ? Date.now() - splashShownAt : SPLASH_MIN_MS
    const remaining = Math.max(0, SPLASH_MIN_MS - elapsed)
    setTimeout(() => {
      // The window may have been closed (quit during splash, e2e teardown,
      // OS-initiated kill) while this timeout was queued — accessing the
      // BrowserWindow after destruction throws "Object has been destroyed".
      if (win.isDestroyed()) return
      closeSplashWithFade(() => {
        if (win.isDestroyed()) return
        win.maximize()
        win.show()
      })
    }, remaining)
  })

  win.on('maximize', () => {
    if (win.isDestroyed()) return
    win.webContents.send('window:state', true)
  })
  win.on('unmaximize', () => {
    if (win.isDestroyed()) return
    win.webContents.send('window:state', false)
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Clear the module reference so 'second-instance' / 'activate' know to recreate.
  win.on('closed', () => {
    mainWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerWindowControlsIpc(): void {
  const focused = (): BrowserWindow | null => BrowserWindow.getFocusedWindow()
  ipcMain.handle('window:minimize', () => focused()?.minimize())
  ipcMain.handle('window:maximizeToggle', () => {
    const w = focused()
    if (!w) return false
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
    return w.isMaximized()
  })
  ipcMain.handle('window:close', () => focused()?.close())
  ipcMain.handle('window:isMaximized', () => focused()?.isMaximized() ?? false)
}

// Register custom protocol to serve product images
protocol.registerSchemesAsPrivileged([
  { scheme: 'product-img', privileges: { bypassCSP: true, supportFetchAPI: true } }
])

// Single-instance lock: the app must not run 2+ times. Users who minimize the
// window and relaunch should be returned to the existing window rather than
// spawning a duplicate (a second instance would also fight over the SQLite
// file). Requested synchronously before whenReady, as Electron requires.
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // Another instance already owns the lock — quit immediately and skip all
  // boot work (DB, IPC, window). Electron forwards this launch to the primary
  // instance via the 'second-instance' event registered below.
  app.quit()
} else {
  app.on('second-instance', () => {
    // Fired in the PRIMARY instance when a second launch is attempted: restore
    // (if minimized) and focus the existing window instead of opening another.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    } else {
      // Edge (macOS): the window was closed but the app is still running.
      createWindow()
    }
  })

  app
    .whenReady()
    .then(onAppReady)
    .catch((err) => {
      console.error('[boot] application initialization failed:', err)
      app.exit(1)
    })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}

async function onAppReady(): Promise<void> {
  electronApp.setAppUserModelId('com.multicarnes.pos')

  // macOS dev: the Dock takes the icon from the Electron binary's bundle, not
  // from BrowserWindow. Override it so the Multicarnes icon shows during dev.
  if (is.dev && process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(iconPng)
  }

  // Show splash while DB and IPC initialize
  splashWindow = createSplash()

  // Handle product-img:// protocol
  protocol.handle('product-img', (request) => {
    const filename = decodeURIComponent(request.url.replace('product-img://', ''))
    const filePath = join(getImagesDir(), filename)
    return net.fetch(pathToFileURL(filePath).toString())
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database
  await initDatabase()

  // Refresh recovery-mode flag based on the current user table; allow the
  // matrix's recoveryOnly modifier (users:create) to flip public when the
  // database has zero active admins.
  refreshRecoveryMode()

  // Bind session-cleanup listener for webContents destruction.
  installSessionListeners()

  // Register IPC handlers
  registerUsersIpc()
  registerProductsIpc()
  registerSalesIpc()
  registerCustomersIpc()
  registerCashIpc()
  registerCashMovementsIpc()
  registerPurchasesIpc()
  registerReportsIpc()
  registerBackupIpc()
  registerNotificationsIpc()
  registerPrintIpc()
  registerHeldTicketsIpc()
  registerAuthIpc()
  registerWindowControlsIpc()

  // Boot self-test: every channel that registered itself with the guard must
  // have a matrix entry. Channels registered via raw ipcMain.handle (window:*,
  // legacy notify:show) are not guarded yet; we only check what the guard
  // sees. Throws → app fails to boot if a developer forgot a matrix entry.
  try {
    assertMatrixCoverage(listRegisteredChannels())
  } catch (err) {
    console.error('[auth] matrix coverage failed:', err)
    // In production we'd show a dialog here; for now, hard-quit so the bug is loud.
    app.exit(1)
    return
  }

  createWindow()

  initAutoUpdater()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}
