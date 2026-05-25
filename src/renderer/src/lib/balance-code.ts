/**
 * Decodificador de códigos EAN-13 de "peso variable" generados por la balanza
 * etiquetadora de la carnicería.
 *
 * Formato real observado en las etiquetas (Carnicería Multicarnes):
 *   P P P P P P P   W W W W W   C
 *   └──── 7 ────┘   └── 5 ──┘   └─ verificador EAN-13 (calculado, no es dato)
 *        │              │
 *        │              └─ peso NETO en gramos (5 dígitos → ÷1000 = kg)
 *        └─ código del producto (7 dígitos, NO cambia con el peso; debe
 *           coincidir con el campo `barcode` del producto en la BD)
 *
 * Ejemplos verificados:
 *   0000000 01360 4  → producto 0000000, 1.360 kg  (SALAME)
 *   3000018 07260 2  → producto 3000018, 7.260 kg  (MATAMBRE)
 *   1000011 09950 4  → producto 1000011, 9.950 kg  (PALETA)
 *
 * El precio por kg y el nombre NO viajan en el código: salen de la ficha del
 * producto. El total lo calcula el POS (peso × precio/kg).
 *
 * Nota: aceptamos cualquier EAN-13 de 13 dígitos. Para evitar confundir un
 * producto envasado normal (también EAN-13) con una etiqueta de balanza, el
 * llamador primero intenta un match EXACTO del código completo y sólo recurre a
 * este decodificador como respaldo (ver `processScannedCode` en VentasPage).
 */

export interface BalanceCode {
  productCode: string
  weightKg: number
}

const BALANCE_PATTERN = /^\d{13}$/

export function parseBalanceCode(barcode: string): BalanceCode | null {
  if (!BALANCE_PATTERN.test(barcode)) return null

  const productCode = barcode.slice(0, 7)
  const weightGrams = parseInt(barcode.slice(7, 12), 10)

  if (Number.isNaN(weightGrams) || weightGrams === 0) return null

  return {
    productCode,
    weightKg: weightGrams / 1000
  }
}
