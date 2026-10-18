# RabbitMQ y workers

Toda la configuración de ejecución está en `compose.rabbitmq.yml`. No requiere Python, servicios systemd ni una carpeta `deploy`.

## Uso local

Completar `apps/worker/.env` y ejecutar desde la raíz:

```sh
pnpm messaging:up
```

Este comando usa Node.js y Docker Buildx: si falta la imagen local predeterminada, la construye con límites; después arranca Compose y espera hasta 180 segundos a que los servicios estén saludables. Un fallo devuelve error, pero no borra ni detiene automáticamente el stack parcialmente iniciado. Si se configura una imagen de registro y falta localmente, la descarga; no sustituye esa imagen por código local.

Para incorporar cambios posteriores del código a la imagen y recrear los servicios:

```sh
pnpm messaging:build
pnpm messaging:up
```

Logs y parada sin borrar volúmenes:

```sh
pnpm messaging:logs
pnpm messaging:down
```

`messaging.mjs` es únicamente una herramienta operativa de Node.js. No ejecuta reglas de pagos ni consulta Supabase o SMTP. Compose resuelve el nombre de imagen desde su archivo de entorno. El builder temporal tiene 1,5 GiB de RAM, sin swap, 1 CPU, 256 procesos y paralelismo 1. Se elimina junto con su caché al terminar. Un lock temporal impide construir dos veces a la vez mediante este comando; si se interrumpe forzosamente, revisar que no quede un builder activo antes de retirar `canaldigital-worker-build.lock` del directorio temporal del sistema. Los objetivos de GC de BuildKit no son una cuota dura del disco.

## Coolify

Usar `/compose.rabbitmq.yml` desde la raíz del repositorio, como Compose sin modificaciones automáticas de redes o puertos. Configurar las variables de `apps/worker/.env.example` en Coolify. No se usa `PAYMENTS_CGROUP_PARENT` ni hay que instalar unidades Linux.

**Bloqueo previo al despliegue:** Coolify no construye la imagen. Construirla fuera del servidor de producción, publicarla en un registro y fijar `PAYMENTS_WORKER_IMAGE` con su digest (`registro/imagen@sha256:...`). La imagen debe estar disponible antes del despliegue: construirla en el mismo Docker daemon con `pnpm messaging:build`, o proporcionar en `PAYMENTS_WORKER_IMAGE` una imagen publicada en un registro, preferiblemente fijada por digest. Configurar acceso al registro si es privado. Coolify ejecuta Compose directamente y no ejecuta el comando pnpm por sí solo. Compose no contiene un build sin límites; sus límites de ejecución no limitan una construcción externa de Coolify.

Evitar dos copias simultáneas del stack, incluidos previews/rolling, porque cada copia tiene su propio presupuesto. No publicar los puertos del broker ni montar el socket Docker dentro de los servicios. No mantener los workers locales y los publicados trabajando contra la misma base durante la aceptación.

## Protección automática de contenedores

| Servicio                      | RAM máxima | Swap | CPU | Procesos |
| ----------------------------- | ---------- | ---- | --- | -------- |
| Cada uno de los nueve workers | 256 MiB    | 0    | 0,5 | 128      |
| RabbitMQ                      | 768 MiB    | 0    | 1   | 512      |

La suma de límites de una copia del stack es 3 GiB de RAM y 5,5 CPU. Cada worker limita su heap JavaScript a 128 MiB. Se mantienen los healthchecks, reinicio automático `unless-stopped` (se recuperan tras fallos y reinicios de Docker), límites de archivos abiertos y logs de hasta 10 MiB × 3 archivos por contenedor. Un healthcheck fallido por sí solo no reinicia el proceso. Los healthchecks se ejecutan cada 30 s (con comprobaciones cada 5 s durante el arranque) para reducir procesos de supervisión; RabbitMQ conserva solo las capacidades CHOWN, SETUID y SETGID que necesita su entrypoint.

RabbitMQ frena publicaciones al alcanzar 384 MiB de memoria o quedar menos de 2 GB libres en su filesystem de datos. No se descartan mensajes mediante políticas de cola. Los publisher confirms y reintentos existentes gestionan publicaciones sin confirmar. Las alarmas no son cuotas duras ni garantizan la entrega al destinatario final.

