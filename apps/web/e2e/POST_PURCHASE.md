# E2E de seguimiento poscompra

La suite `lifecycle/post-purchase.e2e.ts` comprueba que el vendedor guarda la transportadora y la guía, y que el comprador ve esa información identificada como registro manual. Depende del pedido, producto y sesiones creados por los proyectos `setup`, `admin`, `buyer` y por `lifecycle/order-lifecycle.e2e.ts`. La configuración de Playwright rechaza conexiones de pruebas que no sean locales.

Para ejecutar el flujo completo con el entorno local aislado ya preparado, desde la raíz:

```sh
pnpm --filter @canaldigital/web test:e2e --project=lifecycle
```

La prueba manual no consulta FedEx. Para probar además el seguimiento real en **sandbox**, primero ejecuta el flujo completo anterior, conserva su base y sesiones, y configura el entorno aislado y el worker siguiendo `apps/worker/README.md` (sección de FedEx sandbox). Identifica la tienda creada por el flujo y asígnale una referencia en `TRACKING_TENANT_REFS_JSON`. Usa una guía de prueba de FedEx que efectivamente devuelva eventos; el worker debe estar ejecutándose y consultar con suficiente frecuencia para el límite de la prueba.

Configura estas variables en el proceso de Playwright antes de arrancarlo:

- `E2E_FEDEX_SANDBOX=1`.
- `E2E_FEDEX_TRACKING_NUMBER`: guía de FedEx sandbox.
- `E2E_FEDEX_EXPECTED_EVENT`: texto exacto en español de un evento que se espera en esa guía, por ejemplo `En tránsito`.
- `E2E_TRACKING_DEPLOYMENT_ID`: UUID de la marca sandbox de la base de pruebas.
- `E2E_TRACKING_TENANT_REFS_JSON`: JSON que asocia el UUID de la tienda de prueba con su referencia no secreta, igual que en el worker.
- `E2E_PRODUCTION_DATABASE_URL`: identidad de conexión de producción usada por la aplicación únicamente para la comparación de aislamiento; no es la conexión de pruebas.

Con los datos y el worker preparados, ejecuta solo este archivo sin recrear sus dependencias:

```sh
pnpm --filter @canaldigital/web test:e2e --project=lifecycle --no-deps e2e/lifecycle/post-purchase.e2e.ts
```

La prueba activa el seguimiento para la guía y espera un evento real dentro de la cronología. No crea un envío ni emula respuestas de FedEx. No guardes credenciales en el repositorio. Si faltan credenciales, una guía con eventos, el worker o la base configurada, la prueba sandbox no está validada. El pedido ya se encuentra entregado por la prueba anterior, por lo que esta suite no demuestra que un evento FedEx sea incapaz de cambiar el estado comercial.
