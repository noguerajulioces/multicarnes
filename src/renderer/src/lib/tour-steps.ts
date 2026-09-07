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
    content: 'Acá ves los productos del ticket actual. Podés ajustar cantidades o eliminar líneas.'
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
    content: 'Resumen de stock con productos críticos. Revisá acá antes de hacer compras o cierres.'
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

export const productosTourSteps: StepType[] = [
  {
    selector: '[data-tour="productos-search"]',
    content: 'Buscá productos por nombre o código de barras.'
  },
  {
    selector: '[data-tour="productos-filters"]',
    content:
      'Filtrá por categoría, estado (activo/inactivo) o solo los que tienen stock bajo para revisar.'
  },
  {
    selector: '[data-tour="productos-new"]',
    content: 'Cargá un producto nuevo con precio, stock mínimo, código de barras e imagen.'
  },
  {
    selector: '[data-tour="productos-table"]',
    content:
      'Listado del catálogo. Tocá la fila para ver el detalle o usá el ícono de paquete para ajustar stock con motivo.'
  }
]

export const cajaTourSteps: StepType[] = [
  {
    selector: '[data-tour="caja-kpis"]',
    content:
      'Resumen del turno: monto de apertura, ventas en efectivo, ingresos/egresos y efectivo esperado al cierre.'
  },
  {
    selector: '[data-tour="caja-movements-actions"]',
    content:
      'Registrá ingresos extras (ej. cambio que entra) o egresos (retiros, gastos del día). Siempre con descripción.'
  },
  {
    selector: '[data-tour="caja-movements-list"]',
    content: 'Historial cronológico de todos los movimientos del turno actual.'
  }
]

export const cajaManagerTourSteps: StepType[] = [
  ...cajaTourSteps,
  {
    selector: '[data-tour="caja-close"]',
    content:
      'Cerrar caja: contás el efectivo, el sistema te muestra la diferencia y queda el reporte Z disponible.'
  }
]

export const clientesTourSteps: StepType[] = [
  {
    selector: '[data-tour="clientes-search"]',
    content: 'Buscá por nombre, teléfono o documento. Filtrá entre clientes y empleados.'
  },
  {
    selector: '[data-tour="clientes-new"]',
    content: 'Alta rápida de un cliente o empleado. Marcá "Es empleado" para diferenciarlos.'
  },
  {
    selector: '[data-tour="clientes-table"]',
    content:
      'Listado con saldo actual: rojo = debe, verde = a favor. Abrí la ficha para ver historial y registrar pagos.'
  }
]

export const comprasTourSteps: StepType[] = [
  {
    selector: '[data-tour="compras-filters"]',
    content: 'Filtrá las órdenes por estado: pendientes, recibidas o canceladas.'
  },
  {
    selector: '[data-tour="compras-actions"]',
    content: 'Gestioná proveedores o creá una nueva orden de compra para reponer stock.'
  },
  {
    selector: '[data-tour="compras-table"]',
    content:
      'Tocá una orden para ver el detalle, marcarla como recibida y actualizar stock automáticamente.'
  }
]

export const productoFormTourSteps: StepType[] = [
  {
    selector: '[data-tour="producto-form-image"]',
    content:
      'Subí una foto del producto. Aparece en la grilla del POS y ayuda a identificarlo rápido.'
  },
  {
    selector: '[data-tour="producto-form-basic"]',
    content:
      'Nombre, categoría y código de barras. Podés crear una categoría nueva sin salir del formulario.'
  },
  {
    selector: '[data-tour="producto-form-pricing"]',
    content:
      'Precio, tipo (unidad o por kg), stock inicial y mínimo. Cuando el stock baja del mínimo se dispara la alerta.'
  },
  {
    selector: '[data-tour="producto-form-actions"]',
    content: 'Guardá el producto. Si está activo, aparece en la pantalla de ventas.'
  }
]

