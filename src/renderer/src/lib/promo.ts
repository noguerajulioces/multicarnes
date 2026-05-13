import type { EffectivePrice, Product } from '@shared/types'

// 005-promotional-pricing: pure decision computed renderer-side at
// add-to-cart. Returns null when no promo is currently active, or the
// effective unit price + normal price + per-unit savings when one is.
//
// Semantics (research R2/R4/R5):
//   1. promo_enabled must be truthy.
//   2. If promo_from is set, current local date must be >= promo_from.
//   3. If promo_to is set,   current local date must be <= promo_to.
//   4. 'fixed'   → unitPrice = promo_value.
//   5. 'percent' → unitPrice = round(normalPrice * (1 - value/100)).
//   6. If the computed unitPrice is not strictly less than normalPrice
//      (e.g., a stale fixed amount that no longer beats a dropped normal
//      price), the promo silently self-disables.
//   7. Otherwise return { unitPrice, normalPrice, savingsPerUnit }.

function localDateString(now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isPromoActive(product: Product, now: Date): EffectivePrice | null {
  if (!product.promo_enabled) return null

  const today = localDateString(now)
  if (product.promo_from && today < product.promo_from) return null
  if (product.promo_to && today > product.promo_to) return null

  const normalPrice = product.price
  let unitPrice: number
  if (product.promo_type === 'fixed') {
    if (product.promo_value == null) return null
    unitPrice = product.promo_value
  } else if (product.promo_type === 'percent') {
    if (product.promo_value == null) return null
    unitPrice = Math.round(normalPrice * (1 - product.promo_value / 100))
  } else {
    return null
  }

  if (unitPrice >= normalPrice) return null

  return {
    unitPrice,
    normalPrice,
    savingsPerUnit: normalPrice - unitPrice
  }
}

// Alias for readability at call sites that "compute" rather than "check".
export const computeEffectivePrice = isPromoActive
