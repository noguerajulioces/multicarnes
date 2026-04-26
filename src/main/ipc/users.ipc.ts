import { ipcMain } from 'electron'
import * as usersQuery from '../db/queries/users'

export function registerUsersIpc(): void {
  ipcMain.handle('users:getAll', () => usersQuery.getAllUsers())
  ipcMain.handle('users:getActive', () => usersQuery.getActiveUsers())
  ipcMain.handle('users:getById', (_, id: number) => usersQuery.getUserById(id))
  ipcMain.handle('users:login', (_, userId: number, pin: string) => usersQuery.loginUser(userId, pin))
  ipcMain.handle('users:create', (_, data) => usersQuery.createUser(data))
  ipcMain.handle('users:update', (_, id: number, data) => usersQuery.updateUser(id, data))
}
