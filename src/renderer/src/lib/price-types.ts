import type { PriceType } from '@shared/types'

export interface PriceTypeInfo {
  code: PriceType
  label: string
  unit: string
  decimals: number
  inputStep: string
  cartStep: number
}

export const PRICE_TYPES: Record<PriceType, PriceTypeInfo> = {
  unit: { code: 'unit', label: 'Por unidad', unit: 'u.', decimals: 0, inputStep: '1', cartStep: 1 },
  kg: { code: 'kg', label: 'Por kg', unit: 'kg', decimals: 3, inputStep: '0.001', cartStep: 0.25 },
  g: { code: 'g', label: 'Por gramo', unit: 'g', decimals: 0, inputStep: '1', cartStep: 50 },
  l: { code: 'l', label: 'Por litro', unit: 'l', decimals: 2, inputStep: '0.01', cartStep: 0.25 },
  ml: { code: 'ml', label: 'Por ml', unit: 'ml', decimals: 0, inputStep: '1', cartStep: 50 },
  m: { code: 'm', label: 'Por metro', unit: 'm', decimals: 2, inputStep: '0.01', cartStep: 0.5 },
  docena: {
    code: 'docena',
    label: 'Por docena',
    unit: 'doc.',
    decimals: 0,
    inputStep: '1',
    cartStep: 1
  },
  paquete: {
    code: 'paquete',
    label: 'Por paquete',
    unit: 'paq.',
    decimals: 0,
    inputStep: '1',
    cartStep: 1
  }
}

export const PRICE_TYPE_LIST: PriceTypeInfo[] = Object.values(PRICE_TYPES)

export function priceTypeInfo(code: PriceType | string): PriceTypeInfo {
  return PRICE_TYPES[code as PriceType] ?? PRICE_TYPES.unit
}

/**
 * Redondea una cantidad a los decimales propios del tipo de precio (kg→3, l→2,
 * unit→0), eliminando la basura de punto flotante (p. ej. 7.800000000000001 →
 * 7.8). Útil al prellenar inputs o antes de persistir el stock resultante.
 */
export function roundQty(qty: number, code: PriceType | string): number {
  const { decimals } = priceTypeInfo(code)
  const factor = 10 ** decimals
  return Math.round(qty * factor) / factor
}

export function formatQty(qty: number, code: PriceType | string): string {
  const info = priceTypeInfo(code)
  // Locale es-PY usa "," decimal y "." de miles, evitando que "10.000 kg" se lea como 10 mil.
  // Stripeamos ceros finales con `maximumFractionDigits` (10 → "10", 10.5 → "10,5").
  const formatted = qty.toLocaleString('es-PY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: info.decimals
  })
  return `${formatted} ${info.unit}`
}
