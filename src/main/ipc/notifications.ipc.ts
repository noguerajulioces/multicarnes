import { Notification } from 'electron'
import iconPng from '../../../resources/icon.png?asset'
import { registerAuthorized, listRegisteredChannels } from '../auth/guard'
import { getRule } from '../auth/matrix'

export function registerNotificationsIpc(): string[] {
  const before = listRegisteredChannels().length
  registerAuthorized(
    'notify:show',
    getRule('notify:show'),
    (_event, _ctx, title: string, body: string) => {
      if (!Notification.isSupported()) return false
      const n = new Notification({ title, body, icon: iconPng, silent: false })
      n.show()
      return true
    }
  )
  return listRegisteredChannels().slice(before)
}
