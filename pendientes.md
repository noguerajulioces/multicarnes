# Pendientes — POS Multicarnes

Lista de tareas pendientes ordenadas por prioridad y área de negocio.

---

## 🔴 Bloqueadores antes de producción

- [ ] Implementar servicio de impresión térmica (`src/main/services/printer.ts`) usando `node-thermal-printer`
- [ ] Crear handler IPC `printer:printTicket` y `printer:test`
- [ ] Crear componente / template de ticket de venta
- [ ] Validar descuento en `cart.store.ts` (`0 ≤ descuento ≤ subtotal`)
- [ ] Validar descuento en servidor (`sales:create`)
- [ ] Validar caja abierta en backend al crear venta (`sales:create` debe verificar `register_id` con `status = 'open'`)
- [ ] Backup automático al cerrar caja (hook en `closeCashRegister`)
- [ ] Guardia de rol en rutas (`<RequireRole>` wrapper en `router.tsx`)
- [ ] Validación de rol en IPC handlers del proceso main

---

## 🟡 Venta en mostrador (POS)

- [ ] Botón "Efectivo exacto + imprimir" para cobro rápido sin abrir modal
- [ ] Reimprimir ticket desde historial de ventas
- [ ] Mostrar vuelto en grande post-cobro
- [ ] Flujo de devolución / nota de crédito que revierta stock y saldo de cliente
- [ ] Integración con balanza electrónica para venta por peso variable
- [ ] Grid de productos favoritos / accesos rápidos por categoría en pantalla POS
- [ ] Validar cantidad > 0 para productos por kg

---

## 🟡 Caja y arqueo

- [ ] Imprimir resumen de cierre de turno (Z)
- [ ] Configurar umbral de descuadre con alerta al cierre
- [ ] Reporte de descuadres históricos por cajero

---

## 🟡 Stock y productos

- [ ] Tipo de ajuste "merma" diferenciado de ajuste manual
- [ ] Reporte específico de mermas
- [ ] Trazabilidad por lote / fecha de vencimiento (FIFO)
- [ ] Costo promedio ponderado en reporte de margen (en lugar de último costo)
- [ ] Despiece de productos (entrada en kg de media res → salida en cortes)
- [ ] Flujo de toma física masiva de inventario

---

## 🟡 Clientes y fiado

- [ ] Imprimir estado de cuenta de cliente

---

## 🟡 Compras y proveedores

- [ ] Pantalla de histórico de precios de compra por producto

---

## 🟡 Reportes

- [x] Tab de fiados pendientes (CxC consolidado)
- [x] Reporte de ventas
- [x] Comparativos período actual vs anterior

---

## 🟡 Seguridad y auditoría

- [ ] Bloqueo de usuario tras N intentos de PIN fallidos
- [ ] Auditar en `action_logs`: cambio de precio
- [ ] Auditar en `action_logs`: ajuste de stock
- [ ] Auditar en `action_logs`: alta/baja/edición de usuario
- [ ] Auditar en `action_logs`: apertura y cierre de caja
- [ ] Auditar en `action_logs`: anulación de venta
- [ ] Auditar en `action_logs`: edición de cliente

---

## 🟡 Operación y soporte

- [ ] Backup automático a USB cuando esté conectado
- [ ] Backup a nube (opcional)
- [ ] Logs de errores estructurados a archivo
- [ ] Visor de logs desde pantalla de Configuración
- [ ] Auto-update de la aplicación (electron-updater)
- [ ] Sincronización entre múltiples cajas si el negocio escala
