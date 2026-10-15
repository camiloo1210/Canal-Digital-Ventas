# RabbitMQ y relay del outbox

Implementación adaptada de `T:\Camilo\ema3`:

- `PatientEmailOutboxPublisher.cs`: publicación persistente desde outbox y confirmación del broker.
- `notification-relay/src/notification-consumer.ts`: identidad estable de mensajes y cola de mensajes fallidos.

Los contratos de pacientes, SMTP y criptografía de ema3 pertenecen a ese producto y no se trasladan a ventas.

## Arquitectura

```text
Server Action → DI de la feature → caso de uso de negocio
  → transacción PostgreSQL: agregado + PostgresEventBusAdapter → core.outbox_events

apps/worker → RelayOutboxUseCase → RelayOutboxPort / IntegrationEventPublisherPort
  → PostgresRelayOutboxAdapter / RabbitMqEventPublisherAdapter
  → cola durable canaldigital.events
```

Los puertos, el caso de uso de entrega y los adaptadores residen en la slice transversal `packages/core/src/features/shared`. El worker es un adaptador de entrada Node independiente. Su composición está en `shared/infrastructure/messaging/outbox-worker.ts`; no depende de React, Next.js ni Supabase Auth. Las páginas y Server Actions siguen usando sus contenedores DI `server-only` existentes. No se abre ninguna conexión AMQP dentro de peticiones web.

El worker entrega **los eventos que ya se escriben en el outbox**. No modifica las features que todavía usan `LocalEventBus`: para incorporar esas mutaciones hay que escribir sus eventos en la misma transacción PostgreSQL que sus agregados. Pedidos y productos ya usan el adaptador transaccional.

El viejo `OutboxPort` no conserva tenant, fecha ni fencing. El relay usa un puerto específico y las funciones SQL restringidas, sin el adaptador HTTP con `service_role`.

## Ejecución local

Requisitos: Node >=22.9, pnpm, Docker con el motor iniciado y PostgreSQL/Supabase con las migraciones del repositorio aplicadas.

```powershell
pnpm install --frozen-lockfile
docker compose -f compose.rabbitmq.yml up -d
Copy-Item apps/worker/.env.example apps/worker/.env
```

Aplicar también `supabase/migrations/20261015000000_rabbitmq_outbox_relay.sql` mediante el flujo habitual de migraciones. No se aplica automáticamente al iniciar el worker.

Provisionar un LOGIN exclusivo para el worker mediante el administrador de PostgreSQL. Usar una contraseña propia, nunca la de ejemplo:

```sql
CREATE ROLE canaldigital_outbox LOGIN PASSWORD '<contraseña-del-gestor-de-secretos>';
GRANT CONNECT ON DATABASE postgres TO canaldigital_outbox;
GRANT outbox_worker_role TO canaldigital_outbox;
```

Configurar `OUTBOX_DATABASE_URL` en `apps/worker/.env` con ese LOGIN y una conexión directa o un pooler de sesión. La comprobación usa `session_user`: un pooler que cambia la identidad de sesión no sirve. Este LOGIN solo necesita ejecutar las funciones de claim, complete y retry; no se le conceden permisos sobre tablas ni roles de la aplicación web. La conexión AMQP usa `RABBITMQ_URL`. En producción utilizar TLS y credenciales del gestor de secretos.

```powershell
pnpm worker:outbox
```

El comando lee `apps/worker/.env` si existe; también admite variables inyectadas por el entorno. RabbitMQ Management queda en `http://localhost:15672`, con `canaldigital` / `canaldigital-local` únicamente para el compose local. Los puertos están ligados a localhost y los datos del broker se conservan en un volumen.

Desplegar el worker como proceso Node persistente, con reinicio supervisado, separado del despliegue Next.js en Vercel. La instalación debe incluir la dependencia de ejecución `tsx` del workspace del worker y los fuentes TypeScript del core.

## Garantías y límites

