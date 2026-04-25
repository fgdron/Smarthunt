FROM node:18-slim

WORKDIR /app

COPY package*.json ./
# --include=dev force l'installation des devDeps même si NODE_ENV=production
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/server.js"]
