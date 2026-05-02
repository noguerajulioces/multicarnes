import type { StepType } from '@reactour/tour'

export const ventasTourSteps: StepType[] = [
  {
    selector: '[data-tour="ventas-search"]',
    content:
      'Buscá productos por nombre o código. También podés pasar un código de barras: se agrega automáticamente al carrito.'
  },
  {
    selector: '[data-tour="ventas-categories"]',
    content: 'Filtrá la grilla por categoría para encontrar productos más rápido.'
  },
  {
    selector: '[data-tour="ventas-products"]',
    content:
      'Hacé clic en un producto para agregarlo al carrito. Si es por kg, te va a pedir la cantidad.'
  },
  {
    selector: '[data-tour="ventas-cart"]',
    content:
      'Acá ves los productos del ticket actual. Podés ajustar cantidades o eliminar líneas.'
  },
  {
    selector: '[data-tour="ventas-totals"]',
    content:
      'Revisá el subtotal, aplicá descuento (F4) y mirá el total. Cobrá con F12 o el botón verde.'
  },
  {
    selector: '[data-tour="ventas-suspend"]',
    content:
      'Suspendé un ticket (F9) si el cliente necesita pausar la compra. Lo podés reanudar después.'
  },
  {
    selector: '[data-tour="ventas-shortcuts"]',
    content:
      'Atajos rápidos: F4 descuento, F8 cancelar, F9 suspender, F12 cobrar. F1 muestra la ayuda completa.'
  }
]