export const compraNuevaTourSteps: StepType[] = [
  {
    selector: '[data-tour="compra-nueva-supplier"]',
    content:
      'Elegí el proveedor (opcional) y agregá notas internas como número de factura o remito.'
  },
  {
    selector: '[data-tour="compra-nueva-items"]',
    content:
      'Agregá los productos comprados con cantidad y costo unitario. El total se recalcula automáticamente.'
  },
  {
    selector: '[data-tour="compra-nueva-actions"]',
    content:
      '"Guardar Pendiente" deja la orden esperando recibo. "Guardar y Recibir" suma el stock al inventario en el momento.'
  }
]

export const clienteFichaTourSteps: StepType[] = [
  {
    selector: '[data-tour="cliente-ficha-info"]',
    content: 'Datos de contacto del cliente: nombre, documento, teléfono y dirección.'
  },
  {
    selector: '[data-tour="cliente-ficha-balance"]',
    content:
      'Saldo actual: en rojo si debe, en verde si tiene a favor. Registrá un pago desde acá para descontar la deuda.'
  },
  {
    selector: '[data-tour="cliente-ficha-sales"]',
    content: 'Todas las compras del cliente. Tocá una fila para ver los productos del ticket.'
  },
  {
    selector: '[data-tour="cliente-ficha-payments"]',
    content: 'Pagos recibidos del cliente, con fecha, monto y nota.'
  }
]

export const reportesTourSteps: StepType[] = [
  {
    selector: '[data-tour="reportes-tabs"]',
    content:
      'Tipos de reporte disponibles: resumen, comparativos, fiados, productos top, márgenes, movimientos de stock y cierres de caja.'
  },
  {
    selector: '[data-tour="reportes-filters"]',
    content:
      'Ajustá el rango de fechas (cuando aplica) y tocá "Consultar" para cargar los datos. Cuando aparece el listado, vas a poder exportarlo a Excel o PDF desde la barra superior derecha.'
  }
]

export const usuariosTourSteps: StepType[] = [
  {
    selector: '[data-tour="usuarios-new"]',
    content: 'Creá usuarios con rol (admin, supervisor o cajero) y un PIN de 6 dígitos.'
  },
  {
    selector: '[data-tour="usuarios-table"]',
    content:
      'Listado de usuarios con su rol y estado. Tocá el lápiz para editar nombre, rol o cambiar PIN.'
  }
]

export const perfilTourSteps: StepType[] = [
  {
    selector: '[data-tour="perfil-info"]',
    content: 'Tu información de cuenta: nombre, rol y desde cuándo sos parte del equipo.'
  },
  {
    selector: '[data-tour="perfil-pin"]',
    content:
      'Cambiá tu PIN periódicamente. Vas a tener que ingresar el PIN actual para confirmar el nuevo.'
  }
]

export const configTourSteps: StepType[] = [
  {
    selector: '[data-tour="config-business"]',
    content: 'Nombre, dirección y teléfono que aparecen en los tickets impresos y reportes.'
  },
  {
    selector: '[data-tour="config-cash"]',
    content:
      'Fondo de caja por defecto: el efectivo que suele quedar en el cajón para el próximo turno. Se precarga al cerrar la caja y se propone al abrirla.'
  },
  {
    selector: '[data-tour="config-theme"]',
    content: 'Tema claro u oscuro según el ambiente del local.'
  },
  {
    selector: '[data-tour="config-login"]',
    content:
      'Activá el teclado numérico en pantalla si la app se usa en una tablet o monitor táctil.'
  },
  {
    selector: '[data-tour="config-printer"]',
    content:
      'Configurá la impresora térmica: el nombre tal como aparece en el sistema operativo y el ancho del papel (58 u 80 mm).'
  },
  {
    selector: '[data-tour="config-tutorials"]',
    content:
      'Si querés volver a ver los tutoriales en cada pantalla, reseteá el progreso desde acá.'
  }
]

