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
COPY backend/tsconfig.seed.json ./backend/
COPY backend/src ./backend/src
COPY backend/prisma ./backend/prisma
COPY backend/prisma.config.ts ./backend/prisma.config.ts
RUN cd backend && DATABASE_URL=postgresql://build:build@localhost/build bunx prisma generate

WORKDIR /app/backend
RUN bun run build
RUN bunx tsc --project tsconfig.seed.json

# Use slim (Debian/glibc) so sodium-native can use its linux-arm64/linux-x64 prebuilts.
FROM node:22-slim AS deps
WORKDIR /app
COPY --from=builder /app/backend/package.json ./
# Schema at backend/prisma/ so "../../node_modules/.prisma/client" resolves to /app/node_modules/.prisma/client
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/backend/prisma.config.ts ./prisma.config.ts
RUN npm install --omit=dev && DATABASE_URL=postgresql://build:build@localhost/build npx prisma generate --schema=./backend/prisma/schema.prisma

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/prisma.config.ts ./prisma.config.ts
COPY --from=deps /app/node_modules ./node_modules

COPY backend/docker-entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
