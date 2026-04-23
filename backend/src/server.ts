/**
 * SmartHunt API V2 — Fastify Server
 *
 * Démarrage :
 *   npm run dev      →  mode développement (tsx watch + logs colorés)
 *   npm run build    →  compile TypeScript → dist/
 *   npm start        →  lance dist/server.js
 *
 * Variables d'environnement : voir .env.example
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';

import { productsRoutes } from './routes/products.js';
import { offersRoutes }   from './routes/offers.js';
import { storesRoutes }   from './routes/stores.js';
import { internalRoutes } from './routes/internal.js';

// ─── Prisma augmentation (décorateur Fastify) ────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // ── Prisma ───────────────────────────────────────────────────────────────
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

  app.decorate('prisma', prisma);

  // Nettoyage propre au shutdown
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  // ── Plugins ───────────────────────────────────────────────────────────────
  await app.register(helmet, {
    // CSP désactivé (API JSON — pas de HTML)
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: (process.env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean),
  });

  await app.register(rateLimit, {
    max:      Number(process.env.RATE_LIMIT_MAX ?? 100),
    timeWindow: '1 minute',
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  await app.register(productsRoutes);
  await app.register(offersRoutes);
  await app.register(storesRoutes);
  await app.register(internalRoutes);

  // ── Health check ──────────────────────────────────────────────────────────
  app.get('/health', async () => ({
    status:    'ok',
    timestamp: new Date().toISOString(),
    version:   '2.0.0',
  }));

  return app;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const app  = await buildApp();
  const port = Number(process.env.PORT  ?? 3000);
  const host = String(process.env.HOST  ?? '0.0.0.0');

  try {
    await app.listen({ port, host });
    app.log.info(`SmartHunt API V2 démarré sur http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
