import { app, shell, BrowserWindow, protocol, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDatabase, getImagesDir } from './db'
import { registerUsersIpc } from './ipc/users.ipc'
import { registerProductsIpc } from './ipc/products.ipc'
import { registerSalesIpc } from './ipc/sales.ipc'
import { registerCustomersIpc } from './ipc/customers.ipc'
import { registerCashIpc } from './ipc/cash.ipc'
import { registerPurchasesIpc } from './ipc/purchases.ipc'
import { registerReportsIpc } from './ipc/reports.ipc'
import { registerBackupIpc } from './ipc/backup.ipc'
import { registerNotificationsIpc } from './ipc/notifications.ipc'
import { pathToFileURL } from 'url'

let splashWindow: BrowserWindow | null = null

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
  splash.once('ready-to-show', () => splash.show())
  return splash
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    ...(process.platform === 'win32'
      ? {
          titleBarOverlay: {
            color: '#CC1C1C',
            symbolColor: '#FFFFFF',
            height: 36
          }
        }
      : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
    mainWindow.maximize()
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Register custom protocol to serve product images
protocol.registerSchemesAsPrivileged([
  { scheme: 'product-img', privileges: { bypassCSP: true, supportFetchAPI: true } }
])

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.multicarnes.pos')

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
  initDatabase()

  // Register IPC handlers
  registerUsersIpc()
  registerProductsIpc()
  registerSalesIpc()
  registerCustomersIpc()
  registerCashIpc()
  registerPurchasesIpc()
  registerReportsIpc()
  registerBackupIpc()
  registerNotificationsIpc()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
