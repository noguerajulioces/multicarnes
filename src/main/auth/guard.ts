// registerAuthorized() — the only path through which IPC handlers should be
// registered going forward. Ensures every privileged call is identified,
// re-resolved, evaluated against the matrix, audited, and either invoked or
// uniformly rejected.

import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { getDb } from '../db'
import { getRule } from './matrix'
import { getBySender } from './session'
import { recordDecision } from './audit'
import { isRecoveryMode } from './recovery'
import type { AuthErrorEnvelope, AuthOutcome, AuthRule, Role } from '../../shared/auth-types'

export interface AuthContext {
  userId: number | null
  role: Role | null
}

export class AuthError extends Error {
  outcome: Exclude<AuthOutcome, 'allowed'>
  operation: string
  envelope: AuthErrorEnvelope

  constructor(operation: string, outcome: Exclude<AuthOutcome, 'allowed'>) {
    const message = messageForOutcome(outcome)
    super(message)
    this.name = 'AuthError'
    this.outcome = outcome
    this.operation = operation
    this.envelope = {
      __authError: true,
      outcome,
      operation,
      message
    }
  }
}

function messageForOutcome(outcome: Exclude<AuthOutcome, 'allowed'>): string {
  switch (outcome) {
    case 'blocked-no-user':
      return 'No tenés sesión iniciada para realizar esta acción.'
    case 'blocked-inactive':
      return 'Tu usuario está desactivado. Pedile a un administrador que lo reactive.'
    case 'blocked-insufficient-role':
      return 'No tenés permiso para realizar esta acción.'
    default: {
      // Exhaustiveness guard — never reached at runtime.
      const _exhaustive: never = outcome
      return _exhaustive
    }
  }
}

interface ResolvedUser {
  id: number
  role: Role
  active: number
}

function resolveUser(userId: number | null): ResolvedUser | null {
  if (userId == null) return null
  return (
    (getDb().prepare('SELECT id, role, active FROM users WHERE id = ?').get(userId) as
      | ResolvedUser
      | undefined) ?? null
  )
}

interface DecisionResult {
  allowed: boolean
  outcome: AuthOutcome
  resolvedUserId: number | null
  resolvedRole: Role | null
  resolvedActive: boolean
  ctx: AuthContext
}

function evaluate(rule: AuthRule, args: unknown[], resolved: ResolvedUser | null): DecisionResult {
  const resolvedUserId = resolved?.id ?? null
  const resolvedRole = resolved?.role ?? null
  const resolvedActive = resolved?.active === 1
  const ctx: AuthContext = { userId: resolvedUserId, role: resolvedRole }

  // Public is always allowed regardless of caller identity.
  if (rule.kind === 'public') {
    return {
      allowed: true,
      outcome: 'allowed',
      resolvedUserId,
      resolvedRole,
      resolvedActive,
      ctx
    }
  }

  // Recovery-only override: allow privileged calls without a session when in
  // recovery mode (zero active admins). Used by users:create during first run.
  if (rule.kind === 'privileged' && rule.recoveryOnly && isRecoveryMode()) {
    return {
      allowed: true,
      outcome: 'allowed',
      resolvedUserId,
      resolvedRole,
      resolvedActive,
      ctx
    }
  }

  if (resolvedUserId == null) {
    return {
      allowed: false,
      outcome: 'blocked-no-user',
      resolvedUserId,
      resolvedRole,
      resolvedActive,
      ctx
    }
  }
  if (!resolvedActive) {
    return {
      allowed: false,
      outcome: 'blocked-inactive',
      resolvedUserId,
      resolvedRole,
      resolvedActive,
      ctx
    }
  }

  if (rule.kind === 'privileged') {
    if (resolvedRole && rule.roles.includes(resolvedRole)) {
      return {
        allowed: true,
        outcome: 'allowed',
        resolvedUserId,
        resolvedRole,
        resolvedActive,
        ctx
      }
    }
    return {
      allowed: false,
      outcome: 'blocked-insufficient-role',
      resolvedUserId,
      resolvedRole,
      resolvedActive,
      ctx
    }
  }

  // self-only / self-or-roles
  const selfArgIndex = rule.selfArgIndex ?? 0
  const target = args[selfArgIndex]
  const targetUserId =
    typeof target === 'number' ? target : Number.isFinite(Number(target)) ? Number(target) : null
  const isSelf = targetUserId != null && targetUserId === resolvedUserId

  if (rule.kind === 'self-only') {
    if (isSelf) {
      return {
        allowed: true,
        outcome: 'allowed',
        resolvedUserId,
        resolvedRole,
        resolvedActive,
        ctx
      }
    }
    return {
      allowed: false,
      outcome: 'blocked-insufficient-role',
      resolvedUserId,
      resolvedRole,
      resolvedActive,
      ctx
    }
  }

  // self-or-roles
  const roleAllowed = resolvedRole != null && rule.roles.includes(resolvedRole)
  if (isSelf || roleAllowed) {
    return {
      allowed: true,
      outcome: 'allowed',
      resolvedUserId,
      resolvedRole,
      resolvedActive,
      ctx
    }
  }
  return {
    allowed: false,
    outcome: 'blocked-insufficient-role',
    resolvedUserId,
    resolvedRole,
    resolvedActive,
    ctx
  }
}

