/**
 * SmartHunt API V2 — Fastify Server
 * Pure pg driver — no Prisma, no native binary, no WASM crash.
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { Pool } from 'pg';

import { productsRoutes } from './routes/products.js';
import { offersRoutes }   from './routes/offers.js';
import { storesRoutes }   from './routes/stores.js';
import { internalRoutes } from './routes/internal.js';

// ─── Fastify pool decorator ───────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    pool: Pool;
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

  // ── pg Pool (pure JS — zero native binary) ───────────────────────────────
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });

  app.decorate('pool', pool);

  app.addHook('onClose', async () => {
    await pool.end();
  });

  // ── Plugins ───────────────────────────────────────────────────────────────
  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(cors, {
    origin: (process.env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean),
  });

  await app.register(rateLimit, {
    max:        Number(process.env.RATE_LIMIT_MAX ?? 100),
    timeWindow: '1 minute',
  });

  // ── Diagnostic logs ───────────────────────────────────────────────────────
  app.log.info(`ENV CHECK — INTERNAL_API_KEY: ${process.env.INTERNAL_API_KEY ? 'SET ✓' : 'NOT SET ✗'}`);
  app.log.info(`ENV CHECK — DATABASE_URL: ${process.env.DATABASE_URL ? 'SET ✓' : 'NOT SET ✗'}`);
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

  // ── Debug : env vars ─────────────────────────────────────────────────────
  app.get('/v1/debug-env', async () => {
    const dbUrl = process.env.DATABASE_URL;
    return {
      INTERNAL_API_KEY: process.env.INTERNAL_API_KEY ? 'SET' : 'NOT SET',
      NODE_ENV:         process.env.NODE_ENV ?? 'NOT SET',
      PORT:             process.env.PORT ?? 'NOT SET',
      DATABASE_URL:     dbUrl ? `SET (starts: ${dbUrl.substring(0, 20)}…)` : 'NOT SET',
      allKeys:          Object.keys(process.env).sort(),
    };
  });

  // ── Debug : test connexion pg ─────────────────────────────────────────────
  app.get('/v1/test-pg', async (_req, reply) => {
    try {
      const result = await pool.query('SELECT NOW() AS now, current_database() AS db');
      return { ok: true, row: result.rows[0] };
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });

  return app;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const app  = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = String(process.env.HOST ?? '0.0.0.0');

  try {
    await app.listen({ port, host });
    app.log.info(`SmartHunt API V2 démarré sur http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message, err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

main();
