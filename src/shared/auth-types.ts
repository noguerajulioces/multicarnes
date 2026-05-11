// Shared types for the authorization layer. Used by main, preload, and renderer.

export type Role = 'admin' | 'supervisor' | 'cajero'

export type AuthOutcome =
  | 'allowed'
  | 'blocked-no-user'
  | 'blocked-inactive'
  | 'blocked-insufficient-role'

export type AuthRule =
  | { kind: 'public' }
  | { kind: 'self-only'; selfArgIndex?: number }
  | { kind: 'self-or-roles'; roles: Role[]; selfArgIndex?: number }
  | { kind: 'privileged'; roles: Role[]; recoveryOnly?: boolean }

export interface AuthAuditEntry {
  id: number
  operation: string
  claimedUserId: number | null
  resolvedUserId: number | null
  resolvedRole: Role | null
  outcome: AuthOutcome
  senderId: number | null
  createdAt: string
  userName?: string | null
}

export interface AuthAuditFilters {
  from?: string
  to?: string
  userId?: number
  operation?: string
  outcome?: AuthOutcome
  limit?: number
  offset?: number
}

export interface AuthAlert {
  id: number
  userId: number
  userName: string
  windowStart: string
  failureCount: number
  acknowledgedAt: string | null
}

export interface AuthMatrixSummaryEntry {
  operation: string
  kind: AuthRule['kind']
  roles?: Role[]
  recoveryOnly?: boolean
  selfArgIndex?: number
}

// Stable error-envelope payload used by registerAuthorized when rejecting calls.
export interface AuthErrorEnvelope {
  __authError: true
  outcome: Exclude<AuthOutcome, 'allowed'>
  operation: string
  message: string
}
