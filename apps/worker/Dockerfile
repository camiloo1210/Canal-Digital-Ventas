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

WORKDIR /app
COPY --from=dependencies --chown=node:node /app/ ./
COPY --chown=node:node packages/core/src ./packages/core/src
COPY --chown=node:node packages/core/tsconfig.json ./packages/core/tsconfig.json
COPY --chown=node:node apps/worker/src ./apps/worker/src
COPY --chown=node:node apps/worker/tsconfig.json apps/worker/healthcheck.mjs ./apps/worker/
COPY --chown=node:node apps/web/messages/es.json apps/web/messages/en.json ./apps/web/messages/

USER node
WORKDIR /app/apps/worker
ENTRYPOINT ["node", "--import", "tsx"]
CMD ["src/main.ts"]
