# RabbitMQ and workers

All runtime configuration is in `compose.rabbitmq.yml`. Python, systemd services, and a `deploy` directory are not required.

## Local use

Complete `apps/worker/.env` and run from the repository root:

```sh
pnpm messaging:up
```

This command uses Node.js and Docker Buildx. If the local image is missing, it builds it with resource limits, then starts Compose and waits up to 180 seconds for healthy services. Failure returns an error but does not automatically remove or stop a partially started stack. The ten workers share `canaldigital-messaging-worker:local`; `pull_policy: never` prevents attempts to download it from a private registry.

To incorporate subsequent code changes into the image and recreate services:

```sh
pnpm messaging:build
pnpm messaging:up
```

Logs and shutdown without deleting volumes:

```sh
pnpm messaging:logs
pnpm messaging:down
```

`messaging.mjs` is an operational Node.js tool. It does not execute payment rules or query Supabase or SMTP. Compose resolves the image name from its environment file. The temporary builder has 1.5 GiB RAM, no swap, 1 CPU, 256 processes, and parallelism 1. It and its cache are removed when finished. A temporary lock prevents simultaneous builds through this command; after forced interruption, check that no builder is active before removing `canaldigital-worker-build.lock` from the system temporary directory. BuildKit GC targets are not a hard disk quota.

## Coolify

Use `/compose.rabbitmq.yml` from the repository root as Compose, without automatic network or port changes. Configure variables from `apps/worker/.env.example` in Coolify. `PAYMENTS_CGROUP_PARENT` is unused and no Linux units need installing.

`outbox-worker` declares the only Compose `build:`. The other nine workers reuse the resulting image. Publishing our image to GHCR or configuring registry tokens is unnecessary. Public base images still download from their official registries.

Before deploying, configure Coolify:

1. Base Directory: `/`; Docker Compose Location: `/compose.rabbitmq.yml`.
2. **Custom Build Command:** `bash apps/worker/docker/build-coolify.sh`.
3. Keep the default Compose start command, without domains or public ports.
4. Enable **Preserve repository during deployment** to retain the mounted RabbitMQ configuration file.
5. Remove the old `PAYMENTS_WORKER_IMAGE` variable; the Compose image name is fixed. Complete the other template variables.
6. Reload Compose from Git and deploy. Do not mark runtime credentials as build arguments; the script does not need them.

The script requires Bash, Docker Buildx, and Linux Docker with cgroup v2, available through the supported deployment helper. It builds one image with a temporary builder: 1.5 GiB RAM, no swap, 1 CPU, 256 processes, and parallelism 1. It verifies effective limits before building and removes its own builder/cache afterward, including normal failure. It does not perform global pruning or mount the Docker socket inside application services.

**The Custom Build Command is required to limit the build.** Default Compose builds do not apply these limits. Check logs for script execution before accepting deployment; if the Coolify version does not support the command, do not substitute an unlimited build. Forced interruption can leave `cdv-coolify-<resource UUID>` behind: check for active builds before removing it. Its stable name prevents another simultaneous builder for the same resource. Other Coolify resources have independent budgets.

Reserve build capacity in addition to existing services: up to 1.5 GiB extra while the previous version remains active. GC targets do not strictly limit disk usage; monitor image/layer storage. The remote server's effective configuration has not been verified from this repository.

Avoid simultaneous stack copies, including previews/rolling deployments: each copy has its own budget. Do not expose broker ports or mount the Docker socket inside services. During acceptance, do not run local and deployed workers against the same database.

## Automatic container protection

| Service                 | Maximum RAM | Swap | CPU | Processes |
| ----------------------- | ----------- | ---- | --- | --------- |
| Each of the ten workers | 256 MiB     | 0    | 0.5 | 128       |
| RabbitMQ                | 768 MiB     | 0    | 1   | 512       |

One stack's limits total 3.25 GiB RAM and 6 CPUs. Each worker limits its JavaScript heap to 128 MiB. Healthchecks, automatic `unless-stopped` restart after failures or Docker restarts, file-descriptor limits, and logs of up to 10 MiB × 3 files per container remain in place. A failed healthcheck alone does not restart a process. Healthchecks run every 30 seconds, with checks every 5 seconds during startup, to reduce monitoring processes. RabbitMQ retains only the CHOWN, SETUID, and SETGID capabilities its entrypoint needs.

RabbitMQ throttles publication at 384 MiB memory or less than 2 GB free in its data filesystem. Queue policies do not discard messages. Existing publisher confirms and retries manage unconfirmed publication. Alarms are not hard quotas and do not guarantee final recipient delivery.

These controls protect container budgets. There is no host memory/disk watchdog, persistent cutoff, or global systemd limit. Docker, Coolify, the builder, other services, and persistent data require additional capacity. Server failure cannot be ruled out: monitor host disk/RAM and size it before deployment. Do not use `down -v` or global pruning to recover space without reviewing the data.

## Verify before deployment

With all eleven services healthy and Linux Docker using cgroup v2:

```sh
pnpm messaging:verify
```

