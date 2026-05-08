import * as usersQuery from '../db/queries/users'
import { registerAuthorized, listRegisteredChannels } from '../auth/guard'
import { getRule } from '../auth/matrix'
import { recordLogin, clearBySender } from '../auth/session'
import { isRecoveryMode, refreshRecoveryMode } from '../auth/recovery'

export function registerUsersIpc(): string[] {
  const before = listRegisteredChannels().length

  registerAuthorized('users:getAll', getRule('users:getAll'), () => usersQuery.getAllUsers())

  registerAuthorized('users:getActive', getRule('users:getActive'), () =>
    usersQuery.getActiveUsers()
  )

  registerAuthorized('users:getById', getRule('users:getById'), (_event, _ctx, id: number) =>
    usersQuery.getUserById(id)
  )

  registerAuthorized(
    'users:login',
    getRule('users:login'),
    (event, _ctx, userId: number, pin: string) => {
      const user = usersQuery.loginUser(userId, pin)
      if (user && event.sender?.id != null) {
        recordLogin(event.sender.id, user.id)
      }
      return user
    }
  )

  registerAuthorized('users:logout', getRule('users:logout'), (event) => {
    if (event.sender?.id != null) clearBySender(event.sender.id)
    return { ok: true as const }
  })

  registerAuthorized(
    'users:create',
    getRule('users:create'),
    (_event, _ctx, data: { name: string; role: string; pin: string }) => {
      // FR-022: in recovery mode, only admin accounts may be created.
      const payload = isRecoveryMode() ? { ...data, role: 'admin' } : data
      const created = usersQuery.createUser(payload)
      // Close the recovery window the moment an admin lands.
      refreshRecoveryMode()
      return created
    }
  )

  registerAuthorized(
    'users:update',
    getRule('users:update'),
    (
      _event,
      ctx,
      id: number,
      data: { name?: string; role?: string; pin?: string; active?: boolean }
    ) => {
      // T019 / R8: when the self branch matched (caller is the target AND not
      // an admin), only pin_hash may change. Reject any payload that touches
      // role/active/name. Throws an application error (NOT AuthError) so the
      // audit row already recorded by the guard stays as outcome='allowed'
      // but the operation fails — callers see a clear validation message.
      const isSelfNonAdmin = ctx.userId === id && ctx.role !== 'admin'
      if (isSelfNonAdmin) {
        const forbidden = ['name', 'role', 'active'] as const
        for (const key of forbidden) {
          if (data[key] !== undefined) {
            throw new Error(
              `Solo un administrador puede modificar el campo "${key}". Para cambiar tu PIN, usá Mi perfil.`
            )
          }
        }
      }
      const updated = usersQuery.updateUser(id, data)
      // active=false on self or any state change may require recovery refresh.
      if (data.active === false || data.role !== undefined) refreshRecoveryMode()
      return updated
    }
  )

  return listRegisteredChannels().slice(before)
}
