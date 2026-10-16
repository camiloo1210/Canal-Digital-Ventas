# Aceptación de Lemon Squeezy — MVP

Fecha: 2026-10-16. Alcance vigente: pasarela funcional en modo test, sin MFA ni resolución administrativa avanzada. No se hicieron commits ni push.

## Punto de continuidad — 2026-10-16

Tras la pausa solicitada, el usuario indicó continuar. Se corrigió el import `readFile` sin uso de `payments-test-revalidate.mjs` y se repitieron las verificaciones:

- `pnpm test`: **438 aprobadas, 23 omitidas**; no se presentan las omitidas como ejecutadas.
- `pnpm lint`: **0 errores y 0 advertencias**.
- TypeScript de Core, worker y web: aprobado. Compilación de Next.js: aprobada con acceso de red para descargar Google Fonts.
- Cloud: **39 migraciones**, ocho conexiones restringidas aprobadas y **19 etapas de aceptación SQL con rollback**, conservando idénticos los pagos, pedidos e inventario persistidos.
- Consulta posterior: compra test 9771022 completamente reembolsada; `dispatch_count=1`, sin anomalías. Fixture vencido con pedido cancelado, stock 10 y una sola cancelación.
- Webhook test existente actualizado al nuevo túnel. Repetición auténtica HTTP **200**, cuerpo alterado HTTP **401**, sin cambios financieros ni de inventario.
- Siete procesos aislados activos y `/health` HTTP 200 con `ready=true` en puertos **8083–8089**. RabbitMQ test saludable. Servidor web local en puerto 3000 y proxy exclusivo del webhook en 8091.
- `PAYMENTS_CHECKOUT_UI_ENABLED=true` en configuración local ignorada por Git; escritores habilitados exclusivamente con la única credencial test. No hay credenciales live activas.

Evidencia local: `.local/provider-fixtures/cloud-final-validation.json`, `replay-evidence.json`, `lifecycle-evidence.json`, `expiry-evidence.json` y `runtime-health.json`. La configuración privada del webhook registra la URL vigente; no se publica su secreto.

**Estado al dejar este registro:** backend financiero del MVP comprobado contra Lemon Squeezy test y entorno local activo. Los procesos y el túnel son temporales: después de cerrarlos o reiniciar el equipo, deben iniciarse y verificarse de nuevo. No constituyen un despliegue permanente.

**Pendientes para una aceptación más amplia:** recorrido completo desde el botón de pago con una sesión real de comprador (el cobro real test probado se inició mediante el caso de uso del Core; la Server Action tiene pruebas automatizadas), fixtures reales adicionales de reembolso parcial/externo y cobro tardío, restauración completa del respaldo y despliegue permanente. La activación live de la tienda y sus credenciales son requisitos para cobrar dinero real. MFA/RPC 18–21 y correo siguen fuera de este alcance; no bloquean la evidencia ya obtenida del MVP test. No se declara ejecutada toda la matriz de 79 escenarios del plan general.

## Resultado comprobado

| Comprobación         | Evidencia real                                                                                                                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Checkout y cobro     | Pedido creado por el Core y stock reservado en PostgreSQL Cloud. Checkout test de 15 USD; orden del proveedor **9771022**. Webhook firmado recibido y procesado: pago `completed`, pedido `paid`.                                      |
| Reembolso completo   | POST del worker aceptado; GET independiente y webhook corroborados. Pago y pedido `refunded`; libro 1500; operación `CLOSED_BY_OBSERVED_COVERAGE`; `dispatch_count=1`; ninguna anomalía.                                               |
| Idempotencia y firma | Repetición de los bytes y firma auténticos: HTTP 200 sin cambiar libro, versiones, stock ni cantidad de recibos. Alterar un byte: HTTP 401.                                                                                            |
| Vencimiento y stock  | Fixture separado con reloj de vencimiento adelantado exclusivamente para la prueba. Los workers cancelan mediante el Core: stock 9→10 y una sola fila de cancelación. Dos entregas duplicadas posteriores no cambian stock ni versión. |
| Infraestructura      | Supabase Cloud, 39 migraciones aplicadas; ocho conexiones restringidas sin DML financiero. RabbitMQ real de pruebas. Siete procesos con configuración aislada y arranque/apagado comprobados.                                          |
| Aceptación SQL       | 19 etapas de replay/aceptación con rollback; se comprobó que los pagos, pedidos e inventario persistidos quedaron idénticos.                                                                                                           |

Las pruebas HTTP unitarias se complementaron con las respuestas y eventos reales de Lemon Squeezy test. Los fixtures originales, hashes y resultados están en `.local/provider-fixtures/`, ignorado por Git. Contienen URLs firmadas y datos sintéticos; no deben publicarse.

## Arquitectura y alcance

Next.js entrega el formulario y webhook; el Core contiene casos de uso, puertos, dominio y adaptadores. Las transiciones monetarias usan la excepción acotada del ADR-PAY-001. Pedidos e inventario usan transacciones físicas del Core, bloqueo compartido por pedido, control optimista y outbox atómico.

El catálogo general documenta 24 RPC. La entrega MVP instala **20**: 1–17 y 22–24. Las RPC administrativas 18–21 se difieren al excluir MFA expresamente del alcance. Una respuesta ambigua de reembolso mantiene la exposición abierta y bloquea nuevos envíos; nunca se interpreta un HTTP exitoso como liquidación ni se inventa causalidad técnica.

Los reembolsos completos quedaron comprobados de extremo a extremo. La política y SQL de observaciones parciales/externas tienen pruebas; no se afirma una compra externa real para cada combinación de esas pruebas.

## Operación local

`apps/web/.env.local` contiene la configuración web test. Cada worker carga su perfil en `.local/payment-runtime/<perfil>.env`, o variables inyectadas en despliegue. No hay fallback al usuario PostgreSQL administrativo. El secreto de firma vive en Supabase Vault. Las credenciales y respaldos están fuera del control de versiones.

Procesos disponibles: `pnpm --filter @canaldigital/worker payments`, `payment-relay`, `payment-orders`, `payment-dispatch`, `payment-egress`, `payment-reconciliation` y `payment-retention`. El broker de esta aceptación usa `compose.payments-test.yml` y puertos 5674/15674.

El endpoint es `/api/webhooks/lemon-squeezy`. Para la aceptación se expone únicamente esa ruta mediante `payment-webhook-test-proxy.ts` y Cloudflare Tunnel; otras rutas públicas devuelven 404. Un túnel temporal no es un despliegue permanente. Si cambia, `PAYMENT_TEST_WEBHOOK_URL` permite actualizar el webhook test existente con `payments-test-webhook-setup.mjs`.

`payments-test-observe.mjs` consulta los resultados sin modificarlos. `payments-test-replay.mjs` verifica firma y duplicados. La prueba de vencimiento usa `payment-test-checkout.ts --expiry`, `payment-test-expiry-redelivery.ts` y `payments-test-observe.mjs --expiry`.

## Límite de esta aceptación

No se cobró dinero real. La tienda continúa en test y sin credenciales live activas. Para recibir dinero real se requiere la activación de la tienda por Lemon Squeezy, credenciales live y un endpoint público estable. Esta aceptación no afirma esos pasos como realizados.

El respaldo cifrado se verificó con `pg_restore --list`; no se afirma un ensayo de restauración completa. Los workers de correo no se iniciaron durante las pruebas. Los eventos de notificaciones ajenos al transporte financiero no forman parte de esta aceptación.
