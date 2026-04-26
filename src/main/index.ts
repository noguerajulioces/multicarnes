import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDatabase } from './db'
import { registerUsersIpc } from './ipc/users.ipc'
import { registerProductsIpc } from './ipc/products.ipc'
import { registerSalesIpc } from './ipc/sales.ipc'
import { registerCustomersIpc } from './ipc/customers.ipc'
import { registerCashIpc } from './ipc/cash.ipc'
import { registerPurchasesIpc } from './ipc/purchases.ipc'
import { registerReportsIpc } from './ipc/reports.ipc'
import { registerBackupIpc } from './ipc/backup.ipc'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.multicarnes.pos')

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