export type AuthorizedHandler<TArgs extends unknown[], TResult> = (
  event: IpcMainInvokeEvent,
  ctx: AuthContext,
  ...args: TArgs
) => TResult | Promise<TResult>

const registeredChannels: string[] = []

export function listRegisteredChannels(): string[] {
  return [...registeredChannels]
}

// Auditoría selectiva. Los intentos BLOQUEADOS se registran siempre (alimentan
// las alertas de repetición y el rastro de accesos denegados). De las
// operaciones PERMITIDAS sólo se registran las mutaciones sensibles de abajo;
// las lecturas (getAll/getById/búsquedas/reportes) no se auditan, para no
// inflar auth_audit ni encarecer cada IPC con una escritura síncrona.
//
// Excluidas a propósito porque ya tienen su propio registro de negocio:
// sales:create→sales, customers:addPayment→customer_payments,
// cash:*→cash_movements, purchases:*→purchase_orders. Punto de extensión: si
// una operación permitida necesita rastro de autorización, se agrega su canal acá.
const AUDIT_ALLOWED_OPERATIONS = new Set<string>([
  'sales:cancel',
  'cashMovements:void',
  'customers:voidPayment',
  'customers:delete',
  'users:create',
  'users:update',
  'backup:restore',
  'backup:create',
  'settings:set',
  'products:adjustStock'
])

function shouldAudit(outcome: AuthOutcome, channel: string): boolean {
  if (outcome !== 'allowed') return true // todo bloqueo, siempre
  return AUDIT_ALLOWED_OPERATIONS.has(channel) // de lo permitido, sólo lo sensible
}

export function registerAuthorized<TArgs extends unknown[], TResult>(
  channel: string,
  rule: AuthRule,
  handler: AuthorizedHandler<TArgs, TResult>
): void {
  registeredChannels.push(channel)

  ipcMain.handle(channel, async (event, ...args: TArgs) => {
    const senderId = event.sender?.id ?? null
    const session = senderId != null ? getBySender(senderId) : undefined
    const claimedUserId = session?.userId ?? null
    const resolved = resolveUser(claimedUserId)

    const decision = evaluate(rule, args, resolved)

    if (shouldAudit(decision.outcome, channel)) {
      recordDecision({
        operation: channel,
        senderId,
        claimedUserId,
        resolvedUserId: decision.resolvedUserId,
        resolvedActive: decision.resolvedActive,
        resolvedRole: decision.resolvedRole,
        outcome: decision.outcome,
        decidedAt: new Date().toISOString()
      })
    }

    if (!decision.allowed) {
      throw new AuthError(channel, decision.outcome as Exclude<AuthOutcome, 'allowed'>)
    }

    return handler(event, decision.ctx, ...args)
  })
}

export function registerPublic<TArgs extends unknown[], TResult>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => TResult | Promise<TResult>
): void {
  registerAuthorized<TArgs, TResult>(channel, getRule(channel), (event, _ctx, ...args) =>
    handler(event, ...args)
  )
}
