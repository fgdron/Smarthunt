# ─── Stage 1 : build TypeScript ──────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# OpenSSL requis par Prisma (Debian)
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Génère le client Prisma AVANT le build TS
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# ─── Stage 2 : image de production ───────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma/

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/server.js"]
