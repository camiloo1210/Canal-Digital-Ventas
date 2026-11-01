# Protección de tráfico en Vercel

La aplicación usa Next.js 16 `proxy.ts`, Upstash Redis y Sentry. Sentry observa las decisiones; no bloquea ataques DDoS. Vercel Firewall debe filtrar el tráfico antes de ejecutar la aplicación. Los límites de aplicación son una segunda capa y consumen invocaciones y comandos Redis. Redis también mantiene en caché lecturas del catálogo público para reducir llamadas repetidas a Supabase.

## Activación

1. Crear una base Upstash Redis cercana a la región de ejecución de Vercel. Usar bases distintas para producción y preview cuando sea posible.
2. Configurar en Vercel las variables de servidor de `apps/web/.env.example`: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RATE_LIMIT_KEY_SECRET` (secreto aleatorio de al menos 32 caracteres) y `SENTRY_DSN` (DSN del proyecto Sentry). No usar prefijos `NEXT_PUBLIC_`.
3. Establecer `RATE_LIMIT_ENABLED=true` y volver a desplegar. Por defecto está desactivado para permitir preparar las credenciales sin interrumpir despliegues existentes.
4. Validar primero en preview: solicitudes normales, login, registro, callback OAuth, catálogo, checkout y reintentos del webhook de pagos. Comprobar que el tráfico bloqueado responde 429 con `Retry-After` y `Cache-Control: no-store`, y aparece en Sentry.
5. Configurar en Sentry una alerta para mensajes `request-rate-limit:blocked` y otra para `request-rate-limit:unavailable`, filtrando `component:request-rate-limit`. El código envía eventos; las alertas y sus destinatarios se configuran en Sentry.

## Límites iniciales

Ventana deslizante de 60 segundos por IP y política. Ajustar con tráfico real, especialmente redes corporativas que comparten IP.

| Política    | Solicitudes/minuto | Cobertura                                                                                                      |
| ----------- | -----------------: | -------------------------------------------------------------------------------------------------------------- |
| read        |                300 | GET/HEAD/OPTIONS fuera de autenticación                                                                        |
| mutation    |                 60 | Otras solicitudes, incluyendo Server Actions                                                                   |
| auth        |                 30 | `/login`, `/signup`, `/auth` y sus subrutas                                                                    |
| auth-action |                 10 | Login, registro, OAuth con Google y onboarding dentro de la acción, independientemente de la URL de invocación |
| webhook     |                300 | Ruta exacta `/api/webhooks/lemon-squeezy`                                                                      |

Las Server Actions POST a `/login` y `/signup` también pasan por el proxy bajo `auth`, porque el header `next-action` lo controla el cliente; además `auth-action` las limita dentro de la acción. Las políticas se comparten entre rutas de la misma clase: variar la URL o los parámetros no crea otro contador. Producción y preview usan prefijos separados. El webhook sigue exigiendo firma válida en su procesamiento normal; tener apariencia de webhook no exime de límites.

Solo se confía en `x-vercel-forwarded-for` cuando `VERCEL=1`; fuera de Vercel (local, `next start`) el limitador queda desactivado en lugar de bloquear. No desplegar esta configuración en un VPS ni ante un proxy diferente sin revisar la cadena de confianza. Las IPv4 se usan completas y las IPv6 se agrupan por prefijo /64; ambas se almacenan como HMAC con el secreto del servidor. Rotar el secreto reinicia efectivamente las identidades de los contadores. Los límites por IP no evitan ataques distribuidos ni sustituyen protección de Supabase Auth contra accesos directos.

Con el limitador activado en Vercel, la falta de configuración o una IP inválida devuelven 503 con reintento a los 30 segundos antes de consultar Supabase en `auth`, `auth-action` y `mutation`; `read` y `webhook` fallan abierto también en este caso. El caché en memoria de Upstash (`ephemeralCache`) queda activo: una IP ya bloqueada se rechaza sin consultar Redis mientras la instancia siga caliente. Ante un fallo de Redis (error o timeout), `auth`, `auth-action` y `mutation` fallan cerrado con 503; `read` y `webhook` fallan abierto para no interrumpir el catálogo ni los pagos (el webhook mantiene su verificación de firma). `RATE_LIMIT_ENABLED=false` es el interruptor de recuperación y requiere redespliegue; desactivar elimina esta capa de protección.

## Caché del catálogo público

El DI de tienda decora los read ports públicos de tienda, categorías, páginas del catálogo y detalle de producto. El caché es multiinstancia en Upstash, se comparte solo dentro de producción o preview y usa la clave SHA-256 de la consulta para no guardar términos de búsqueda en la clave. TTL predeterminado: 15 segundos; `CATALOG_CACHE_TTL_SECONDS` admite de 5 a 300 segundos. Cada tienda tiene un contador de versión en Redis que forma parte de la clave; las acciones del vendedor (productos, categorías, estado de pedidos y ajustes de tienda), el checkout y la cancelación de pedidos del comprador lo incrementan y la tienda ve los cambios de inmediato. La cancelación por expiración corre en el worker del Core, que no conoce este caché, y tarda como máximo el TTL en aparecer. Si Redis no responde al invalidar, el TTL acota la antigüedad; un resultado ausente (por ejemplo una tienda recién creada) se guarda como máximo 5 segundos. El caché solo se aplica a lecturas públicas; el dashboard y las consultas de compradores no se almacenan. Las peticiones concurrentes de una misma clave dentro de una instancia comparten una sola consulta a Supabase, y el TTL lleva un jitter de hasta 20 % para desincronizar expiraciones. Si Redis no está configurado o falla, el read port consulta Supabase y la página sigue funcionando.

## Sentry

Integración de servidor limitada a señales explícitas de seguridad. No instala SDK de navegador ni recopila trazas, formularios, IP, cookies o consultas URL. Los eventos incluyen política, severidad y tipo de decisión. No se reporta cada petición: para bloqueos se coordina como máximo un evento por política por minuto mediante Redis y se usa un límite local adicional. En fallos Redis el límite de reportes es por instancia, por lo que varias instancias pueden reportar el mismo fallo.

## Vercel Firewall: paso operativo pendiente

En el proyecto de Vercel, abrir **Firewall** y revisar el tráfico antes de activar reglas. Crear reglas de rate limiting por IP para autenticación y API con umbrales acordes con los límites anteriores. Mantener una regla específica para el webhook: no aplicar desafíos de navegador a callbacks de pagos. Proteger también los dominios preview y el dominio `vercel.app` para evitar accesos alternativos. Revisar las opciones disponibles en el plan, sus costes y los límites de gasto del proyecto. La app excluye archivos estáticos conocidos y `/_next/image`; su protección depende del firewall.

La protección DDoS de Vercel está en la red. El repositorio no configura ni confirma reglas activas en la cuenta Vercel. Tampoco aprovisiona Redis, DSN ni alertas. No realizar pruebas de carga contra producción; verificar límites en un entorno controlado.

## Verificación

Las pruebas automatizadas cubren IP falsificada, configuración ausente, timeout fail-open del SDK, política de fallo por clase de tráfico, desactivación fuera de Vercel, excepciones Redis, caché del catálogo (hit, null, TTL, consulta compartida), identidad compartida entre rutas, IPv6 normalizada, separación de políticas, cobertura del matcher y respuesta antes de Supabase. Las integraciones externas y el despliegue deben comprobarse con las credenciales del entorno.

Referencias oficiales:

- https://vercel.com/docs/vercel-firewall/ddos-mitigation
- https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- https://vercel.com/docs/headers/request-headers
- https://upstash.com/docs/redis/sdks/ratelimit-ts/features
- https://docs.sentry.io/platforms/javascript/guides/nextjs/
