# Especificación de Funcionalidad: Compartir Comprobante de Venta

**Feature Branch**: `007-receipt-share`
**Created**: 2026-05-15
**Status**: Draft
**Input**: User description: "el cliente aún no tiene impresora térmica por lo que desea poder enviar por WhatsApp como un 'comprobante' pero en formato texto. Y/o poder descargar el comprobante en PDF y/o imagen."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Enviar comprobante por WhatsApp como texto (Priority: P1)

Al cerrar una venta, el cajero quiere entregar al cliente un comprobante que reemplace al ticket impreso. Como el local todavía no tiene impresora térmica, debe poder abrir WhatsApp con un mensaje pre-armado al número del cliente (o a un número que tipea en el momento) que contenga todo el detalle de la venta en texto plano: encabezado del negocio, número de venta, fecha y hora, ítems con cantidad y precio, descuentos / "Ahorrás" si aplica, total, forma de pago y vuelto si fue efectivo.

**Why this priority**: Es lo que el cliente pidió explícitamente como reemplazo del ticket físico. Sin esto la venta queda sin comprobante entregable. Es el flujo más usado (entregar comprobante en el momento de cobrar) y el que más alivia la falta de impresora.

**Independent Test**: Cerrar una venta de prueba con un cliente que tenga teléfono cargado, tocar el botón "Enviar por WhatsApp" en el modal post-venta, verificar que se abre WhatsApp (Web, Desktop o móvil) con el número pre-completado y el mensaje pre-completado que contiene todos los datos de la venta. La entrega final la hace el cajero apretando "Enviar" dentro de WhatsApp.

**Acceptance Scenarios**:

1. **Given** una venta acaba de confirmarse y el cliente asociado tiene teléfono registrado, **When** el cajero pulsa "Enviar por WhatsApp" en el modal de comprobante, **Then** se abre WhatsApp con el número del cliente y un mensaje listo para enviar con el comprobante en texto.
2. **Given** una venta a "Consumidor final" (sin cliente asociado), **When** el cajero pulsa "Enviar por WhatsApp", **Then** el sistema le pide ingresar un número de destino, lo valida (Paraguay por defecto), y al confirmar abre WhatsApp con ese número y el mensaje listo.
3. **Given** la venta tiene productos con precio promocional aplicado, **When** se genera el mensaje, **Then** el texto incluye la línea "Ahorrás Gs. X" igual al ticket de papel.
4. **Given** la venta se cobró con dos métodos de pago (mixto), **When** se genera el mensaje, **Then** el texto detalla cada método con su monto.
5. **Given** el cliente asociado tiene un teléfono guardado en formato inválido (vacío, letras, demasiado corto), **When** el cajero pulsa "Enviar por WhatsApp", **Then** el sistema cae al flujo de "ingresar número manualmente" en lugar de fallar.

---

### User Story 2 — Descargar comprobante como imagen (PNG) (Priority: P2)

El cajero (o el cliente desde el dispositivo del cajero) quiere bajar el comprobante como una imagen, para guardarlo en la galería del teléfono o reenviarlo por cualquier canal (Telegram, email, Instagram, etc.) sin depender de WhatsApp.

**Why this priority**: Complementa P1 cuando el destinatario no usa WhatsApp o prefiere una imagen "tipo ticket" en vez de texto plano. Es un canal alternativo de entrega del comprobante.

**Independent Test**: Cerrar una venta, pulsar "Descargar imagen" en el modal de comprobante, verificar que el archivo PNG se descarga con el nombre `comprobante-{venta_id}.png` y que al abrirlo se ve el ticket renderizado idéntico a la vista previa, con todos los campos legibles.

**Acceptance Scenarios**:

1. **Given** un comprobante con N líneas de ítems visible en pantalla, **When** el cajero pulsa "Descargar imagen", **Then** se guarda un archivo PNG con la misma información y formato del ticket de la vista previa.
2. **Given** el comprobante tiene una línea de "Ahorrás", **When** se descarga la imagen, **Then** la imagen muestra esa línea con el mismo destaque que el ticket impreso.

---

### User Story 3 — Descargar comprobante como PDF (Priority: P2)

El cajero quiere bajar el comprobante como PDF para archivarlo o adjuntarlo por correo. Esta capacidad ya existe en el modal post-venta; el alcance acá es asegurar que esté disponible también desde el resto de los puntos de acceso al comprobante (ver US4) y que el PDF se mantenga consistente con el texto y la imagen.

**Why this priority**: Misma prioridad que la imagen — es un canal alternativo importante para registros formales (contables, comprobantes para la empresa). Como el botón ya existe en el modal post-venta, la mayor parte del trabajo está hecho; se extiende su disponibilidad.

**Independent Test**: Desde cualquier punto de acceso al comprobante (modal post-venta y detalle de venta en el historial), pulsar "Descargar PDF" y verificar que se baja un PDF que contiene el mismo comprobante.

