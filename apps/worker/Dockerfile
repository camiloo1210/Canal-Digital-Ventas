FROM node:22.23.3-trixie-slim@sha256:154ba2f4d6fec323d28e4f4bb86bba4677f1223391a1979cf521304e03a98dfa AS dependencies
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

# Google's minimal glibc runtime, with the unmodified official Node binary.
# No shell, package managers, headers or operating-system administration tools.
FROM gcr.io/distroless/cc-debian13:nonroot@sha256:e792ab3d241a468a4fd7519ddbbebe66b49b5f365771716ea688ad40b6c6f1c2 AS runtime
COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=128
ENV WORKER_HEALTH_PORT=8081
ENV TSX_TSCONFIG_PATH=/app/apps/worker/tsconfig.json
# postgres.js uses PGSSL when the connection URL does not specify ssl/sslmode.
ENV PGSSL=verify-full
ENV NODE_EXTRA_CA_CERTS=/app/apps/worker/certificates/supabase-prod-ca-2021.crt

WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=dependencies /app/packages/core/node_modules ./packages/core/node_modules
COPY package.json ./package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/core/src ./packages/core/src
COPY packages/core/tsconfig.json ./packages/core/tsconfig.json
COPY apps/worker/src ./apps/worker/src
COPY apps/worker/tsconfig.json apps/worker/healthcheck.mjs ./apps/worker/
COPY apps/worker/certificates/supabase-prod-ca-2021.crt ./apps/worker/certificates/
COPY apps/web/messages/es.json apps/web/messages/en.json ./apps/web/messages/

USER nonroot:nonroot
WORKDIR /app/apps/worker
ENTRYPOINT ["node", "--import", "tsx"]
CMD ["src/main.ts"]
