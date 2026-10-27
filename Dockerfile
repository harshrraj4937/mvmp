# syntax=docker/dockerfile:1

FROM oven/bun:1.2.12 AS bun

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Includes Drizzle tooling for the Compose database setup service.
FROM dependencies AS tooling
COPY . .

FROM tooling AS builder
ARG NEXT_PUBLIC_APP_URL=http://localhost:8080
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
# Build-time imports need these values; real credentials are runtime-only.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    AUTH_SECRET=build-only-placeholder-not-a-runtime-secret \
    NEXT_SERVER_APP_URL=${NEXT_PUBLIC_APP_URL} \
    bun run build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
