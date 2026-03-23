# syntax=docker/dockerfile:1

FROM oven/bun:1.3.10-alpine AS builder
WORKDIR /app

# Copy workspace manifests for layer cache efficiency.
COPY package.json bun.lock ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN bun install --frozen-lockfile

COPY tsconfig.base.json ./
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src
COPY backend/prisma ./backend/prisma
RUN cd backend && bunx prisma generate

WORKDIR /app/backend
RUN bun run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package.json ./
COPY --from=builder /app/backend/prisma ./prisma
RUN npm install --omit=dev --ignore-scripts && npx prisma generate

COPY backend/docker-entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
