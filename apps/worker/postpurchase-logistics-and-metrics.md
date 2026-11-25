# Postcompra: integración logística y medición

Este documento describe trabajo pendiente; no habilita rastreo ni recopila métricas. La tienda registra manualmente transportadora y guía. No existe un proveedor contratado ni una fuente de fechas estimadas confirmada.

## Contrato para una futura transportadora

Antes de desarrollar un adaptador se debe acordar proveedor, cobertura, credenciales y el vínculo autorizado entre cuenta del proveedor y tienda. El adaptador debe verificar la firma sobre los bytes originales, el secreto vigente y la ventana temporal según el protocolo del proveedor; no debe aceptar un tenant o pedido suministrado sin comprobarlo contra ese vínculo. Mantener secretos fuera del repositorio y permitir su rotación.

El evento normalizado debe incluir identificador y versión del proveedor, identificador estable del evento, cuenta y envío externos, tipo y momento reportados, momento de recepción y referencia a evidencia; el tenant y pedido internos se resuelven del vínculo confiable. Las fechas y estados desconocidos permanecen desconocidos. Guardar solo datos necesarios, sin carga sensible en logs.

La recepción autenticada debe ser durable y deduplicar por proveedor, cuenta y evento con una restricción única. Su procesamiento debe ser transaccional e idempotente, conservar el evento original auditado, rechazar conflictos entre tiendas y tolerar entregas duplicadas o desordenadas. Un evento antiguo no debe sobrescribir una observación más reciente sin una regla explícita para correcciones. El dominio decide si una observación autoriza una transición del pedido; no todo evento del transportista cambia el estado del pedido. Definir reintentos, cola de errores, monitoreo y conciliación periódica contra la API del proveedor, incluyendo interrupciones y eventos perdidos.

La implementación y sus pruebas deben cubrir firma inválida y repetida, rotación, tenant ajeno, duplicados concurrentes, reordenamiento, rollback, conciliación y aislamiento; probar además la semántica real del proveedor en un entorno autorizado. Hasta entonces no hay integración verificada, ubicación en vivo ni ETA.

## Métricas propuestas y limitaciones

Calcular por tienda y ventana temporal explícita, con permisos de lectura apropiados, sin correos, direcciones ni números de guía. No interpretar ausencia de datos como éxito. Estas métricas aún no están instrumentadas y requieren una línea base y validación con usuarios.

- **Cobertura de información:** pedidos elegibles con al menos un dato manual de envío registrado / pedidos elegibles. Definir elegibilidad y cohorte antes de comparar; una guía no equivale a seguimiento activo.
- **Tiempo hasta primera información:** distribución del tiempo entre un hito elegible verificable y el primer registro de envío. Excluir y contabilizar por separado los pedidos sin hito confiable y los aún sin información; no usar el backfill como fecha real.
- **Notificaciones:** contar entregas finales SENT y DEAD y entregas RETRY o PROCESSING pendientes por cohorte de evento y canal. El denominador debe incluir eventos elegibles y explicar los eventos suprimidos, destinatarios no verificados y envíos desactivados. Los registros de entrega existentes no representan automáticamente todas las oportunidades de envío.
- **Ayuda:** no medir casos ni resolución hasta contar con un canal o flujo de incidencias real y una fuente con consentimiento y permisos. La ausencia de un canal configurado no demuestra ausencia de problemas.

## Validación antes de activar

Aplicar y validar las migraciones en el entorno elegido, comprobar roles, permisos, RLS, transacciones e idempotencia y ejecutar recorridos reales de comprador y vendedor. Revisar la configuración y el orden de activación de avisos en `apps/worker/README.md`. Los correos se limitan a la identidad compradora vigente con dirección confirmada; si no existe, la entrega se omite. Las fechas históricas sin procedencia verificable se reportan como desconocidas.