**Acceptance Scenarios**:

1. **Given** una venta visible en su modal de comprobante post-venta, **When** se pulsa "Descargar PDF", **Then** se guarda un archivo PDF con el comprobante completo (este comportamiento ya existe).
2. **Given** una venta vieja abierta desde el listado de ventas, **When** se pulsa "Descargar PDF" en el detalle, **Then** se guarda el PDF equivalente.

---

### User Story 4 — Compartir / descargar desde el historial de ventas (Priority: P3)

El cajero o supervisor entra a "Listado de Ventas", abre una venta cualquiera, y desde ese detalle puede ejecutar las mismas tres acciones (WhatsApp, PDF, imagen) sobre comprobantes pasados — para reenviarlos cuando el cliente los pierde, o re-archivar un PDF que se perdió.

**Why this priority**: Mejora la utilidad de la feature a lo largo del tiempo (no sólo en el momento de la venta) pero no es bloqueante: el caso principal del cliente se cubre con US1 al confirmar la venta.

**Independent Test**: Abrir una venta pasada de hace varios días desde el listado y verificar que las tres acciones funcionan igual que recién confirmada la venta.

**Acceptance Scenarios**:

1. **Given** una venta de cualquier fecha en el listado, **When** se abre su detalle y se pulsa "Enviar por WhatsApp", **Then** ocurre lo mismo que en US1.
2. **Given** una venta anulada, **When** se intenta compartirla, **Then** el comprobante incluye una marca visible "ANULADA" tanto en texto como en imagen y PDF.

---

### Edge Cases

- **Sin cliente asociado**: el flujo de WhatsApp pide número manualmente.
- **Teléfono inválido o vacío en el cliente**: cae a entrada manual.
- **Número sin código de país**: el sistema antepone el código de Paraguay (`+595`) si no detecta otro, y normaliza descartando ceros iniciales, espacios y guiones.
- **Venta con muchas líneas (p. ej. 50+ productos)**: el mensaje de WhatsApp puede ser muy largo. Si excede el límite práctico de la URL `wa.me`, el sistema avisa y sugiere descargar la imagen o PDF en su lugar.
- **Caracteres especiales en nombres de producto / cliente**: el texto se codifica correctamente para la URL de WhatsApp; tildes, ñ y guiones se preservan al llegar a WhatsApp.
- **Venta anulada**: se puede compartir, pero el comprobante incluye una marca "ANULADA" claramente visible.
- **Sin conexión a internet**: la descarga (PDF / imagen) funciona offline; la acción de WhatsApp depende de que WhatsApp Desktop o Web pueda conectarse — el sistema no garantiza el envío, solo la apertura del cliente.
- **Cliente no tiene WhatsApp instalado**: la URL se abre igual; queda a cargo del dispositivo manejar el caso (en escritorio aparece pidiendo instalar; en móvil, idem).
- **Promoción aplicada en la línea**: la línea de "Ahorrás" aparece consistentemente en texto, imagen y PDF.
- **Pago mixto (efectivo + tarjeta + etc.)**: cada método se lista con su monto en las tres salidas.
- **Datos del negocio (nombre, dirección, teléfono) vacíos en Configuración**: el comprobante sigue funcionando, omitiendo las líneas vacías sin romperse.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El modal de comprobante post-venta DEBE ofrecer tres acciones de salida del comprobante: "Enviar por WhatsApp", "Descargar PDF" y "Descargar imagen", además de la impresión térmica existente.
- **FR-002**: La acción "Enviar por WhatsApp" DEBE abrir el cliente de WhatsApp (Web, Desktop o móvil, según donde se haga clic) con un número de destino pre-completado y un mensaje de texto pre-completado que contiene el comprobante completo.
- **FR-003**: El mensaje de WhatsApp DEBE contener al menos: nombre del negocio, dirección y teléfono (si están configurados), número de venta, fecha y hora, nombre del cliente (si está asociado), una línea por ítem con cantidad y precio total, subtotal, total de descuento / "Ahorrás" cuando aplique, total general, método(s) de pago con sus montos, y vuelto entregado cuando aplique.
- **FR-004**: El sistema DEBE pre-completar el número de destino con el teléfono del cliente asociado a la venta cuando exista uno válido; en caso contrario, DEBE pedir al usuario ingresarlo en el momento.
- **FR-005**: El sistema DEBE normalizar el número de destino antes de pasárselo a WhatsApp: quitar espacios, guiones y paréntesis, anteponer el código de país por defecto (Paraguay, `+595`) si no detecta uno explícito, y validar que el resultado tenga una longitud razonable.
- **FR-006**: La acción "Descargar PDF" DEBE generar un archivo PDF idéntico en contenido al comprobante actual y guardarlo con el nombre `comprobante-{id}.pdf`. (Capacidad ya implementada — se extiende su disponibilidad.)
- **FR-007**: La acción "Descargar imagen" DEBE generar un archivo PNG renderizado del comprobante con el nombre `comprobante-{id}.png` y guardarlo localmente.
- **FR-008**: Las tres acciones DEBEN estar disponibles también desde el detalle de venta en el historial de ventas, no sólo en el modal post-venta.
- **FR-009**: El comprobante en sus tres formatos (texto WhatsApp, imagen, PDF) DEBE incluir la línea "Ahorrás Gs. X" cuando la venta tenga al menos una línea con precio promocional aplicado.
- **FR-010**: El comprobante en sus tres formatos DEBE detallar correctamente cada método de pago con su monto cuando la venta tenga pago mixto.
- **FR-011**: Para una venta anulada, las tres acciones DEBEN seguir disponibles pero el comprobante DEBE incluir una marca visible "ANULADA" en todas las salidas.
- **FR-012**: Si el mensaje de texto generado excede el límite práctico que `wa.me` puede manejar (≈2000 caracteres en la URL), el sistema DEBE avisar al cajero y sugerir usar PDF o imagen como alternativa.
- **FR-013**: Cada acción de compartir (WhatsApp / PDF / imagen) DEBE quedar registrada en `action_logs` indicando usuario, venta, formato y destino (número si fue WhatsApp), para auditoría posterior.
- **FR-014**: Si los datos del negocio (nombre, dirección, teléfono) están vacíos en Configuración, los formatos deben omitir esas líneas sin romperse ni mostrar "undefined".

