# Especificación de Funcionalidad: Estado "leído" en notificaciones del header

**Feature Branch**: `006-notif-read-state`
**Created**: 2026-05-14
**Status**: Draft
**Input**: Descripción del usuario: "Las notificaciones del dropdown del header deben marcarse como leídas y desaparecer del badge/listado una vez que el usuario las visualiza (abre el dropdown o hace clic en la notificación). Hoy 'Cobros pendientes' sigue mostrando el badge '1' aunque el usuario ya la haya visto."

## Clarifications

### Session 2026-05-14

- Q: ¿Las filas dentro del dropdown deben mantenerse visibles después de ser leídas (panel de estado) o desaparecer (modo inbox)? → A: **Modo inbox** — las filas leídas desaparecen al cerrar el dropdown; la próxima apertura muestra "Sin notificaciones pendientes" salvo que haya entrado algo nuevo. El dropdown se comporta como un inbox de notificaciones, no como un panel de estado. (Revisión post-implementación inicial; reemplaza el FR-012 anterior.)
- Q: ¿En qué momento se marca como "leída" una alerta visible? → A: **Al cerrar el dropdown**, no al abrirlo. Así durante la sesión abierta el usuario puede leer las filas sin que se desvanezcan delante de él; al cerrar (por click afuera, click en una fila, o cualquier otro cierre) todo lo visible queda marcado.

## Escenarios de Usuario y Pruebas *(obligatorio)*

### Historia de Usuario 1 - Leer el dropdown lo vacía (Prioridad: P1)

El cajero/supervisor/admin ve el ícono de campana con un número rojo (ej. "1") indicando alertas pendientes. Al hacer clic en la campana y abrir el dropdown, ve listadas las notificaciones nuevas. Cuando cierra el dropdown (clic afuera, navegación al clickear una fila, o cualquier cierre), esas notificaciones quedan marcadas como leídas: el badge desaparece y la próxima apertura del dropdown muestra **"Sin notificaciones pendientes"** mientras no entre algo nuevo al sistema.

**Por qué esta prioridad**: Es el reclamo central del cliente. Hoy el badge nunca se silencia y genera ruido visual permanente, restando valor al sistema de alertas. Resolver esto solo, sin nada más, ya entrega un MVP útil.

**Prueba independiente**: Inicia sesión, fuerza la presencia de al menos un cliente con saldo deudor (Cobros pendientes = 1) o un producto bajo stock. El badge muestra "1". Abre el dropdown y ve la fila correspondiente. Cierra el dropdown. El badge desaparece, y al reabrir el dropdown ve "Sin notificaciones pendientes" mientras el conjunto de alertas no cambie.

**Escenarios de Aceptación**:

1. **Dado** que existe exactamente 1 cliente con saldo deudor y el usuario nunca abrió el dropdown en esta sesión/dispositivo, **Cuando** el usuario hace clic en la campana y abre el dropdown, **Entonces** ve la fila "Cobros pendientes" y al cerrarlo el badge numérico desaparece (la campana se mantiene visible sin contador).
2. **Dado** que el badge ya está oculto porque el usuario ya leyó las notificaciones existentes, **Cuando** el usuario refresca la página o cambia de pantalla y vuelve, **Entonces** el badge sigue oculto y al abrir el dropdown ve el estado "Sin notificaciones pendientes".
3. **Dado** que el usuario abre y cierra el dropdown estando visibles 1 alerta de stock bajo y 1 de cobros pendientes (badge = 2), **Cuando** termina de cerrarlo, **Entonces** el badge desaparece y el dropdown, al reabrirlo, muestra "Sin notificaciones pendientes" (las filas previamente leídas ya no se listan).

---

### Historia de Usuario 2 - Una alerta nueva vuelve a hacer sonar el badge (Prioridad: P2)

Para que el sistema de notificaciones no pierda su utilidad después de la primera lectura, cuando aparezca una alerta **nueva** —un cliente que antes no estaba en la lista de saldo deudor pasa a estarlo, o un producto que antes no estaba bajo stock pasa a estarlo— el badge debe volver a mostrar un contador para llamar la atención del usuario sobre lo nuevo.

**Por qué esta prioridad**: Sin esto, P1 mata silenciosamente el valor del módulo de alertas. Es la pareja indispensable de P1.

**Prueba independiente**: Con P1 implementada y el badge en cero (todo leído), provocar la aparición de una alerta nueva (ej. registrar una venta a crédito a un cliente que antes no debía nada). Verificar que el badge vuelve a mostrar el contador correspondiente solo por ese ítem nuevo.

**Escenarios de Aceptación**:

1. **Dado** que el usuario ya leyó todas las notificaciones existentes y el badge está oculto, **Cuando** un nuevo cliente cae en saldo deudor (o un nuevo producto cae bajo stock), **Entonces** el badge vuelve a aparecer mostrando únicamente el conteo de ítems no vistos aún.
2. **Dado** que un cliente "X" ya fue marcado como leído (estaba en saldo deudor y el usuario abrió el dropdown), **Cuando** ese mismo cliente "X" sigue debiendo (su balance no cambió de signo), **Entonces** el badge NO reaparece por ese cliente. Solo si su deuda se cancela completamente y luego vuelve a aparecer una deuda, cuenta como una alerta nueva.
3. **Dado** que el badge muestra "1" porque hay un nuevo cliente deudor no leído, **Cuando** el usuario abre el dropdown, **Entonces** ese nuevo cliente también pasa a marcarse como leído y el badge vuelve a desaparecer.

---

### Historia de Usuario 3 - Click directo en una fila también la marca como leída (Prioridad: P3)

Cuando el usuario hace clic en una fila específica del dropdown (ej. "Cobros pendientes" → navega a Reportes), esa categoría queda marcada como leída sin necesidad de cerrar manualmente el dropdown primero.

**Por qué esta prioridad**: Mejora pulida sobre P1. Si P1 ya marca todo como leído al abrir, este caso queda cubierto implícitamente; solo se prioriza explícitamente si la implementación de P1 marca como leído al *cerrar* en vez de al *abrir*.

**Prueba independiente**: Con el badge mostrando "1", abrir el dropdown y hacer clic directo sobre la fila "Cobros pendientes". Verificar que al volver al header desde Reportes el badge ya está oculto.

**Escenarios de Aceptación**:

1. **Dado** que el dropdown está abierto y hay una sola fila "Stock bajo", **Cuando** el usuario hace clic sobre la fila y es navegado a Productos, **Entonces** al volver al header el badge ya no aparece para esa alerta.

---

### Casos Borde

- **Múltiples dispositivos del mismo usuario**: El estado de "leído" se guarda por dispositivo/instalación. Si el usuario inicia sesión en otra PC del local, ahí verá el badge encendido aunque ya lo haya leído en otra máquina. Se acepta este comportamiento por simplicidad (no requiere sincronización servidor).
- **Cierre de sesión y nuevo login del mismo usuario en el mismo dispositivo**: El estado de leído persiste. Al volver a entrar, las notificaciones ya leídas siguen marcadas como leídas.
- **Cambio de usuario en el mismo dispositivo**: Cada usuario tiene su propio estado de leído. Lo que el cajero leyó no afecta al supervisor que inicia sesión después.
- **Cajero (rol sin acceso a "Cobros pendientes")**: Solo ve "Stock bajo". La lógica de leído/no leído se aplica idéntica a esa única categoría.
- **Alerta vuelve a entrar al conjunto tras haber salido**: Si un producto sale de "bajo stock" (se repuso) y luego vuelve a caer, se considera una entrada nueva y debe re-encender el badge para ese producto. Lo mismo para un cliente que canceló su deuda y luego vuelve a deber.
- **Refresco periódico (60s) detecta nuevos ítems**: El badge se enciende automáticamente sin que el usuario tenga que recargar; no espera al próximo login.
- **Dropdown vacío (sin alertas o todo leído)**: La campana no muestra badge y el dropdown muestra el estado "Sin notificaciones pendientes". No hay nada que marcar como leído.
- **Múltiples lecturas dentro de la misma sesión sin cambios**: El badge no debe parpadear ni reaparecer entre aperturas del dropdown si no entró nada nuevo.

## Requisitos *(obligatorio)*

### Requisitos Funcionales

