FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS dependencies
WORKDIR /app

RUN npm install --global pnpm@10.24.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/core/package.json ./packages/core/package.json

# Keep the workspace layout and install only the worker and its core dependency.
# Skip repository hooks in the image, then prepare the native esbuild binary.
RUN pnpm --filter ./apps/worker --filter ./packages/core install --frozen-lockfile --prod --ignore-scripts
RUN pnpm --recursive rebuild esbuild

FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS runtime
ENV NODE_ENV=production
ENV WORKER_HEALTH_PORT=8081
ENV TSX_TSCONFIG_PATH=/app/apps/worker/tsconfig.json
# postgres.js uses PGSSL when the connection URL does not specify ssl/sslmode.
ENV PGSSL=verify-full
ENV NODE_EXTRA_CA_CERTS=/app/apps/worker/certificates/supabase-prod-ca-2021.crt

WORKDIR /app
COPY --from=dependencies /app/ ./
COPY packages/core/src ./packages/core/src
COPY packages/core/tsconfig.json ./packages/core/tsconfig.json
COPY apps/worker/src ./apps/worker/src
COPY apps/worker/tsconfig.json apps/worker/healthcheck.mjs ./apps/worker/
COPY apps/worker/certificates/supabase-prod-ca-2021.crt ./apps/worker/certificates/
COPY apps/web/messages/es.json apps/web/messages/en.json ./apps/web/messages/

USER node
WORKDIR /app/apps/worker
ENTRYPOINT ["node", "--import", "tsx"]
CMD ["src/main.ts"]
