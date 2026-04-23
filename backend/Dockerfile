# ─── Stage 1 : build TypeScript ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Dépendances uniquement (cache Docker layer)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Génère le client Prisma AVANT le build TS
RUN npx prisma generate

# Build TypeScript → dist/
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# ─── Stage 2 : image de production (légère) ──────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Seules les prod dependencies + client Prisma généré
COPY package*.json ./
RUN npm ci --omit=dev

# Copie artefacts du builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma/

EXPOSE 3000

# Lance les migrations puis démarre le serveur
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
