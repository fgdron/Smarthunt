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
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

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

  // ── Prisma (via pg driver adapter — no native binary) ────────────────────
  const pool   = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('sslmode=require') || process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : undefined,
  });
  const adapter = new PrismaPg(pool);
  const prisma  = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

  app.decorate('prisma', prisma);

  // Nettoyage propre au shutdown
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    await pool.end();
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

  // ── Diagnostic env vars ───────────────────────────────────────────────────
  app.log.info(`ENV CHECK — INTERNAL_API_KEY: ${process.env.INTERNAL_API_KEY ? 'SET ✓' : 'NOT SET ✗'}`);
  app.log.info(`ENV CHECK — NODE_ENV: ${process.env.NODE_ENV}`);
  app.log.info(`ENV CHECK — PORT: ${process.env.PORT}`);

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

  // ── Diagnostic : env vars présentes ─────────────────────────────────────
  app.get('/v1/debug-env', async () => {
    const dbUrl = process.env.DATABASE_URL;
    return {
      INTERNAL_API_KEY: process.env.INTERNAL_API_KEY ? 'SET' : 'NOT SET',
      NODE_ENV:         process.env.NODE_ENV ?? 'NOT SET',
      PORT:             process.env.PORT ?? 'NOT SET',
      DATABASE_URL:     dbUrl
        ? `SET (starts: ${dbUrl.substring(0, 20)}…)`
        : 'NOT SET',
      allKeys: Object.keys(process.env).sort(),
    };
  });

  // ── Diagnostic : connexion PostgreSQL pure JS (sans Prisma) ─────────────
  app.get('/v1/test-pg', async (_req, reply) => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return reply.status(500).send({ error: 'DATABASE_URL not set in process.env' });
    }
    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    try {
      const result = await pool.query('SELECT NOW() AS now, current_database() AS db');
      return { ok: true, row: result.rows[0] };
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    } finally {
      await pool.end();
    }
  });

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
