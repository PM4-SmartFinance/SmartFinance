# syntax=docker/dockerfile:1

FROM oven/bun:1.3.14-alpine AS builder
WORKDIR /app

# Copy workspace manifests for layer cache efficiency.
COPY package.json bun.lock ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY .github/scripts/package.json ./.github/scripts/
RUN bun install --frozen-lockfile

COPY tsconfig.base.json ./
COPY frontend/tsconfig.json ./frontend/
COPY frontend/tsconfig.app.json ./frontend/
COPY frontend/tsconfig.node.json ./frontend/
COPY frontend/src ./frontend/src
# public/ holds i18n locale JSON and other static assets that Vite copies into
# dist/ at build time. Without it the build ships no /locales/<lng>/translation.json,
# so nginx serves index.html for those paths and i18n fails with a JSON parse error.
COPY frontend/public ./frontend/public
COPY frontend/index.html ./frontend/
COPY frontend/vite.config.ts ./frontend/

WORKDIR /app/frontend
RUN bun run build

FROM nginx:1.27-alpine AS runner
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