Verification uses Node.js without Python. It inspects effective Docker limits, restart settings, log rotation, and absence of public ports or Docker sockets. It deliberately exhausts an isolated container's 48 MiB and checks that the kernel terminates it. A separate disposable RabbitMQ triggers alarms through test thresholds, without filling host memory/disk: it verifies blocked, unconfirmed publication and recovery after each alarm is removed. It does not change the application broker's configuration, messages, or volumes. Fixture diagnostics use the `rabbitmq` user to avoid creating its cookie as root during startup.

To include a real build and verify the running builder's effective limits:

```sh
pnpm messaging:verify --build
```

This builds a temporary image without replacing the application image. Containers, network, anonymous volumes, and test image created by the run are removed. Extra capacity is needed for a broker up to 768 MiB, a 128 MiB client, and a 48 MiB OOM container; with `--build`, the 1.5 GiB builder runs before those fixtures. Do not run alongside other builds. A credential-free report is generated at `.local/host-safety/node-runtime-evidence.json`, ignored by Git.

The October 17, 2026 local test, with the nine workers then present, confirmed a total 3 GiB limit without swap, OOM termination of only the fixture, and blocking/recovery from memory/disk alarms. The ten services present before adding kivi-sync retained their identifiers and ended healthy. Repeat on the target server: local validation does not establish effective Coolify configuration or that host's remaining capacity.

