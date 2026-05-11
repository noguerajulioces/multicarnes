// In-memory session map keyed by Electron's webContents.id. Not persisted —
// re-login is required after every app restart (matches the existing behaviour
// of the auth store on the renderer side).

import { app } from 'electron'

export interface AuthSession {
  senderId: number
  userId: number
  loginAt: string
}

const sessions = new Map<number, AuthSession>()

export function recordLogin(senderId: number, userId: number): void {
  sessions.set(senderId, {
    senderId,
    userId,
    loginAt: new Date().toISOString()
  })
}

export function clearBySender(senderId: number): void {
  sessions.delete(senderId)
}

export function clearByUser(userId: number): void {
  for (const [sid, s] of sessions) {
    if (s.userId === userId) sessions.delete(sid)
  }
}

export function getBySender(senderId: number): AuthSession | undefined {
  return sessions.get(senderId)
}

export function clearAll(): void {
  sessions.clear()
}

let listenersInstalled = false
export function installSessionListeners(): void {
  if (listenersInstalled) return
  listenersInstalled = true
  app.on('web-contents-created', (_event, webContents) => {
    webContents.on('destroyed', () => {
      sessions.delete(webContents.id)
    })
  })
}
