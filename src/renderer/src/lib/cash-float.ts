import type { AppSetting } from '@shared/types'

// 010-cash-float-close: the business' default float — the cash that usually
// stays in the drawer between shifts. Admin sets it in Configuración › Caja;
// it lives in app_settings under this key. Empty, 0 or garbage means "not
// configured", which callers treat as "no prefill".
export const CASH_FLOAT_SETTING_KEY = 'cash_float_default'

export function getCashFloatDefault(settings: AppSetting[]): number | null {
  const raw = settings.find((s) => s.key === CASH_FLOAT_SETTING_KEY)?.value
  const parsed = raw ? parseInt(raw, 10) : 0
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}
