// Stock adjustment modes shared by the two "Ajustar stock" modals
// (ProductosPage list row + ProductoDetallePage). The IPC always receives the
// resulting *absolute* stock; these helpers just translate what the user typed
// (an incoming/outgoing quantity, or the new total) into that absolute value,
// so the audit trail (quantity_before/after) stays correct regardless of mode.

export type StockAdjustMode = 'add' | 'subtract' | 'set'

export const STOCK_ADJUST_MODES: { mode: StockAdjustMode; label: string }[] = [
  { mode: 'add', label: 'Sumar' },
  { mode: 'subtract', label: 'Restar' },
  { mode: 'set', label: 'Reemplazar' }
]

/** Resulting absolute stock after applying `entered` under the given `mode`. */
export function applyStockAdjust(mode: StockAdjustMode, current: number, entered: number): number {
  switch (mode) {
    case 'add':
      return current + entered
    case 'subtract':
      return current - entered
    case 'set':
      return entered
  }
}

/** Input field label per mode, with the product's unit (kg, u, etc.). */
export function stockAdjustInputLabel(mode: StockAdjustMode, unit: string): string {
  switch (mode) {
    case 'add':
      return `Cantidad que ingresa (${unit})`
    case 'subtract':
      return `Cantidad que sale (${unit})`
    case 'set':
      return `Nuevo stock total (${unit})`
  }
}

/** Suggested "Motivo" placeholder per mode. */
export function stockAdjustReasonPlaceholder(mode: StockAdjustMode): string {
  switch (mode) {
    case 'add':
      return 'Ej: reposición, compra a proveedor'
    case 'subtract':
      return 'Ej: merma, rotura, consumo interno'
    case 'set':
      return 'Ej: recuento físico, corrección'
  }
}