Esto protege el presupuesto de los contenedores. No hay vigilante de memoria/disco del host, corte persistente ni límite global de systemd. Docker, Coolify, el builder, otros servicios y los datos persistentes necesitan capacidad adicional. No se garantiza que el servidor nunca falle: monitorizar disco/RAM del host y dimensionarlo antes de desplegar. No usar `down -v` ni prune global para recuperar espacio sin revisar los datos.

## Verificar antes del despliegue

Con los diez servicios saludables y Docker Linux con cgroup v2:

```sh
pnpm messaging:verify
```

La verificación usa Node.js, sin Python. Inspecciona los límites efectivos en Docker, reinicios, rotación de logs y ausencia de puertos públicos/socket Docker. Agota deliberadamente los 48 MiB de un contenedor aislado y comprueba que el kernel lo termine. En otro RabbitMQ desechable provoca alarmas mediante umbrales de prueba, sin llenar el disco ni la memoria del host: comprueba el bloqueo de publicaciones sin confirmación y su recuperación al retirar cada alarma. No cambia la configuración, mensajes ni volúmenes del broker de la aplicación. Las consultas de diagnóstico del fixture usan el usuario `rabbitmq` para evitar crear su cookie como root durante el arranque.

Para incluir una construcción real y comprobar los límites efectivos del builder en ejecución:

```sh
pnpm messaging:verify --build
```

Esta opción construye una imagen temporal sin reemplazar la imagen de la aplicación. Se retiran los contenedores, red, volúmenes anónimos e imagen de prueba creados por la ejecución. Necesita capacidad adicional para un broker de hasta 768 MiB, cliente de 128 MiB y contenedor OOM de 48 MiB; con `--build`, el builder de 1,5 GiB se ejecuta antes de esos fixtures. No ejecutar simultáneamente con otros builds. Se genera un informe sin credenciales en `.local/host-safety/node-runtime-evidence.json`, ignorado por Git.

La prueba local del 17 de octubre de 2026 confirmó el límite total de 3 GiB sin swap, la terminación por OOM únicamente del fixture y el bloqueo/recuperación por las alarmas de memoria y disco. Los diez servicios conservaron sus identificadores y terminaron saludables. Repetir en el servidor de destino: una validación local no comprueba la configuración de Coolify ni la capacidad restante de ese host.

