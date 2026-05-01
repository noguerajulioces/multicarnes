/**
 * Decodificador de códigos EAN-13 generados por balanzas electrónicas
 * (Bizerba / Toledo / Avery / similares).
 *
 * Formato común en Paraguay y la región:
 *   2 P P P P P W W W W W C
 *   │ └────┬─────┘└────┬────┘└─ checksum (no validado, lo arma la balanza)
 *   │      │           │
 *   │      │           └─ peso en gramos (5 dígitos, max 99.999 kg)
 *   │      └─ código interno del producto (5 dígitos, debe coincidir
 *   │         con el campo `barcode` del producto en la BD)
 *   └─ prefijo `2X` indicando "código in-store con peso variable"
 *
 * Nota: el dígito que sigue al `2` puede variar según la balanza
 * (algunas usan `20`, otras `21`-`29`). Aceptamos cualquier `2X`.
 */

export interface BalanceCode {
  productCode: string
  weightKg: number
}

const BALANCE_PATTERN = /^2\d{12}$/

export function parseBalanceCode(barcode: string): BalanceCode | null {
  if (!BALANCE_PATTERN.test(barcode)) return null

  const productCode = barcode.slice(2, 7)
  const weightGrams = parseInt(barcode.slice(7, 12), 10)

  if (Number.isNaN(weightGrams) || weightGrams === 0) return null

  return {
    productCode,
    weightKg: weightGrams / 1000
  }
}
