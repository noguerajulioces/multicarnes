import { ipcMain, Notification } from 'electron'

export function registerNotificationsIpc(): void {
  ipcMain.handle('notify:show', (_, title: string, body: string) => {
    if (!Notification.isSupported()) return false
    const n = new Notification({ title, body, silent: false })
    n.show()
    return true
  })
}
