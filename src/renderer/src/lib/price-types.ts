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

export function formatQty(qty: number, code: PriceType | string): string {
  const info = priceTypeInfo(code)
  const formatted = info.decimals > 0 ? qty.toFixed(info.decimals) : String(qty)
  return `${formatted} ${info.unit}`
}
