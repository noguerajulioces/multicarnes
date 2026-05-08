// Authorization matrix — single source of truth (FR-007).
//
// Entries are populated per user-story phase (US1..US5). A channel registered
// without an entry here resolves to the failure-closed default in getRule()
// per FR-008.

import type { AuthRule, AuthMatrixSummaryEntry, Role } from '../../shared/auth-types'

export const FAILURE_CLOSED_DEFAULT: AuthRule = {
  kind: 'privileged',
  roles: [] as Role[]
}

export const AUTH_MATRIX: Record<string, AuthRule> = {
  // Phase 2 / US1 / US2 / US3 / US4 / US5 add their entries here.
  // -------------------------------------------------------------------
  // Authentication & users (US1 + foundational)
  'users:getActive': { kind: 'public' },
  'users:login': { kind: 'public' },
  'users:logout': { kind: 'public' },
  'users:getAll': { kind: 'privileged', roles: ['admin'] },
  'users:getById': { kind: 'self-or-roles', roles: ['admin'], selfArgIndex: 0 },
  'users:create': { kind: 'privileged', roles: ['admin'], recoveryOnly: true },
  'users:update': { kind: 'self-or-roles', roles: ['admin'], selfArgIndex: 0 },

  // Backup & settings (US1)
  'backup:create': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'backup:list': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'backup:restore': { kind: 'privileged', roles: ['admin'] },
  'backup:selectFolder': { kind: 'privileged', roles: ['admin'] },
  'settings:getAll': { kind: 'public' },
  'settings:set': { kind: 'privileged', roles: ['admin'] },

  // Sales (US2)
  'sales:create': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'sales:getById': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'sales:getRecent': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'sales:getByRegister': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'sales:cancel': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'sales:dayTotal': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },

  // Cash (US2)
  'cash:open': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'cash:getCurrent': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'cash:close': { kind: 'privileged', roles: ['admin', 'supervisor'] }, // cashier-self handled in handler
  'cash:addMovement': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'cash:getMovements': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'cash:getSummary': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'cash:getAll': { kind: 'privileged', roles: ['admin', 'supervisor'] },

  // Customers (US2)
  'customers:getAll': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'customers:getById': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'customers:create': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'customers:update': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'customers:delete': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'customers:addPayment': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'customers:updatePayment': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'customers:deletePayment': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'customers:getPayments': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'customers:getSales': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },

  // Products mutating (US2)
  'products:create': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'products:update': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'products:adjustStock': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'products:createCategory': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'products:uploadImage': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'products:pickImage': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'products:saveImageFromPath': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'products:getImagePath': { kind: 'public' },

  // Products read (US3) — cost stripping handled in the handler when role==='cajero'
  'products:getAll': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'products:getById': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'products:getByBarcode': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'products:categories': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'products:lowStock': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'products:movements': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'products:recentSales': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'products:salesStats': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'products:lastPurchase': { kind: 'privileged', roles: ['admin', 'supervisor'] },

  // Suppliers & purchases (US3)
  'suppliers:getAll': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'suppliers:getById': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'suppliers:create': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'suppliers:update': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'purchases:getAll': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'purchases:getById': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'purchases:create': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'purchases:receive': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'purchases:cancel': { kind: 'privileged', roles: ['admin', 'supervisor'] },

  // Reports (US3)
  'reports:salesByPeriod': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'reports:topProducts': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'reports:profitMargin': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'reports:stockMovements': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'reports:cashRegisters': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'reports:pendingCredits': { kind: 'privileged', roles: ['admin', 'supervisor'] },
  'reports:salesSummary': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'reports:salesComparison': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },

  // Auth (US4 + US5)
  'auth:matrixSummary': { kind: 'privileged', roles: ['admin'] },
  'auth:listAuditEntries': { kind: 'privileged', roles: ['admin'] },
  'auth:listAlerts': { kind: 'privileged', roles: ['admin'] },
  'auth:acknowledgeAlert': { kind: 'privileged', roles: ['admin'] },
  'auth:recoveryNeeded': { kind: 'public' },

  // System utilities
  'notify:show': { kind: 'public' },
  'print:ticket': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'print:hasConfig': { kind: 'public' },
  'window:minimize': { kind: 'public' },
  'window:maximizeToggle': { kind: 'public' },
  'window:close': { kind: 'public' },
  'window:isMaximized': { kind: 'public' },

  // Held tickets (P9 round-2 extension — require an authenticated user)
  'held:list': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'held:add': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'held:remove': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] },
  'held:clear': { kind: 'privileged', roles: ['admin', 'supervisor', 'cajero'] }
}

export function getRule(channel: string): AuthRule {
  return AUTH_MATRIX[channel] ?? FAILURE_CLOSED_DEFAULT
}

export function matrixSummary(): AuthMatrixSummaryEntry[] {
  return Object.entries(AUTH_MATRIX).map(([operation, rule]) => {
    const base: AuthMatrixSummaryEntry = { operation, kind: rule.kind }
    if (rule.kind === 'privileged' || rule.kind === 'self-or-roles') base.roles = rule.roles
    if (rule.kind === 'self-or-roles' || rule.kind === 'self-only')
      base.selfArgIndex = rule.selfArgIndex ?? 0
    if (rule.kind === 'privileged' && rule.recoveryOnly) base.recoveryOnly = true
    return base
  })
}
