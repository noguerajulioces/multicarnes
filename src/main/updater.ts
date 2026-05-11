import { app, dialog, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'

log.transports.file.level = 'info'
autoUpdater.logger = log

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0] ?? null
}

export function initAutoUpdater(): void {
  // Auto-update is only meaningful in packaged builds.
  if (!app.isPackaged) {
    log.info('[updater] skipped: app is not packaged')
    return
  }

  autoUpdater.on('error', (err) => {
    log.error('[updater] error', err)
  })

  autoUpdater.on('update-available', (info) => {
    log.info('[updater] update available', info.version)
  })

  autoUpdater.on('update-not-available', () => {
    log.info('[updater] no updates')
  })

  autoUpdater.on('update-downloaded', async (info) => {
    log.info('[updater] downloaded', info.version)
    const win = getMainWindow()
    const { response } = await dialog.showMessageBox(win ?? undefined!, {
      type: 'info',
      buttons: ['Reiniciar ahora', 'Más tarde'],
      defaultId: 0,
      cancelId: 1,
      title: 'Actualización disponible',
      message: `Multicarnes POS ${info.version} se descargó.`,
      detail: 'Reiniciá la aplicación para aplicar la actualización.'
    })
    if (response === 0) {
      autoUpdater.quitAndInstall()
    }
  })

  autoUpdater.checkForUpdates().catch((err) => {
    log.error('[updater] checkForUpdates failed', err)
  })
}
