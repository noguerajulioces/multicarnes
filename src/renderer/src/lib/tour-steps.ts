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

export const dashboardManagerTourSteps: StepType[] = [
  {
    selector: '[data-tour="dash-new-sale"]',
    content: 'Acceso rápido a una nueva venta. También podés entrar al POS desde el menú lateral.'
  },
  {
    selector: '[data-tour="dash-kpis"]',
    content:
      'Indicadores del día: total vendido, tickets, cobros pendientes y alertas de stock — con comparativa contra ayer.'
  },
  {
    selector: '[data-tour="dash-sales-chart"]',
    content:
      'Evolución de ventas. Cambiá el período (7 días, 30 días, 6 meses) desde el selector de la derecha.'
  },
  {
    selector: '[data-tour="dash-top-products"]',
    content: 'Tus productos más vendidos del período seleccionado.'
  },
  {
    selector: '[data-tour="dash-recent-sales"]',
    content: 'Las últimas 8 transacciones para que sepas qué está pasando en el momento.'
  },
  {
    selector: '[data-tour="dash-stock"]',
    content:
      'Resumen de stock con productos críticos. Revisá acá antes de hacer compras o cierres.'
  }
]

export const dashboardCajeroTourSteps: StepType[] = [
  {
    selector: '[data-tour="dash-new-sale"]',
    content: 'Empezá una nueva venta desde acá. Es tu acceso principal al POS.'
  },
  {
    selector: '[data-tour="dash-kpis"]',
    content: 'Resumen de tu turno: tickets registrados hoy y alertas de stock.'
  },
  {
    selector: '[data-tour="dash-stock"]',
    content: 'Productos con stock bajo. Avisale al encargado si ves alertas críticas.'
  }
]