export const backupTourSteps: StepType[] = [
  {
    selector: '[data-tour="backup-actions"]',
    content:
      'Hacé un backup manual cuando quieras o restaurá una copia anterior (se respalda el estado actual antes de reemplazar).'
  },
  {
    selector: '[data-tour="backup-folder"]',
    content:
      'Carpeta donde se guardan los archivos. Podés cambiarla por una en red o disco externo.'
  },
  {
    selector: '[data-tour="backup-schedule"]',
    content:
      'Backup automático: al cerrar cada caja y/o a una hora fija del día (mientras la app esté abierta).'
  },
  {
    selector: '[data-tour="backup-history"]',
    content: 'Historial de copias guardadas con tamaño y fecha.'
  }
]

export const proveedoresTourSteps: StepType[] = [
  {
    selector: '[data-tour="proveedores-new"]',
    content: 'Cargá un proveedor nuevo con datos de contacto.'
  },
  {
    selector: '[data-tour="proveedores-table"]',
    content: 'Listado de proveedores. Tocá el lápiz para editar. Después los asignás a las órdenes.'
  }
]

export const cajaAperturaTourSteps: StepType[] = [
  {
    selector: '[data-tour="caja-apertura-amount"]',
    content:
      'Monto de efectivo con el que iniciás el turno. Se propone lo que quedó en caja en el último cierre (o el fondo por defecto); corregilo si el cajón tiene otra cosa. Si no tenés cambio, podés abrir en ₲ 0.'
  },
  {
    selector: '[data-tour="caja-apertura-submit"]',
    content: 'Confirmá para habilitar la pantalla de ventas y empezar a cobrar.'
  }
]

export const cajaCierreTourSteps: StepType[] = [
  {
    selector: '[data-tour="caja-cierre-expected"]',
    content:
      'Efectivo esperado = apertura + ventas en efectivo + ingresos − egresos. Lo calcula el sistema.'
  },
  {
    selector: '[data-tour="caja-cierre-counted"]',
    content:
      'Ingresá el efectivo contado físicamente. La diferencia se muestra en vivo: verde si sobra, rojo si falta.'
  },
  {
    selector: '[data-tour="caja-cierre-kept"]',
    content:
      'Indicá cuánto efectivo queda en el cajón como fondo para el próximo turno. El sistema calcula "A retirar / entregar" = contado − fondo. No cambia el arqueo.'
  },
  {
    selector: '[data-tour="caja-cierre-confirm"]',
    content:
      'Confirmá el cierre. Queda registrado el reporte Z y, si tenés activado backup automático, se genera la copia.'
  }
]

export const productoDetalleTourSteps: StepType[] = [
  {
    selector: '[data-tour="producto-detalle-header"]',
    content:
      'Datos del producto y acciones rápidas: ajustar stock con motivo, editar la ficha o activar/desactivar.'
  },
  {
    selector: '[data-tour="producto-detalle-kpis"]',
    content:
      'Stock actual, precio de venta, ventas de los últimos 7 días y costo de la última compra (con margen).'
  },
  {
    selector: '[data-tour="producto-detalle-movements"]',
    content: 'Historial de ajustes manuales de stock con antes/después, motivo y usuario.'
  },
  {
    selector: '[data-tour="producto-detalle-sales"]',
    content: 'Tickets recientes que incluyeron este producto, con cliente y cajero.'
  }
]

export const compraDetalleTourSteps: StepType[] = [
  {
    selector: '[data-tour="compra-detalle-header"]',
    content: 'Datos de la orden: número, fecha, proveedor y estado actual.'
  },
  {
    selector: '[data-tour="compra-detalle-items"]',
    content:
      'Productos comprados con cantidad, costo unitario y subtotal. Las notas aparecen abajo.'
  }
]

export const compraDetallePendingTourSteps: StepType[] = [
  ...compraDetalleTourSteps,
  {
    selector: '[data-tour="compra-detalle-actions"]',
    content:
      'Si la orden está pendiente: cancelala (no afecta stock) o marcala como recibida y se suma el stock al inventario.'
  }
]