References: [Docker resources](https://docs.docker.com/engine/containers/resource_constraints/), [limited builder](https://docs.docker.com/build/builders/drivers/docker-container/), [Compose startup and health](https://docs.docker.com/compose/how-tos/startup-order/).

## Images and security review

Review dated October 17, 2026 on Linux/amd64. External references are pinned by digest: updating a tag does not silently change the image we execute.

- Build: `node:22.23.3-trixie-slim`, a Docker Official Image maintained by the Node.js team. Used only to install production dependencies and prepare esbuild. The lockfile remains mandatory.
- Workers: `gcr.io/distroless/cc-debian13:nonroot`, maintained by GoogleContainerTools, with the unmodified Node 22.23.3 binary copied from the official image. Its signature was verified with Cosign, issuer `https://accounts.google.com`, and identity `keyless@distroless.iam.gserviceaccount.com`. It retains glibc and avoids adopting musl. It contains no shell, npm, pnpm, Yarn, or headers. The process runs as `nonroot`, UID/GID 65532; application files remain root-owned. TLS retains Node's bundled CAs and the additional Supabase certificate.
- RabbitMQ: `rabbitmq:4.3.6-alpine`, a Docker Official Image. Version 4.3.6 and volume data are preserved. It has no management plugin/panel; operations and tests use AMQP and CLI. The healthcheck switches to `rabbitmq` with `su-exec` and verifies the application is running. The official entrypoint adjusts volume ownership to the Alpine UID on startup; do not delete the volume during the change.
- Temporary builder: `moby/buildkit:v0.34.0`, published by Moby and updated from 0.33.1. Limits and cleanup remain in place. It is not a permanent Compose service.

### Measured size

| Image                                                    | Before     | After     |
| -------------------------------------------------------- | ---------- | --------- |
| Worker image shared by nine services at measurement time | 82.90 MiB  | 60.24 MiB |
| RabbitMQ                                                 | 115.38 MiB | 80.66 MiB |

These are `docker image inspect .Size` values from the local containerd store, reporting compressed content and metadata. They do not represent RAM or exact extracted filesystem usage. The ten workers share one image and its layers, rather than downloading a copy per worker. `docker system df` failed because of a missing snapshot reference in Docker Desktop; no exact physical-space savings are claimed. No global prune was performed to address that diagnostic.

Node Alpine was compared: it is smaller than slim but uses musl, classified as experimental by Node for amd64. Distroless preserves glibc and removes unnecessary tools without maintaining a custom minimal distribution.

### Scanner result

Digest-pinned Trivy 0.76.0 scanned exported image files. It had no access to the Docker socket, `.env` files, or credentials. Its vulnerability database was downloaded during this review. Counts are findings per package/artifact, not necessarily unique CVEs:

| Image             | Critical | High | Medium | Low |
| ----------------- | -------- | ---- | ------ | --- |
| Previous worker   | 4        | 75   | 110    | 85  |
| Distroless worker | 0        | 0    | 23     | 8   |
| Previous RabbitMQ | 0        | 0    | 21     | 4   |
| Alpine RabbitMQ   | 0        | 0    | 1      | 0   |
| BuildKit 0.33.1   | 0        | 107  | 118    | 12  |
| BuildKit 0.34.0   | 0        | 102  | 113    | 12  |

Nodemailer was updated from 7.0.13 to 10.1.2 because of security advisories. Actual message generation without sending, adapter tests, and TypeScript were checked. Package managers and their vulnerable dependencies are no longer in the runtime.

**Outstanding BuildKit findings:** the stable version consulted still has 24 unique high CVEs repeated across Go binaries, runc, and CNI plugins. Scanner-reported fixed versions refer to those dependencies; they do not establish that an official BuildKit image already fixes all of them. Updating to 0.34.0 reduces findings without eliminating them. Build trusted code and Dockerfiles, preferably outside production, and deploy an already-built image. Do not expose the builder daemon or use unvalidated `master` images merely to reduce counts. Smaller images and zero critical/high runtime findings do not establish absence of risk or cover the host Docker Engine.

Full JSON results and manifests are in `.local/image-audit/`, excluded from Git and build context. No images were published and no commits were created during that review. Repeat scanning when digests or dependencies change: immutable digests prevent replacement but require explicit updates to receive patches.

Primary sources: [Node Official Images](https://github.com/nodejs/docker-node), [RabbitMQ Official Images](https://github.com/docker-library/official-images/blob/master/library/rabbitmq), [Distroless signature verification](https://github.com/GoogleContainerTools/distroless), [BuildKit 0.34.0](https://github.com/moby/buildkit/releases/tag/v0.34.0), [Nodemailer](https://github.com/nodemailer/nodemailer/releases/tag/v10.1.2).

## Kivi synchronization worker (`kivi-sync`)

The tenth Compose worker (`src/kivi-sync.ts`) uses the same healthcheck and limits as the others. Run locally with `pnpm worker:kivi-sync`.

- **Database:** `KIVI_SYNC_DATABASE_URL` uses the restricted `canaldigital_kivi_sync` LOGIN, created without a password (`PASSWORD NULL`) by `20261020000000_kivi_connections.sql`. As with other worker LOGINs, provision its password out of band, never in Git: as an administrator, run `ALTER ROLE canaldigital_kivi_sync WITH PASSWORD '<generated-password>';` in the Supabase SQL editor or `psql`, then construct the URL with a URL-encoded password and `sslmode=verify-full`.
- **One operator configuration, rather than one per store:** set `KIVI_TOKEN_ENCRYPTION_KEY` (32 base64 bytes; `openssl rand -base64 32`) in this service and, with the identical value, in the web app alongside `KIVI_BASE_URL` (Kivi's public HTTPS origin, without a path). Without a valid key the worker refuses to start and the web rejects pairing. Store and back up the key in the secret manager; losing it requires pairing stores again. Rotation requires a new `token_key_version` scheme; currently only version 1 exists.
- **Store flow without environment edits:** the owner opens Dashboard > Integrations, pastes the Kivi pairing code (`kvp_...`), and selects Connect. The server exchanges it at `POST {KIVI_BASE_URL}/api/v1/connections/pairing/exchange`, encrypts the `kc_...` token with AES-256-GCM (random 12-byte IV, store ID as authenticated data, preventing decryption after moving ciphertext to another store), and persists `core.kivi_connections.token_ciphertext`. The connection becomes `pending` and the worker performs its initial load. Disconnect attempts `revoke-self` on a best-effort basis and wipes the ciphertext.
- **Replacement fencing:** apply `20261028012148_kivi_sync_generation_fencing.sql`, `20261028012441_kivi_sync_fair_retry_claims.sql`, and `20261028014403_kivi_dead_event_generation_fence.sql` before starting the updated web/worker code. Worker reads use `core.kivi_sync_get_connection_v3`; state saves compare the tenant, remote connection, and persisted `sync_generation`, then advance that generation atomically. Owner saves also advance it, including same-ID relinking. Stale completions raise a typed failure. Newly acknowledged DEAD events also advance the generation, preserving pending initial loads and preventing in-flight work from clearing a new repair request. The old unfenced writer is revoked from the worker role, so old workers must be stopped during the coordinated upgrade.
- **Fair retries and restarts:** `core.kivi_sync_claim_due` atomically reserves up to 50 eligible connections with `FOR UPDATE SKIP LOCKED`. Persisted `next_attempt_at` eligibility is applied before the batch limit; failed or invalid oldest rows cannot indefinitely starve later stores. The cooldown survives worker restarts. Owner mutations reset eligibility so a new pairing or explicit sync request can run on the next tick. The cooldown is not a long-running HTTP ownership lease; remote writes remain idempotent and local completions are generation-fenced.
- **Legacy:** existing rows can still resolve `KIVI_CONNECTION_TOKEN_*` in `apps/worker/kivi-connections.env` or Coolify variables, with the database storing only the variable name. This mechanism is deprecated and no longer exposed in the interface. Retire it by disconnecting and pairing the store with a code.
- **Exhausted events:** if a Product outbox event exhausts retries (`DEAD`, for example after an approximately 40-second Kivi outage), each scheduler cycle (30 seconds) detects it through `core.kivi_sync_flag_dead_events()` from `20261027000000_kivi_sync_dead_events_and_version_offsets.sql`. `core.kivi_dead_event_acks` makes flagging idempotent per event. The connection becomes `needs_reconcile`; reconciliation repairs the catalog without waiting for the periodic six-hour run, subject to `KIVI_RETRY_INTERVAL_MS` (five minutes by default).
- **Kivi ahead of Canal:** if Kivi has a newer version after a manual change or version reset, reconciliation treats Canal as authoritative, resends above Kivi's version, and persists the per-product increment in `core.kivi_product_version_offsets` so later outbox deliveries remain monotonic. Normal outbox deliveries never bump blindly: a 409 marks `needs_reconcile`. Worker warnings contain counters without URLs or secrets.