- La modificación del agregado y su evento siguen siendo atómicas en PostgreSQL; no hay escritura doble DB/broker dentro de la transacción de negocio.
- Cada claim bloquea una fila con `FOR UPDATE SKIP LOCKED`, adquiere un lease de 60 segundos y conserva el tenant del evento. Cada instancia utiliza un UUID de propietario distinto.
- La confirmación AMQP tiene un timeout de 10 segundos. Solo se marca `COMPLETED` tras un publisher confirm y sin `basic.return`. Un mensaje `mandatory` devuelto se considera fallido aunque reciba confirmación.
- Cola durable, mensajes persistentes, JSON, `messageId` estable y metadatos de tenant/tipo/versión. El cuerpo incluye `messageId`, `tenantId`, `aggregateType`, `aggregateId`, `eventType`, `occurredAt` y `payload`; `occurredAt` es la fecha de inserción del outbox.
- Reintento con backoff exponencial, recuperación de leases vencidos y estado `DEAD` tras cinco intentos. `DEAD` en PostgreSQL contiene eventos que no llegaron a confirmarse. La cola RabbitMQ `<queue>.dead-letter` recibe mensajes rechazados por consumidores con `requeue=false`; son dos fallos distintos.
- La entrega es **al menos una vez**. Si el broker confirma y el proceso cae antes del commit de `COMPLETED`, puede haber duplicados. Un consumidor debe deduplicar por `messageId`, guardar sus efectos junto con su registro de recepción en una transacción y verificar `tenantId` antes de tocar agregados. `messageId` por sí solo no garantiza idempotencia.
- La cola es un destino de trabajo compartido. No se añaden handlers de correo, pagos o inventario sin el caso de uso correspondiente. Un consumidor se implementa en la slice de su feature y confirma (`ack`) después de completar sus efectos. Sus reintentos y registro de recepción deben diseñarse para esa operación. No se garantiza orden global ni entrega exactamente una vez.
- El worker reconecta ante fallos, finaliza el evento en curso al recibir SIGINT/SIGTERM y cierra conexiones. Los logs omiten URLs, credenciales y payloads. Supervisar los logs y el conteo de filas `DEAD` para detectar incidentes.

Para inspeccionar fallos con una sesión administrativa:

```sql
SELECT id, tenant_id, event_type, status, attempt_count, next_attempt_at
FROM core.outbox_events
WHERE status IN ('RETRY', 'DEAD')
ORDER BY created_at;
```

Un replay de `DEAD` debe ser una operación administrativa deliberada, tras resolver la causa y revisar la idempotencia del consumidor; conservar siempre el ID del evento.

## Verificación

```powershell
pnpm test
pnpm lint
pnpm exec tsc --noEmit -p packages/core/tsconfig.json
pnpm --filter @canaldigital/worker check
```

Las pruebas de integración se omiten explícitamente mientras falten estas variables:

```powershell
$env:RABBITMQ_TEST_URL = 'amqp://canaldigital:canaldigital-local@localhost:5672?heartbeat=30'
$env:OUTBOX_TEST_DATABASE_URL = 'postgresql://<administrador>:<password>@localhost:5432/canaldigital_test'
pnpm test packages/core/src/features/shared/infrastructure/adapters
```

Usar exclusivamente una base de pruebas migrada, con outbox vacío, cuyo nombre contenga `test`. Las pruebas crean y eliminan su propio tenant y sus filas; requieren una conexión administrativa para preparar fixtures y comprobar la denegación al rol `authenticated`. Cubren claims concurrentes, fencing, recuperación, backoff, límite de intentos, permisos, publicación real y mensajes no enrutables. Las pruebas del broker crean y eliminan colas con nombres aleatorios.

Referencias: [publisher confirms de RabbitMQ](https://www.rabbitmq.com/docs/confirms), [API de amqplib](https://amqp-node.github.io/amqplib/channel_api.html).