### Key Entities *(include if feature involves data)*

- **Venta (Sale)**: ya existe. Es la fuente de toda la información del comprobante: ítems, precios, descuentos promocionales aplicados, totales, métodos de pago, cajero, fecha/hora, cliente asociado, estado (válida / anulada).
- **Cliente (Customer)**: ya existe. Aporta el teléfono usado para pre-completar el destinatario de WhatsApp.
- **Configuración del Negocio (AppSetting)**: ya existe (`business_name`, `business_address`, `business_phone`). Define la cabecera del comprobante.
- **Registro de Acción (action_log)**: ya existe. Acá se asienta cada operación de compartir con metadatos suficientes para auditoría (US Quién, qué venta, qué formato, qué número destino si aplica).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Después de cerrar una venta, el cajero puede entregar un comprobante al cliente (por cualquiera de los tres canales: WhatsApp, PDF, imagen) en menos de 10 segundos desde que se confirma el cobro.
- **SC-002**: En al menos el 95 % de las ventas con cliente asociado y teléfono válido, la acción "Enviar por WhatsApp" abre WhatsApp con el número correcto pre-completado, sin requerir corrección manual por parte del cajero.
- **SC-003**: El comprobante entregado en cualquiera de los tres formatos contiene el mismo conjunto de datos esenciales — nombre del negocio, número de venta, fecha, ítems con precio, total, método(s) de pago — verificable comparando salidas en una prueba lado a lado.
- **SC-004**: El 100 % de las acciones de compartir quedan registradas en el historial de auditoría, identificando usuario, venta y formato.
- **SC-005**: El cajero puede re-enviar el comprobante de cualquier venta del último año desde el listado de ventas sin necesidad de procesos adicionales (no hay diferencia funcional entre re-compartir una venta vieja y compartir una venta recién confirmada).

## Assumptions

- Se asume que el envío por WhatsApp se hace abriendo la URL `https://wa.me/<numero>?text=<mensaje>`, que funciona en escritorio (WhatsApp Web o Desktop) y en móvil, sin requerir cuenta de WhatsApp Business API. El cajero todavía debe pulsar "Enviar" dentro de WhatsApp; el sistema solo prepara y abre.
- Se asume que la mayoría de los clientes ya tienen un teléfono cargado en su ficha; cuando no lo tienen, se pide manualmente.
- Se asume Paraguay como locale por defecto: moneda en guaraníes, textos en español, código de país `+595` si no se detecta otro.
- Se asume que la generación de PDF actual (`downloadTicketPdf` en `src/renderer/src/lib/ticket-pdf.ts`) ya satisface FR-006; el trabajo de US3 es principalmente extender su disponibilidad (FR-008), no rehacer el PDF.
- Se asume que la imagen del comprobante se genera renderizando el mismo componente que la vista previa actual (`Ticket.tsx`), sin diseñar un layout separado para imagen.
- Se asume que el adjunto de archivos a WhatsApp (mandar el PDF / imagen como attachment dentro del mismo flujo) NO está al alcance, porque `wa.me` no soporta adjuntos. El usuario que quiera enviar el PDF / imagen lo descarga y lo adjunta manualmente.
- Se asume que las acciones de compartir se reutilizan tanto en el modal post-venta como en el detalle de venta del historial — no se hace un panel nuevo separado.
- Se asume que no hace falta migración de base de datos: los campos necesarios (teléfono del cliente, datos del negocio, datos de la venta, líneas de pago) ya existen.