Referencias: [recursos Docker](https://docs.docker.com/engine/containers/resource_constraints/), [builder con límites](https://docs.docker.com/build/builders/drivers/docker-container/), [orden y salud en Compose](https://docs.docker.com/compose/how-tos/startup-order/).

## Imágenes y revisión de seguridad

Revisión del 17 de octubre de 2026, sobre Linux/amd64. Las referencias externas están fijadas por digest: actualizar una etiqueta no cambia silenciosamente la imagen que ejecutamos.

- Construcción: `node:22.23.3-trixie-slim`, Docker Official Image mantenida por el equipo de Node.js. Solo se usa para instalar las dependencias de producción y preparar esbuild. El lockfile sigue siendo obligatorio.
- Workers: `gcr.io/distroless/cc-debian13:nonroot`, mantenida por GoogleContainerTools, con el binario Node 22.23.3 copiado sin modificar desde la imagen oficial. Se verificó su firma con Cosign, issuer `https://accounts.google.com` e identidad `keyless@distroless.iam.gserviceaccount.com`. Conserva glibc y evita adoptar musl. No incluye shell, npm, pnpm, Yarn ni cabeceras. El usuario del proceso ahora es `nonroot`, UID/GID 65532, y los archivos de aplicación continúan siendo propiedad de root. TLS mantiene las CA incorporadas en Node y el certificado adicional de Supabase.
- RabbitMQ: `rabbitmq:4.3.6-alpine`, Docker Official Image. Conserva la versión 4.3.6 y los datos del volumen. No incluye el plugin/panel web management; la operación y las pruebas usan AMQP y CLI. El healthcheck cambia al usuario `rabbitmq` con `su-exec` y comprueba que la aplicación esté funcionando. El entrypoint oficial ajusta los propietarios del volumen al UID de Alpine al arrancar; no borrar el volumen durante el cambio.
- Builder temporal: `moby/buildkit:v0.34.0`, publicación del proyecto Moby, actualizada desde 0.33.1. Conserva sus límites y su eliminación al terminar. No es un servicio permanente del Compose.

### Tamaño medido

| Imagen                                 | Antes      | Después   |
| -------------------------------------- | ---------- | --------- |
| Workers compartida por nueve servicios | 82,90 MiB  | 60,24 MiB |
| RabbitMQ                               | 115,38 MiB | 80,66 MiB |

Estas cifras son `docker image inspect .Size` del almacén containerd local, que reporta contenido comprimido y metadatos. No representan RAM ni ocupación extraída exacta del filesystem. Los nueve workers comparten una imagen y sus capas; no se descarga nueve veces. `docker system df` falló por una referencia de snapshot inexistente en Docker Desktop, por lo que no se afirma una medición exacta de espacio físico liberado. No se ejecutó un prune global para corregir ese diagnóstico.

Se comparó Node Alpine, que reduce el tamaño frente a slim pero utiliza musl, clasificado como experimental por Node para amd64. La opción Distroless conserva glibc y elimina herramientas innecesarias sin mantener una distribución mínima propia.

### Resultado del escáner

Trivy 0.76.0, fijado por digest, analizó archivos exportados de las imágenes. No tuvo acceso al socket Docker, archivos `.env` ni credenciales. La base de vulnerabilidades se descargó durante esta revisión. Los contadores son hallazgos por paquete/artefacto, no necesariamente CVE únicos:

| Imagen            | Críticos | Altos | Medios | Bajos |
| ----------------- | -------- | ----- | ------ | ----- |
| Worker anterior   | 4        | 75    | 110    | 85    |
| Worker Distroless | 0        | 0     | 23     | 8     |
| RabbitMQ anterior | 0        | 0     | 21     | 4     |
| RabbitMQ Alpine   | 0        | 0     | 1      | 0     |
| BuildKit 0.33.1   | 0        | 107   | 118    | 12    |
| BuildKit 0.34.0   | 0        | 102   | 113    | 12    |

Se actualizó Nodemailer de 7.0.13 a 10.1.2 por avisos de seguridad. Se comprobó la generación real de un mensaje sin enviarlo, las pruebas del adaptador y TypeScript. Los gestores de paquetes y sus dependencias vulnerables ya no forman parte del runtime.

**Pendiente en BuildKit:** la última versión estable consultada mantiene 24 CVE altos únicos, repetidos en sus binarios Go, runc y plugins CNI. Las versiones corregidas indicadas por el escáner son de esas dependencias; no implican que exista ya una imagen oficial de BuildKit con todas ellas corregidas. Actualizar a 0.34.0 reduce hallazgos, pero no los elimina. Construir con código y Dockerfiles de confianza, preferiblemente fuera del servidor de producción, y desplegar una imagen ya construida. No exponer el daemon del builder ni usar imágenes `master` sin validar solo para reducir el contador. La reducción de tamaño y la ausencia de críticos/altos en las imágenes de ejecución no equivalen a ausencia de riesgo ni cubren el Docker Engine del host.

Los JSON completos y manifiestos de esta revisión están en `.local/image-audit/`, excluidos de Git y del contexto de construcción. No se publicaron imágenes ni se hicieron commits. Repetir el escaneo al actualizar digests o dependencias; un digest inmutable evita sustituciones, pero también requiere actualizaciones explícitas para recibir parches.

Fuentes primarias: [Node Official Images](https://github.com/nodejs/docker-node), [RabbitMQ Official Images](https://github.com/docker-library/official-images/blob/master/library/rabbitmq), [Distroless y verificación de firmas](https://github.com/GoogleContainerTools/distroless), [BuildKit 0.34.0](https://github.com/moby/buildkit/releases/tag/v0.34.0), [Nodemailer](https://github.com/nodemailer/nodemailer/releases/tag/v10.1.2).
