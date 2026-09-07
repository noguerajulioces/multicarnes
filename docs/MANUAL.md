# Manual de Usuario — POS Multicarnes

> Guía de uso para cajeros, supervisores y administradores.
> Versión del manual: 1.0 · App: POS Multicarnes 1.0.x · Idioma: Español (Paraguay)

---

## Tabla de contenidos

1. [Introducción](#1-introducción)
2. [Antes de empezar](#2-antes-de-empezar)
3. [Primer arranque (configuración del administrador)](#3-primer-arranque-configuración-del-administrador)
4. [Iniciar sesión y cerrar sesión](#4-iniciar-sesión-y-cerrar-sesión)
5. [Tablero (Dashboard)](#5-tablero-dashboard)
6. [Caja: apertura, movimientos y cierre](#6-caja-apertura-movimientos-y-cierre)
7. [Ventas (POS)](#7-ventas-pos)
8. [Historial de ventas](#8-historial-de-ventas)
9. [Productos y stock](#9-productos-y-stock)
10. [Clientes y cuentas con fiado](#10-clientes-y-cuentas-con-fiado)
11. [Proveedores y compras](#11-proveedores-y-compras)
12. [Reportes](#12-reportes)
13. [Usuarios (solo administrador)](#13-usuarios-solo-administrador)
14. [Configuración](#14-configuración)
15. [Backup y restauración](#15-backup-y-restauración)
16. [Mi perfil (cambiar PIN)](#16-mi-perfil-cambiar-pin)
17. [Hardware: impresora, lector y balanza](#17-hardware-impresora-lector-y-balanza)
18. [Atajos de teclado](#18-atajos-de-teclado)
19. [Preguntas frecuentes](#19-preguntas-frecuentes)
20. [Solución de problemas](#20-solución-de-problemas)
21. [Glosario](#21-glosario)

---

## 1. Introducción

### ¿Qué es POS Multicarnes?

POS Multicarnes es la aplicación de punto de venta de **Multicarnes S.R.L.**
Permite registrar ventas, controlar la caja, administrar productos y stock,
gestionar compras a proveedores, llevar cuentas de clientes con fiado, generar
reportes y emitir tickets en impresora térmica.

La aplicación funciona **sin internet**: todos los datos se guardan en la
computadora donde está instalada.

### ¿Para quién es esta guía?

- **Cajeros** — para vender, cobrar e imprimir tickets.
- **Supervisores** — para abrir y cerrar caja, gestionar productos, clientes,
  proveedores y consultar reportes.
- **Administradores** — además, para crear usuarios, configurar el negocio y
  hacer backups.

### Qué encontrarás en cada sección

Cada módulo principal de la app tiene su propia sección con:

- **Cómo llegar** — desde dónde se accede.
- **Para qué sirve** — qué tareas resuelve.
- **Paso a paso** — el flujo típico de uso.
- **Notas y consejos** — detalles que te van a ahorrar tiempo.

> 💡 Cuando veas `[Screenshot: …]` significa que ahí va una captura de pantalla
> que se agregará en una próxima revisión del manual.

---

## 2. Antes de empezar

### Requisitos del equipo

- **Sistema operativo:** Windows 10/11, macOS 12+ o Linux moderno.
- **Pantalla:** mínimo 1366 × 768 (recomendado 1920 × 1080 o más).
- **Periféricos opcionales:**
  - Impresora térmica ESC/POS de 58 mm o 80 mm.
  - Lector de código de barras USB (modo teclado).
  - Balanza comercial (Bizerba/Toledo) que imprima EAN-13 con peso embebido.

### Conceptos básicos del POS

| Término       | Qué significa                                                                 |
|---------------|--------------------------------------------------------------------------------|
| **Caja**      | El turno de venta abierto. Toda venta queda registrada bajo una caja abierta. |
| **Cajero**    | Usuario con permiso para vender.                                              |
| **Supervisor**| Usuario con permiso para vender, cerrar caja y gestionar catálogos.           |
| **Admin**     | Usuario con todos los permisos, incluido configuración y usuarios.            |
| **Fiado**     | Venta a crédito a un cliente registrado.                                      |
| **Arqueo**    | Conteo del dinero al cerrar la caja para verificar que coincide.              |
| **PIN**       | Clave de 6 dígitos para iniciar sesión.                                       |

> 💰 La moneda es el **Guaraní (Gs.)**. Los importes se muestran sin decimales.

[Screenshot: pantalla principal con sidebar visible]

---

## 3. Primer arranque (configuración del administrador)

La primera vez que abrís la aplicación, no hay ningún usuario creado. La
pantalla de login se reemplaza por un formulario de creación del primer
administrador.

### Paso a paso

1. Ingresá tu **nombre completo**.
2. Ingresá un **PIN de 6 dígitos**.
3. Confirmá el PIN repitiéndolo.
4. Hacé clic en **Crear administrador**.

[Screenshot: formulario "Crear administrador" en pantalla de login]

> ⚠️ Guardá tu PIN en un lugar seguro. **No existe recuperación automática de
> PIN**. Si lo olvidás, otro administrador deberá restablecerlo desde
> Usuarios → Editar.

> 📝 El PIN se guarda **encriptado** (bcrypt). Ni siquiera el desarrollador puede
> verlo en la base de datos.

---

## 4. Iniciar sesión y cerrar sesión

### Iniciar sesión

1. Tocá tu nombre en la **lista de usuarios** que aparece al abrir la app.
2. Ingresá tu **PIN de 6 dígitos**.
   - Si está activado el **teclado numérico en pantalla** (Configuración → Login),
     podés ingresarlo con el mouse o pantalla táctil.
3. Presioná **Enter** o el botón **Ingresar**.

[Screenshot: pantalla de login con lista de usuarios]

**Reglas:**

- El PIN debe tener **exactamente 6 dígitos numéricos**.
- Los usuarios desactivados **no aparecen** en la lista.
- Si sos cajero o supervisor y **no hay caja abierta**, la app te lleva
  directamente a la pantalla de **Apertura de Caja**.

### ¿Olvidaste tu PIN?

1. En la pantalla de login hacé clic en **¿Olvidaste tu PIN?**.
2. Aparece un mensaje informativo: tenés que pedirle a un administrador que
   te lo restablezca desde **Usuarios → Editar**.

### Cerrar sesión

- Hacé clic en tu **avatar** en la barra superior y elegí **Cerrar sesión**.

[Screenshot: menú desplegable del avatar con opción "Cerrar sesión"]

---

## 5. Tablero (Dashboard)

### Cómo llegar

- Menú lateral → **Tablero** (es la pantalla por defecto al iniciar sesión).

### Qué ves según tu rol

#### Vista de Admin / Supervisor

- **Total Vendido Hoy** — con variación porcentual respecto a ayer.
- **Tickets Hoy** — con variación porcentual respecto a ayer.
- **Cobros Pendientes** — suma de saldos de clientes con fiado.
- **Alertas de Stock** — productos con stock bajo o agotado.
- **Gráfico de ventas** — barras por día (últimos 7 / 30 / 6 meses).
- **Top 5 productos** — gráfico circular por cantidad vendida.
- **Últimas 8 ventas** — tabla resumen.
- **Resumen de stock** — productos más urgentes a reponer.

[Screenshot: dashboard de admin con KPIs y gráfico]

#### Vista de Cajero

Más simple, enfocada en la operación diaria:

- Tickets Hoy.
- Alertas de Stock.
- Resumen de stock.

[Screenshot: dashboard simplificado del cajero]

> 💡 El tablero se actualiza automáticamente al volver a la pantalla. Si una
> venta acaba de hacerse y no aparece, navegá a otra pantalla y volvé.

---

## 6. Caja: apertura, movimientos y cierre

### 6.1 Abrir la caja

**Quién puede:** todos los roles.

#### Cómo llegar

- Menú lateral → **Caja**.
- O al iniciar sesión, si no hay caja abierta, la app te lleva directamente.

#### Paso a paso

1. Ingresá el **monto inicial** (efectivo con que arranca el cajón).
   - Viene **propuesto** con el efectivo que quedó en caja en el último cierre
     (o con el fondo por defecto de Configuración → Caja). Si el cajón tiene
     otra cosa, corregilo: manda lo que hay realmente.
   - Podés dejarlo en **0** — se te pedirá una confirmación explícita.
2. Hacé clic en **Abrir caja** (o presioná Enter).

[Screenshot: pantalla de "Apertura de Caja" con campo de monto inicial]

> ⚠️ **Solo puede haber UNA caja abierta a la vez** en todo el sistema. Si
> intentás abrir otra, te aparece el mensaje *"Ya hay una caja abierta"*.

### 6.2 Operar con la caja abierta

Mientras la caja está abierta, la pantalla muestra en vivo:

- Monto inicial.
- Ventas en efectivo (incluye porción cash de pagos mixtos).
- Ingresos manuales.
- Gastos manuales.
- **Efectivo esperado** = inicial + ventas cash + ingresos − gastos.

[Screenshot: pantalla de caja abierta con KPIs y tabla de movimientos]

#### Registrar un ingreso o gasto

1. Hacé clic en **Nuevo movimiento**.
2. Elegí el tipo: **Ingreso** o **Gasto**.
3. Ingresá el **monto** (mayor a 0).
4. Escribí una **descripción** (obligatoria — ej. *"Pago a delivery"*,
   *"Vuelto de proveedor"*).
5. **Guardar**.

> 📌 Los movimientos quedan ordenados del más reciente al más antiguo en la
> tabla de la pantalla.

### 6.3 Cerrar la caja (Arqueo)

**Quién puede:** Admin o Supervisor (los cajeros NO pueden cerrar).

#### Paso a paso

1. Hacé clic en **Cerrar caja**.
2. Contá físicamente el efectivo en el cajón.
3. Ingresá el **monto contado** en el campo correspondiente.
4. La pantalla calcula automáticamente:
   - **Esperado** (lo que debería haber).
   - **Diferencia** (contado − esperado). Negativo = falta plata. Positivo = sobra.
5. Ingresá el **efectivo que queda en caja** (el fondo para el próximo turno).
   Viene propuesto con el fondo por defecto; corregilo si ese día dejás otro
   monto (por ejemplo 590.000 o 620.000). No puede ser mayor que el contado.
6. La pantalla muestra **A retirar / entregar** = contado − lo que queda. Es la
   plata que se saca del cajón; **no cambia el arqueo** (esperado y diferencia).
7. Si la diferencia no es 0, agregá una **nota explicativa**. Las notas se
   imprimen al pie del comprobante PDF del cierre, junto con "Queda en caja" y
   "Retiro / entrega".
8. Hacé clic en **Confirmar cierre**.

[Screenshot: modal de cierre de caja con campos esperado/contado/diferencia]

> ⚠️ Si la caja se abrió **un día anterior** y la estás cerrando hoy, las
> **notas son obligatorias** y queda registrado en la auditoría del sistema.

#### Qué pasa al cerrar

- Si tenés activado **Backup automático al cierre de caja**, se hace un backup
  de la base de datos.
- Si hay productos con stock bajo, aparece una **notificación del sistema**.

### 6.4 Historial de Movimientos de Caja

**Quién puede:** todos los roles. Los cajeros ven **solo sus propios
movimientos**; admin y supervisor ven todo.

#### Cómo llegar

- Menú lateral → **Mov. de Caja**.

#### Qué muestra

Una tabla con cada movimiento de caja a lo largo del tiempo, no solo los
de la caja abierta. Cada fila puede ser:

- **Apertura** (azul) — monto con el que se abrió esa caja.
- **Ingreso** (verde) — ingreso manual registrado durante la operación.
- **Egreso** (naranja) — gasto manual.
- **Cierre** (azul) — monto contado al cerrar.
- **Anulación** (gris) — fila inversa creada cuando se anula un ingreso o
  egreso (ver más abajo).

> 📌 Las **ventas en efectivo no aparecen acá**. Para esas usá el
> **Historial de ventas** (sección 8).

#### Filtros

- **Desde / Hasta** — rango de fechas (por defecto, hoy).
- **Cajero** — admin/supervisor pueden filtrar por cajero; el cajero queda
  fijo en su propio nombre.
- **Caja** — filtrar por una sesión específica de caja (apertura/cierre).
- **Tipo** — multi-selección de ingreso / egreso / apertura / cierre / anulación.
- **Buscar en descripción** — texto libre, no distingue mayúsculas.
- **Por página** — 10, 25, 50 o 100 filas.

> 📌 Cualquier cambio de filtro vuelve la lista a la página 1.

#### Saltar al cierre original

Hacé clic en el número de **Caja** (`#42` por ejemplo) en cualquier fila para
ir directo al detalle del cierre en **Reportes → Cierres Caja**. Si la caja
todavía está abierta, te lleva a la página **Caja** en su lugar.

#### Anular un movimiento (admin/supervisor)

Si un cajero registró un ingreso o egreso por error, podés anularlo:

1. Encontrá la fila en la lista.
2. Hacé clic en **Anular** (columna Acciones).
3. Confirmá.

Resultado:

- El movimiento original **no se borra** — queda marcado como **Anulado**
  (monto tachado + badge gris).
- Se crea un movimiento nuevo de tipo **Anulación** con el mismo monto, y la
  descripción prefijada `[ANULACIÓN]`.
- El balance de la caja se corrige automáticamente.

> ⚠️ **Aperturas y cierres no se anulan desde acá** — son montos del sistema.
> Si hay un error en el cierre, tenés que corregirlo desde Reportes.
> Tampoco se puede "anular una anulación".

#### Exportar a Excel

El botón **Excel** (arriba a la derecha) descarga un `.xlsx` con **todas las
filas que coinciden con los filtros actuales**, no solo la página visible.

- Nombre del archivo: `movimientos-caja_DESDE_HASTA.xlsx`.
- Si el rango filtrado tiene más de 10.000 filas, el sistema te avisa antes
  de generar el archivo y te ofrece estrechar las fechas.

[Screenshot: página "Mov. de Caja" con filtros y tabla cargada]

---

## 7. Ventas (POS)

Esta es la pantalla más usada del sistema. Está diseñada para que un cajero
pueda procesar una venta lo más rápido posible: con teclado, lector de código
o pantalla táctil.

### 7.1 Cómo llegar

- Menú lateral → **Ventas**.
- Atajo desde el tablero: botón **Nueva Venta**.

> ⚠️ Si **no hay caja abierta**, la pantalla te muestra un aviso a pantalla
> completa para abrir una.

[Screenshot: pantalla principal de POS con grilla de productos y carrito]

### 7.2 Estructura de la pantalla

La pantalla se divide en dos zonas:

- **Izquierda:** búsqueda, filtro por categoría y grilla de productos.
- **Derecha:** carrito, descuento, total y botón de **Cobrar**.

### 7.3 Agregar productos al carrito

Tres formas de agregar un producto:

#### A) Tocar/clickear en la grilla

1. Buscá el producto por nombre o código de barras (campo de búsqueda arriba).
2. Filtrá por **categoría** con los chips (Vacuno, Cerdo, Pollo, …).
3. Hacé clic en la tarjeta del producto.
4. Se abre el **modal de cantidad** (ver 7.4).

> 💡 La grilla carga de a 30 productos. Bajá con el scroll para cargar más.

> 🚫 Productos **sin stock** aparecen deshabilitados.
> ⚠️ Productos con **stock bajo** muestran un badge de aviso.

#### B) Lector de código de barras

1. Asegurate de que **no haya un modal abierto** y que el cursor **no esté en
   un campo de texto**.
2. Pasá el código por el lector.
3. El producto se agrega automáticamente al carrito.

> 📌 Si el código es de **balanza** (empieza con `2X` y mide 13 dígitos), el
> sistema **detecta automáticamente** el peso embebido y agrega el producto
> con esa cantidad en kilogramos.

#### C) Modal de cantidad (para productos por peso o múltiples unidades)

Cuando hacés clic en un producto, se abre el modal con dos modos:

- **Por cantidad** — ingresás cuántos kg / litros / unidades. Tiene presets
  rápidos: `0.25, 0.5, 1, 2` para peso; `1, 2, 5, 10` para unidades.
- **Por monto** — ingresás cuántos guaraníes querés llevar y el sistema
  calcula la cantidad equivalente.

[Screenshot: modal de cantidad con modo "Por cantidad" y "Por monto"]

**Botones útiles:**

- **máx** — completa hasta el stock disponible.
- Aviso en rojo si la cantidad supera el stock.

### 7.4 Modificar el carrito

- **Cantidad:** botones `+` y `−` en cada línea (paso depende del tipo:
  0.25 kg, 1 unidad, 50 g, etc.).
- **Eliminar línea:** ícono de papelera.
- **Vaciar carrito:** botón **Cancelar** (con confirmación) o atajo **F8**.
- **Suspender venta:** botón **Suspender** o atajo **F9** (ver 7.7).

### 7.5 Aplicar un descuento

1. Presioná **F4** (o hacé clic en el campo Descuento).
2. Ingresá el descuento como **monto fijo en Gs.** o como **porcentaje (%)**.
3. El total se actualiza automáticamente.

> 💡 Si elegís porcentaje, se recalcula al agregar/quitar productos.

### 7.6 Cobrar

1. Hacé clic en **Cobrar** o presioná **F12**.
2. Se abre el **modal de cobro**.

[Screenshot: modal de cobro con métodos de pago]

#### Métodos de pago

| Método             | Cuándo usarlo                                         |
|--------------------|-------------------------------------------------------|
| **Efectivo**       | El cliente paga en plata. Calcula el vuelto.          |
| **Transferencia**  | Pago por transferencia bancaria/billetera virtual.    |
| **Fiado**          | El cliente queda debiendo. **Requiere cliente**.      |
| **Mixto**          | Combina hasta 3 métodos (cash + transfer + fiado).    |

#### Efectivo

1. Ingresá el monto recibido.
2. El sistema muestra el **vuelto** automáticamente cuando recibido ≥ total.
3. Confirmá.

#### Fiado

1. Buscá al cliente (mínimo 2 caracteres).
2. Seleccionalo (queda como un chip con su saldo actual).
3. Confirmá. El saldo del cliente se actualiza.

> ⚠️ **Sin cliente seleccionado, no podés cobrar como Fiado.**

#### Mixto

1. Distribuí el total entre hasta 3 métodos.
2. La suma debe ser **igual al total** (la app valida).
3. Si una porción es fiado, **es obligatorio** elegir cliente.

#### Después del cobro

Se abre automáticamente la **vista previa del ticket**:

- **PDF** — descargar el ticket como PDF.
- **Imprimir** — enviar a la impresora térmica.
- **Nueva Venta** — volver al POS limpio.

> 🖨️ Si **no tenés impresora configurada**, el botón Imprimir se reemplaza
> por **Configurar impresora** que te lleva a Configuración.

[Screenshot: vista previa del ticket con botones PDF / Imprimir / Nueva Venta]

### 7.7 Suspender una venta (Tickets pendientes)

Cuando un cliente decide no comprar pero querés guardar el carrito (por
ejemplo, mientras va por más cosas):

1. Presioná **F9** o el botón **Suspender**.
2. El carrito queda guardado como **ticket pendiente**.

Para retomarlo:

1. Hacé clic en el badge **Pendientes (N)** arriba del carrito.
2. Elegí el ticket que querés retomar.
3. Si el carrito actual no está vacío, te avisa antes de reemplazarlo.

[Screenshot: badge de tickets pendientes y modal de selección]

> 📌 Los tickets pendientes se guardan en **esta computadora**. Si reinstalás
> el sistema o cambiás de PC, se pierden.

### 7.8 Anular una venta

**Quién puede:** Admin o Supervisor.

1. Andá a **Historial de Ventas**.
2. Buscá la venta.
3. Hacé clic en **Anular**.
4. Confirmá.

#### Qué hace la anulación automáticamente

- ✅ El **stock se devuelve** a los productos vendidos.
- ✅ Si era **fiado**, el saldo se devuelve al cliente.
- ✅ La venta queda marcada como `cancelled` y **deja de contar** en reportes
  y en la caja.
- ✅ Queda registro en la auditoría con quién anuló y cuándo.

> ⚠️ **Caso especial:** ventas **mixtas con porción fiada** — la parte fiada
> NO se devuelve automáticamente al saldo del cliente. En ese caso, registrá
> manualmente un pago de cliente con la nota *"Reverso parcial venta #ID"*.

> 🔁 Anular dos veces la misma venta no hace nada (es **idempotente**).

---

## 8. Historial de ventas

### Cómo llegar

- Menú lateral → **Ventas** → pestaña **Historial** (o ruta `/ventas`).

### Para qué sirve

- Consultar todas las ventas realizadas.
- Reimprimir tickets.
- Ver detalle de items y pagos.
- Anular ventas.
- Exportar a Excel o PDF.

### Filtros

- **Rango de fechas:** por defecto, del **primer día del mes** hasta hoy.
- **Cambiar rango:** clic en los datepickers y aplicá.

[Screenshot: pantalla de historial con filtros de fecha y tabla]

### Columnas

| Columna       | Descripción                                            |
|---------------|--------------------------------------------------------|
| Fecha         | Fecha y hora de la venta.                              |
| ID            | Número de ticket.                                      |
| Cliente       | Nombre, si la venta tuvo cliente asociado.             |
| Total         | Monto total en Gs.                                     |
| Método pago   | Efectivo / Transferencia / Fiado / Mixto.              |
| Cajero        | Quién procesó la venta.                                |
| Acciones      | Ver detalle · Reimprimir · Anular.                     |

> 💡 Las ventas a fiado de un cliente que ya no debe nada muestran el badge
> **Fiado · Pagado**.

### Detalle de una venta

Hacé clic en el ID o en **Ver**. Vas a ver:

- Items con cantidad, precio unitario y subtotal.
- Totales (subtotal, descuento, total).
- Desglose de pagos (en mixto, cuánto fue por cada método).
- Notas internas si tiene.
- Botón de **impresora** para reimprimir el ticket.

### Exportar

- **Exportar a Excel** — descarga `.xlsx`.
- **Exportar a PDF** — descarga `.pdf` con encabezado rojo de Multicarnes.

---

## 9. Productos y stock

### Cómo llegar

- Menú lateral → **Productos**.

### Quién puede editar

- Admin y Supervisor: crear, editar, activar/desactivar.
- Cajero: solo consulta.

### 9.1 Listado de productos

[Screenshot: listado de productos con filtros y tabla]

**Filtros disponibles:**

- Búsqueda por **nombre o código de barras**.
- **Categoría** (Vacuno, Cerdo, Pollo, Embutidos, Otros, o las que crees).
- **Estado**: activos, inactivos, todos.
- **Stock bajo**: solo productos con stock ≤ stock mínimo.

**Indicadores:**

- 🔴 **Sin stock** — stock ≤ 0.
- 🟡 **Bajo mínimo** — stock ≤ stock mínimo.

### 9.2 Crear un producto

1. Hacé clic en **Nuevo producto**.
2. Completá los campos obligatorios:
   - **Nombre** (obligatorio).
   - **Precio** (obligatorio).
3. Opcionales:
   - **Código de barras** (debe ser único si lo cargás).
   - **Categoría** (podés crear una nueva inline desde el formulario).
   - **Tipo de precio** (ver tabla abajo).
   - **Stock inicial** y **stock mínimo**.
   - **Imagen** (PNG, JPG, JPEG o WebP).

[Screenshot: formulario de creación de producto]

#### Tipos de precio disponibles

| Tipo      | Decimales | Paso típico       | Cuándo usar                        |
|-----------|-----------|-------------------|--------------------------------------|
| `unit`    | 0         | 1 unidad          | Productos por unidad (lata, paquete)|
| `kg`      | 3         | 0.001 kg          | Carnes, fiambres por peso            |
| `g`       | 0         | 50 g              | Productos chicos por gramo           |
| `l`       | 2         | 0.01 l            | Líquidos por litro                   |
| `ml`      | 0         | 50 ml             | Líquidos chicos                      |
| `m`       | 2         | 0.01 m            | Productos por metro                  |
| `docena`  | 0         | 1 docena          | Huevos, etc.                         |
| `paquete` | 0         | 1 paquete         | Por paquete cerrado                  |

### 9.3 Editar un producto

1. Clic en la fila o en **Editar**.
2. Cambiá lo que necesites.
3. **Guardar**.

### 9.4 Ajustar stock manualmente

Cuando contás físicamente y el sistema no coincide:

1. Entrá al **detalle del producto**.
2. Clic en **Ajustar stock**.
3. Ingresá el nuevo stock.
4. Escribí una **razón obligatoria** (ej. *"Inventario físico mensual"*,
   *"Rotura"*, *"Producto vencido"*).
5. Guardar.

[Screenshot: modal de ajuste de stock con campo de razón]

> 📋 Cada ajuste queda registrado con: fecha, usuario, valor antes, valor
> después, y la razón. Lo ves en el detalle del producto y en el reporte
> **Movimientos de Stock**.

> ℹ️ **Las ventas NO generan ajustes manuales** — solo las correcciones
> manuales y las recepciones de compras.

### 9.5 Detalle del producto

Mostrar el detalle te trae:

- KPIs: stock actual, precio, unidades vendidas en 7 días, último costo.
- **Margen %** = (precio venta − último costo) / precio venta.
- Últimas 20 ventas del producto (con cliente y cajero).
- Auditoría de ajustes de stock.
- Botón para **Activar / Desactivar** (con confirmación).

[Screenshot: detalle de producto con KPIs y tabla de ventas recientes]

### 9.6 Categorías

- Se crean al vuelo desde el formulario de producto.
- Por defecto vienen: Vacuno, Cerdo, Pollo, Embutidos, Otros.
- Los nombres deben ser únicos.

---

## 10. Clientes y cuentas con fiado

### Cómo llegar

- Menú lateral → **Clientes**.

### 10.1 Listado de clientes

**Filtros:**

- Búsqueda por **nombre, teléfono o documento**.
- Toggle **Solo empleados**.

[Screenshot: listado de clientes con búsqueda]

### 10.2 Crear un cliente

1. **Nuevo cliente**.
2. Completá:
   - **Nombre** (obligatorio).
   - **Teléfono**, **dirección** (opcionales).
   - **Documento** y **tipo** (CI o RUC).
   - Marcá **Es empleado** si corresponde.
3. **Guardar**.

### 10.3 Saldo del cliente

El campo **Saldo** funciona así:

- 🔴 **Negativo** → el cliente le debe a la tienda (fiado pendiente).
- 🟢 **Positivo** → la tienda le debe al cliente (sobre-pago / nota de crédito).
- 0 → cuenta saldada.

### 10.4 Registrar un pago de fiado

Cuando un cliente viene a pagar lo que debe:

1. Abrí su **ficha** (clic en el nombre).
2. Pestaña **Pagos** → **Nuevo pago**.
3. Ingresá:
   - **Monto**.
   - **Nota** (ej. *"Pago parcial mensual"*).
4. Guardar.

[Screenshot: ficha del cliente con historial de pagos]

> 💡 El saldo se actualiza automáticamente en la misma transacción.

### 10.5 Ficha del cliente

Muestra:

- **Datos personales** y saldo actual.
- **Historial de ventas** con líneas expandibles.
- **Historial de pagos** con notas.

### 10.6 Eliminar un cliente

> ⛔ **No podés eliminar** un cliente que:
> - Tiene saldo distinto de 0, o
> - Tiene al menos una venta registrada, o
> - Tiene al menos un pago registrado.

Si querés "ocultarlo", desactivalo en lugar de borrarlo.

---

## 11. Proveedores y compras

### 11.1 Proveedores

#### Cómo llegar

- Menú lateral → **Proveedores**.

#### Crear proveedor

1. **Nuevo proveedor**.
2. Completá: nombre, teléfono, email, dirección.
3. Guardar.

[Screenshot: listado y formulario de proveedor]

### 11.2 Compras (órdenes a proveedor)

#### Cómo llegar

- Menú lateral → **Compras**.

#### Estados de una orden

| Estado    | Significado                                     |
|-----------|-------------------------------------------------|
| Pendiente | Orden creada, mercadería todavía no llegó.      |
| Recibida  | Mercadería entró, stock actualizado.            |
| Cancelada | Orden anulada, no afecta stock.                 |

[Screenshot: listado de compras con filtros por estado]

#### Crear una orden de compra

1. **Nueva compra**.
2. Elegí el **proveedor** (opcional).
3. Agregá items: buscá el producto, ingresá **cantidad** y **costo unitario**.
4. Dos formas de guardar:
   - **Guardar como Pendiente** — queda en estado pendiente, **no toca el stock**.
   - **Guardar y Recibir** — queda como recibida y **suma al stock** inmediatamente.

[Screenshot: formulario de nueva compra con items]

#### Marcar como recibida una orden pendiente

1. Entrá al detalle de la orden.
2. Clic en **Marcar como recibida**.
3. El stock de cada producto se incrementa.
4. Queda registro en la auditoría de stock.

#### Cancelar una orden

- Solo afecta el estado, no toca el stock (porque pendiente nunca lo había
  tocado).

---

## 12. Reportes

### Cómo llegar

- Menú lateral → **Reportes**.

### Funcionamiento general

1. Elegí el **rango de fechas** (por defecto, primer día del mes a hoy).
2. Hacé clic en **Consultar**.
3. La pestaña activa carga los datos.

[Screenshot: pantalla de reportes con pestañas y selector de fechas]

### Pestañas disponibles

| Pestaña               | Qué muestra                                                          |
|------------------------|----------------------------------------------------------------------|
| **Resumen**            | Tickets, subtotal, descuentos, total. Tablas por día, por método y por cajero. |
| **Comparativo**        | Período actual vs. período anterior equivalente, con Δ%.            |
| **Fiados Pendientes**  | Clientes con saldo negativo, último fiado, último pago.             |
| **Más Vendidos**       | Top productos por cantidad y revenue. Filtro opcional por categoría.|
| **Margen**             | Por producto: precio venta, último costo, margen Gs y %.            |
| **Mov. Stock**         | Auditoría de ajustes de stock con delta color-codificado.           |
| **Cierres Caja**       | Cierres pasados: abierto, cerrado, cajero, esperado, contado, diferencia. |

### Exportar reportes

Cada pestaña con datos muestra los botones:

- **Excel** — `.xlsx` con hoja "Reporte".
- **PDF** — con encabezado rojo de Multicarnes y pie con cantidad de registros.

> 💡 Los botones de exportar **se ocultan** si la pestaña activa no tiene datos.

[Screenshot: tabla de reporte con botones Excel/PDF arriba]

---

## 13. Usuarios (solo administrador)

### Cómo llegar

- Menú lateral → **Usuarios**.

> 🔒 Solo el rol **Admin** puede acceder a esta pantalla.

### 13.1 Crear un usuario

1. **Nuevo usuario**.
2. Ingresá:
   - **Nombre** (obligatorio).
   - **Rol**: Admin / Supervisor / Cajero.
   - **PIN** de 6 dígitos.
   - **Confirmar PIN**.
3. **Guardar**.

[Screenshot: formulario de creación de usuario]

### 13.2 Editar un usuario

1. Clic en el usuario.
2. Cambiá los datos que necesites.
3. **Cambiar PIN** es opcional — si lo dejás en blanco, queda el actual.
4. Marcá/desmarcá **Activo** para habilitar o deshabilitar.

> ℹ️ **No existe eliminación de usuarios.** Para "borrarlos", desactivalos.
> Los usuarios desactivados no aparecen en la pantalla de login.

### 13.3 Resetear el PIN de alguien

Si un usuario olvidó su PIN:

1. Entrá a su ficha → **Editar**.
2. Cargá un nuevo **PIN** y confirmalo.
3. Guardar.
4. Avisale al usuario el nuevo PIN. Recomendalo a que lo cambie en
   **Mi perfil** apenas pueda.

### 13.4 Roles y permisos

| Acción                         | Admin | Supervisor | Cajero |
|--------------------------------|:-----:|:----------:|:------:|
| Iniciar sesión                 |   ✓   |     ✓      |    ✓   |
| Tablero                        |   ✓   |     ✓      |    ✓   |
| Vender (POS)                   |   ✓   |     ✓      |    ✓   |
| Abrir caja                     |   ✓   |     ✓      |    ✓   |
| Cerrar caja                    |   ✓   |     ✓      |    ✗   |
| Anular venta                   |   ✓   |     ✓      |    ✗   |
| Ver historial de ventas        |   ✓   |     ✓      |    ✓   |
| Productos (crear/editar)       |   ✓   |     ✓      |    ✗   |
| Ajustes de stock               |   ✓   |     ✓      |    ✗   |
| Clientes                       |   ✓   |     ✓      |    ✗   |
| Proveedores y compras          |   ✓   |     ✓      |    ✗   |
| Reportes                       |   ✓   |     ✓      |    ✗   |
| Usuarios                       |   ✓   |     ✗      |    ✗   |
| Configuración                  |   ✓   |     ✗      |    ✗   |
| Backup / restauración          |   ✓   |     ✗      |    ✗   |
| Mi perfil (cambiar PIN propio) |   ✓   |     ✓      |    ✓   |

---

## 14. Configuración

### Cómo llegar

- Menú lateral → **Configuración**.

> 🔒 Solo el rol **Admin** accede.

### 14.1 Identidad del negocio

Estos datos aparecen en el **encabezado del ticket**.

- **Nombre del negocio**.
- **Dirección**.
- **Teléfono**.

[Screenshot: pestaña Identidad del negocio]

### 14.2 Login

- **Teclado numérico en pantalla** — actívalo para terminales táctiles.

### 14.3 Impresora térmica

- **Nombre de la impresora** (tal cual lo reporta el sistema operativo).
- **Ancho del papel**: 58 mm (32 caracteres) o 80 mm (48 caracteres).

[Screenshot: pestaña Impresora térmica con nombre y ancho]

> 💡 Para encontrar el nombre de la impresora en Windows:
> Panel de control → Dispositivos e impresoras → click derecho → Propiedades.

### 14.4 Backup

- **Carpeta de backup** — donde se guardan los archivos `.db`.
- **Backup automático al cierre de caja** — sí/no.
- **Backup programado diario** — sí/no, con hora HH:MM.

(Detalle completo en sección 15.)

### 14.5 Tutoriales

- Botón **Reiniciar tutoriales** — limpia el historial para que vuelvan a
  aparecer los tours guiados en cada pantalla.

[Screenshot: pestaña Tutoriales con botón Reiniciar]

### 14.6 Tema (claro / oscuro)

- Se cambia desde el ícono de **sol/luna** en la barra superior.
- La preferencia se guarda en esta computadora.

---

### 14.7 Caja: fondo por defecto

- **Fondo de caja por defecto (Gs.)** — efectivo que suele quedar en el cajón
  para el próximo turno (por ejemplo 600.000).
- Se precarga en **Queda en caja** al cerrar (se puede corregir en cada cierre)
  y se propone como monto de apertura cuando el último cierre no registró fondo.
- Dejalo en **0** para no usarlo. Solo el Admin puede cambiarlo.

## 15. Backup y restauración

### Cómo llegar

- Menú lateral → **Backup** (solo Admin).

### Por qué importa

Toda tu información (ventas, productos, clientes, fiados) vive en **un solo
archivo** llamado `pos.db` en esta computadora. Si esa máquina se rompe sin
backup, **se pierde todo**.

> 📌 Hacé backup **al menos una vez al día**. Idealmente, copiá los backups
> a un pendrive o nube fuera de la PC.

### 15.1 Backup manual

1. Clic en **Hacer backup ahora**.
2. Se crea un archivo con el nombre `backup_YYYY-MM-DDTHH-mm-ss.db` en la
   carpeta configurada.
3. Aparece un mensaje de éxito.

[Screenshot: pantalla de backup con botón "Hacer backup ahora"]

### 15.2 Backup automático al cierre de caja

1. Configuración → Backup → Activar **Backup automático al cierre de caja**.
2. Cada vez que un supervisor o admin cierra la caja, se hace un backup.

### 15.3 Backup programado diario

1. Configuración → Backup → Activar **Backup programado**.
2. Definí una **hora HH:MM** (ej. `22:00`).
3. La app revisa cada minuto si llegó la hora; ejecuta como mucho **un backup
   por día**.
4. La app muestra **"Próximo backup"** y notifica al sistema si tuvo éxito o
   falló.

> ⚠️ La app debe estar **abierta** a la hora programada para que el backup
> se ejecute.

### 15.4 Restaurar un backup

> 🚨 La restauración **sobrescribe la base actual**. Asegurate de hacer una
> copia previa por las dudas (la app igualmente la hace automáticamente).

1. Clic en **Restaurar backup**.
2. Elegí el archivo `.db` desde el explorador.
3. Aparece un **modal de confirmación en rojo** con la advertencia.
4. Confirmá.
5. El sistema:
   - Hace un backup automático del estado actual primero.
   - Reemplaza la base con el archivo elegido.

[Screenshot: modal de confirmación de restauración con estilo de peligro]

---

## 16. Mi perfil (cambiar PIN)

### Cómo llegar

- Avatar arriba a la derecha → **Mi perfil**.
- O bloque de usuario en el sidebar → clic en tu nombre.

### Qué ves

- Tu **nombre**, **rol** (con badge de color), **estado** (activo / inactivo),
  ID y fecha de creación.

[Screenshot: pantalla "Mi perfil" con datos y formulario de cambio de PIN]

### Cambiar tu PIN

1. Ingresá tu **PIN actual** (6 dígitos).
2. Ingresá el **nuevo PIN** (6 dígitos).
3. Confirmá el nuevo PIN.
4. Hacé clic en **Cambiar PIN**.

**Reglas:**

- Los tres campos son **obligatorios**.
- El nuevo PIN debe **diferir del actual**.
- El PIN actual debe **coincidir** con el guardado (verificación en el servidor).

> ✅ Cualquiera puede cambiar **su propio** PIN, sin importar el rol.

---

## 17. Hardware: impresora, lector y balanza

### 17.1 Impresora térmica

**Compatibilidad:** impresoras ESC/POS de 58 mm o 80 mm (la mayoría de las
económicas: Epson TM-T20, XPrinter, Bematech, etc.).

**Configuración:**

1. Conectá la impresora al equipo (USB o Ethernet) e instalá su driver.
2. Verificá el **nombre exacto** que el sistema operativo le asigna.
3. **Configuración → Impresora térmica** → cargá el nombre y el ancho.
4. Hacé una venta de prueba para confirmar.

**Si algo falla:**

- *"No hay impresora configurada."* → no cargaste el nombre en Configuración.
- *"No se pudo conectar a la impresora."* → revisá cable, encendido y driver.

[Screenshot: ticket impreso de ejemplo]

### 17.2 Lector de código de barras

- Funciona como **teclado USB** (HID). No requiere configuración especial.
- Escaneá en cualquier momento mientras estés en la pantalla de Ventas.
- **No** funciona si tenés un modal abierto o el cursor en un campo de texto.

### 17.3 Balanza comercial

**Modelo soportado:** Bizerba, Toledo y similares que impriman EAN-13 con
prefijo `2X` (donde X es cualquier dígito) y peso embebido.

**Cómo lo decodifica el sistema:**

- Posiciones 2-7 → **código del producto** (5 dígitos).
- Posiciones 7-12 → **peso en gramos** (5 dígitos).
- Convierte a kilogramos automáticamente.

**Requisitos:**

- El producto en el sistema debe tener:
  - El **código de balanza** como código de barras.
  - **Tipo de precio kg** (sino, aparece un toast advirtiendo).

> 💡 Si la balanza imprime un código pero no funciona: probá escanearlo en un
> bloc de notas. Si no aparecen 13 dígitos, hay que reconfigurar la balanza.

---

## 18. Atajos de teclado

### En la pantalla de Ventas (POS)

| Tecla   | Acción                                                |
|---------|-------------------------------------------------------|
| **F1**  | Abrir tour guiado de la pantalla.                     |
| **F4**  | Foco en el campo de descuento (selecciona contenido). |
| **F8**  | Cancelar carrito (con confirmación).                  |
| **F9**  | Suspender venta (queda en pendientes).                |
| **F12** | Abrir modal de cobro (si hay items en el carrito).    |

> ⚠️ Los atajos NO funcionan si tenés un modal abierto.

### Globales

| Tecla    | Acción                            |
|----------|-----------------------------------|
| **Enter**| Confirmar formularios y diálogos. |
| **Esc**  | Cerrar modales abiertos.          |

---

## 19. Preguntas frecuentes

#### ¿La aplicación necesita internet?

**No.** Toda la información se guarda local. Solo necesitarías internet si
querés copiar los backups a la nube.

#### ¿Puedo usar el sistema en varias computadoras al mismo tiempo?

No. La base de datos es local en cada equipo. Cada computadora es un sistema
independiente.

#### Olvidé mi PIN. ¿Cómo recupero?

No hay recuperación automática. Pedile a un **administrador** que te lo
restablezca desde **Usuarios → Editar**.

#### ¿Por qué la moneda no tiene decimales?

La moneda es **Guaraní (Gs.)**, que históricamente no usa decimales.

#### ¿Qué pasa si se corta la luz en mitad de una venta?

- Si la venta **no se confirmó** (no apretaste Cobrar): se pierde el carrito.
- Si la venta **se confirmó**: queda guardada (la base de datos usa
  transacciones atómicas).

#### Vendí a un cliente y se equivocó. ¿Cómo lo corrijo?

**Anulá la venta** desde Historial. El stock vuelve y, si era fiado, el saldo
del cliente se devuelve.

#### El stock que tengo en sistema no coincide con el real

Hacé un **ajuste manual** desde el detalle del producto, con una razón clara
(ej. *"Inventario físico 10/05"*).

#### ¿Cómo agrego un producto nuevo a la balanza?

1. En el sistema, creá el producto con tipo de precio **kg**.
2. Asignale el **código de balanza** como código de barras.
3. Programá ese mismo código en la balanza física.

#### ¿Puedo cambiar un ticket ya impreso?

No. Para corregir, **anulá la venta** y registrala de nuevo.

#### ¿Cómo cambio mi PIN?

Avatar → **Mi perfil** → ingresá PIN actual + nuevo PIN dos veces.

#### ¿Cuántos métodos de pago puedo combinar en una venta mixta?

Hasta **3** (efectivo + transferencia + fiado), siempre que la suma sea igual
al total.

#### ¿Los reportes muestran las ventas anuladas?

**No.** Las ventas anuladas se filtran de los reportes y de los KPIs de caja.

---

## 20. Solución de problemas

### "Ya hay una caja abierta"

**Causa:** otro usuario abrió una caja y no la cerró.

**Solución:** entrá a **Caja**, mirá quién la abrió y cuándo, y coordiná el
cierre con esa persona o un supervisor.

### "No hay impresora configurada. Andá a Configuración → Impresora térmica."

**Causa:** la primera vez no cargaste el nombre de la impresora.

**Solución:** Configuración → Impresora térmica → cargá el nombre exacto de
la impresora y el ancho del papel.

### "No se pudo conectar a la impresora"

**Posibles causas:**

- Impresora apagada o sin papel.
- Cable USB suelto.
- El nombre cargado en Configuración no coincide con el del sistema.
- Driver de impresora no instalado.

**Solución:** revisá una por una.

### El lector de código no agrega productos

- ¿Hay un modal abierto? Cerralo.
- ¿El cursor está en el campo de búsqueda u otro input? Hacé clic fuera.
- ¿El código está en el sistema? Probá escanearlo en el campo de búsqueda
  para confirmar que lee.

### El código de balanza no se decodifica

- ¿Empieza con `2X` (X = dígito) y tiene 13 caracteres? Si no, no es un
  código de balanza válido.
- ¿El producto está en el sistema con tipo de precio **kg**? Si no, aparece
  un toast advirtiendo.

### No puedo cobrar a fiado

- ¿Seleccionaste un cliente? Es **obligatorio** para fiado y para mixto con
  porción fiada.

### El backup automático no se ejecutó

- ¿La app estaba abierta a la hora programada?
- ¿La carpeta de backup existe y tenés permiso de escritura?
- Revisá las notificaciones del sistema operativo: la app avisa cuando falla.

### "Diferencia" en el cierre de caja distinta de 0

- Falta plata (negativo) → puede haber un error de vuelto, un gasto sin
  registrar o efectivo retirado del cajón sin cargar como gasto.
- Sobra plata (positivo) → ingreso no registrado o vuelto mal calculado.
- En ambos casos: **agregá una nota explicativa** y hacé seguimiento.

### La pantalla queda en blanco al iniciar

- Cerrá completamente la app y volvé a abrirla.
- Si persiste: verificá que no haya un proceso anterior corriendo (Task
  Manager / Activity Monitor).
- Si nada funciona: tu administrador puede restaurar el último backup.

---

## 21. Glosario

| Término                | Definición                                                                       |
|------------------------|----------------------------------------------------------------------------------|
| **Arqueo**             | Conteo físico del efectivo al cerrar la caja para verificar contra el esperado.  |
| **Backup**             | Copia de seguridad del archivo `pos.db`.                                         |
| **Cajero**             | Rol con permiso para vender y abrir caja.                                        |
| **CI**                 | Cédula de Identidad.                                                             |
| **EAN-13**             | Código de barras estándar de 13 dígitos.                                         |
| **ESC/POS**            | Protocolo estándar para impresoras térmicas (Epson Standard Code for POS).       |
| **Fiado**              | Venta a crédito a un cliente registrado; queda pendiente de cobro.               |
| **Idempotente**        | Se puede repetir varias veces sin efectos adicionales (ej. anular dos veces).    |
| **IPC**                | *Inter-Process Communication* — comunicación interna del sistema.                |
| **KPI**                | *Key Performance Indicator* — métrica clave (Total vendido hoy, Tickets, etc.). |
| **PDF**                | Formato de archivo del ticket exportado.                                         |
| **PIN**                | Clave numérica de 6 dígitos para iniciar sesión.                                 |
| **POS**                | *Point of Sale* — punto de venta.                                                |
| **RUC**                | Registro Único de Contribuyente (Paraguay).                                      |
| **Soft-delete**        | Borrado lógico: el registro queda marcado como inactivo, no se elimina.          |
| **Stock mínimo**       | Umbral por debajo del cual el producto se considera "stock bajo".                |
| **Supervisor**         | Rol intermedio: vende, cierra caja, gestiona catálogos y reportes.               |
| **Ticket pendiente**   | Venta suspendida que queda guardada en la PC para retomarse después.             |

---

## Soporte

- **Desarrollo y mantenimiento:** Julio Noguera.
- **Documentación técnica:** carpeta [`docs/`](README.md) del proyecto.
- **Reporte de bugs:** plantilla en [`docs/qa/`](qa/README.md).

---

*Última actualización del manual: mayo 2026.*
