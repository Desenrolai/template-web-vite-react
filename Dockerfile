# syntax=docker/dockerfile:1

# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
RUN npm run build

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
# Static server em Node (não nginx): o forge sobe o pod com
# readOnlyRootFilesystem: true, e o nginx precisa escrever em /var/cache.
FROM node:24-alpine AS runtime

RUN addgroup -g 1001 -S appgroup \
    && adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --chown=appuser:appgroup server.mjs ./

# O forge roda o pod com runAsUser: 1001 e readOnlyRootFilesystem: true.
USER 1001

EXPOSE 8080

# Coerente com o healthPath do forge.yaml (`/`).
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["node", "server.mjs"]