- **FR-001**: El sistema DEBE mantener, por usuario y por dispositivo, el conjunto de identidades de entidades de alerta (producto, cliente, etc.) que ya fueron expuestas al usuario en el dropdown de notificaciones.
- **FR-002**: El sistema DEBE marcar como "leídas" todas las alertas que estuvieron visibles en el dropdown durante la sesión abierta, al momento en que el usuario cierra dicho dropdown (por click afuera, click en una fila que navega, o cualquier otro cierre).
- **FR-003**: El badge numérico del ícono de campana DEBE mostrar únicamente el conteo de alertas **no leídas** (entidades que están actualmente en el conjunto de alertas pero que el usuario aún no expuso en una apertura del dropdown).
- **FR-004**: Si el conteo de alertas no leídas es cero, el badge DEBE ocultarse por completo (no mostrar "0", no mostrar un punto). El ícono de campana queda sin decoración.
- **FR-005**: Cuando ingrese una alerta nueva al conjunto (entidad que no estaba previamente y ahora cumple la condición de alerta), el sistema DEBE encenderse el badge con el conteo de no leídas correspondiente, en el próximo refresco de datos o al re-abrir el dropdown.
- **FR-006**: El sistema DEBE considerar como "alerta nueva" tanto el caso de una entidad que nunca estuvo en el conjunto como el caso de una entidad que estuvo, salió del conjunto, y volvió a entrar.
- **FR-007**: El sistema NO DEBE volver a notificar por una entidad ya marcada como leída si dicha entidad permanece continuamente en el conjunto de alertas (sin haber salido en el ínterin), aunque cambien atributos secundarios como el monto adeudado o el nivel exacto de stock.
- **FR-008**: El estado de leído DEBE ser por-usuario: distintos usuarios autenticados en el mismo dispositivo NO deben compartir el mismo conjunto de "ya leído".
- **FR-009**: El estado de leído DEBE persistir entre cierres y aperturas del dropdown, navegaciones entre páginas del POS, y cierres/aperturas de la aplicación, mientras la sesión del usuario y la instalación se mantengan.
- **FR-010**: Cuando una entidad sale del conjunto de alertas (ej. un producto se repuso, un cliente canceló su deuda), su marca de "leído" puede liberarse para evitar acumulación indefinida. El sistema debe seguir cumpliendo FR-006 para la próxima reentrada.
- **FR-011**: El comportamiento debe aplicar a todas las categorías de notificaciones existentes en el dropdown (hoy: "Stock bajo" y "Cobros pendientes") y a cualquier categoría futura que se sume con la misma estructura.
- **FR-012**: El dropdown DEBE mostrar únicamente las filas correspondientes a categorías que tienen al menos una alerta **no leída** para el usuario. Cuando todas las alertas visibles al rol del usuario están leídas, el dropdown DEBE renderizar el estado vacío con el texto "Sin notificaciones pendientes". El marcado como leído ocurre al **cerrar** el dropdown (no al abrirlo), para que las filas no se desvanezcan delante del usuario durante la sesión abierta.

### Entidades Clave

- **Notificación de alerta**: Una alerta del header asociada a una entidad subyacente (un producto bajo stock, un cliente con saldo deudor, etc.). Su identidad estable es el `id` de la entidad subyacente más la categoría a la que pertenece.
- **Registro de lectura**: Por cada combinación (usuario, dispositivo, categoría, id de entidad), un indicador booleano "ya visto". Persiste mientras la entidad permanezca en el conjunto de alertas y mientras el usuario mantenga su sesión/instalación.

## Criterios de Éxito *(obligatorio)*

### Resultados Medibles

- **SC-001**: Tras abrir y cerrar el dropdown sin que cambie el conjunto de alertas, el badge numérico permanece oculto durante el resto de la sesión.
- **SC-002**: El reclamo "el badge no se va aunque yo ya leí la notificación" deja de ocurrir en el 100% de los flujos descritos en las Historias de Usuario 1 y 2.
- **SC-003**: Cuando se genera una alerta verdaderamente nueva (un nuevo deudor, un nuevo producto bajo stock), el badge vuelve a aparecer y se actualiza dentro del intervalo de refresco habitual (≤ 60 segundos) sin requerir acción del usuario.
- **SC-004**: El usuario completa el ciclo de "ver alertas → marcarlas como leídas" en un solo gesto (un clic) y sin pasos adicionales explícitos (no se requiere un botón "marcar como leído").
- **SC-005**: El estado de leído se mantiene correctamente tras al menos un cierre/apertura completo de la aplicación, verificable en un solo intento manual.
- **SC-006**: La introducción de esta funcionalidad no altera el flujo de navegación existente al hacer clic en una fila (la fila "Stock bajo" sigue llevando a Productos; "Cobros pendientes" sigue llevando a Reportes).

## Supuestos

- El estado de "leído" se persiste localmente en el dispositivo del usuario (no requiere sincronización entre dispositivos ni persistencia en base de datos compartida). Esto se justifica porque el POS es de escritorio, instalado por sucursal, y cada cajero opera mayoritariamente en una sola máquina.
- Las dos categorías actuales del dropdown son alertas "computadas" sobre el estado vivo de la base local (no son notificaciones empujadas/persistidas). Por tanto, la noción de "leído" se mantiene únicamente del lado cliente, indexada por los identificadores de las entidades subyacentes.
- El identificador estable usado para distinguir "qué alerta ya fue leída" es el `id` de la entidad subyacente: `product.id` para Stock bajo y `customer.id` para Cobros pendientes.
- La identidad del usuario para particionar el estado de leído es el `id` del usuario autenticado en la sesión actual.
- El refresco automático cada 60 segundos del dropdown se mantiene; lo que cambia es la fórmula del badge (de "total de ítems" a "ítems no leídos").
- Reusar la infraestructura existente del componente de header es suficiente; no se introducen nuevos canales IPC ni migraciones de base de datos.
- El alcance de esta funcionalidad se limita al dropdown del header. No incluye notificaciones in-app, toasts, sonidos, ni notificaciones del sistema operativo.
- Limpieza del estado de leído: cuando una entidad sale del conjunto de alertas se considera aceptable liberar su marca; no es requisito conservar historial de qué alertas leyó el usuario meses atrás.
