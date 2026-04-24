FROM node:18-slim

WORKDIR /app

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends openssl libssl-dev && \
    rm -rf /var/lib/apt/lists/*

# Installe toutes les dépendances (dev inclus) pour le build
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

# prisma db push lancé au runtime via le script start
CMD ["node", "dist/server.js"]
