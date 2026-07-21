# Construir desde la RAÍZ del repo (necesita el workspace completo):
#   docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo
# Evita que el script "prepare" (husky) corra dentro del contenedor.
ENV HUSKY=0

# ── Stage 1: build ────────────────────────────────────────────────
FROM base AS build
# Solo manifests primero: la capa de install se cachea entre builds.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @app/api...

COPY packages/tsconfig packages/tsconfig
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @app/contracts build && pnpm --filter @app/api build

# ── Stage 2: runtime ──────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
# Cache de Tectonic con ruta fija: se pre-caldea en el build y se reusa en runtime.
ENV TECTONIC_CACHE_DIR=/var/cache/tectonic

# Motor LaTeX → PDF: binario ESTÁTICO de Tectonic (self-contained, musl) que
# coincide con la arquitectura de la imagen. Luego se PRE-CALDEA la cache
# compilando un .tex de muestra en el build, de modo que el primer PDF en
# runtime no dependa de descargas (evita lentitud/flakiness en Coolify).
ARG TECTONIC_VERSION=0.16.9
RUN apk add --no-cache ca-certificates \
 && ARCH="$(uname -m)" \
 && case "$ARCH" in \
      x86_64) TARGET=x86_64-unknown-linux-musl ;; \
      aarch64) TARGET=aarch64-unknown-linux-musl ;; \
      *) echo "arquitectura no soportada para tectonic: $ARCH" && exit 1 ;; \
    esac \
 && wget -qO /tmp/tectonic.tar.gz "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-${TARGET}.tar.gz" \
 && tar -xzf /tmp/tectonic.tar.gz -C /usr/local/bin tectonic \
 && rm -f /tmp/tectonic.tar.gz \
 && tectonic --version
COPY apps/api/docker/prewarm.tex /tmp/prewarm.tex
RUN tectonic /tmp/prewarm.tex --outdir /tmp --chatter minimal --untrusted \
 && rm -f /tmp/prewarm.tex /tmp/prewarm.pdf

# Reinstala solo deps de producción preservando el layout del workspace
# (los symlinks de pnpm son relativos: funcionan dentro de la imagen).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN pnpm install --prod --frozen-lockfile --ignore-scripts --filter @app/api...

COPY --from=build /repo/packages/contracts/dist packages/contracts/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null 2>&1 || exit 1

# Migraciones + seed SIEMPRE corren antes de levantar la API.
ENTRYPOINT ["./docker-entrypoint.sh"]
