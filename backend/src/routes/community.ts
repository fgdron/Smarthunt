/**
 * Routes communautaires — signalement de promos en magasin par les utilisateurs.
 *
 * Flux :
 *   1. L'utilisateur scanne un EAN en magasin
 *   2. POST /v1/community/promos  → crée un signalement (statut 'pending')
 *   3. Autres users votent via POST /v1/community/promos/:id/vote
 *   4. Auto-confirmation après 3 upvotes, auto-rejet après 3 downvotes
 *   5. Auto-expiration 48h après création
 *
 * Authentification : user_id anonyme (UUID généré côté app, envoyé en header X-User-Id)
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';

// ─── Schémas Zod ─────────────────────────────────────────────────────────────

const ReportPromoSchema = z.object({
  ean:         z.string().min(8).max(14),
  storeId:     z.string().min(1),
  promoType:   z.enum(['percent', 'immediate', 'volume', 'bundle']),
  promoValue:  z.number().positive(),
  promoLabel:  z.string().min(1).max(200),
  stockLevel:  z.enum(['low', 'medium', 'high']),
  unitsApprox: z.number().int().positive().optional(),
  validUntil:  z.string().datetime().optional(),
});

const VoteSchema = z.object({
  vote: z.enum(['up', 'down']),
});

const ListQuerySchema = z.object({
  storeId:  z.string().optional(),
  status:   z.enum(['pending', 'confirmed', 'rejected', 'expired']).optional().default('confirmed'),
  limit:    z.coerce.number().int().min(1).max(100).optional().default(50),
});

// ─── Helper : résolution user_id ─────────────────────────────────────────────

function getUserId(request: { headers: Record<string, string | string[] | undefined> }): string | null {
  const h = request.headers['x-user-id'];
  return typeof h === 'string' && h.length > 0 ? h : null;
}

// ─── Helper : création table si besoin ───────────────────────────────────────

export async function ensureCommunityTable(app: FastifyInstance) {
  await app.pool.query(`
    CREATE TABLE IF NOT EXISTS community_promos (
      id            TEXT PRIMARY KEY,
      ean           TEXT NOT NULL,
      variant_id    TEXT,
      store_id      TEXT NOT NULL,
      promo_type    TEXT NOT NULL,
      promo_value   FLOAT NOT NULL,
      promo_label   TEXT NOT NULL,
      stock_level   TEXT NOT NULL,
      units_approx  INTEGER,
      valid_until   TIMESTAMP,
      reported_by   TEXT NOT NULL,
      upvotes       INTEGER DEFAULT 0,
      downvotes     INTEGER DEFAULT 0,
      status        TEXT DEFAULT 'pending',
      "createdAt"   TIMESTAMP DEFAULT NOW(),
      "updatedAt"   TIMESTAMP DEFAULT NOW(),
      expires_at    TIMESTAMP NOT NULL
    )
  `);

  // Table des votes (évite les doubles votes)
  await app.pool.query(`
    CREATE TABLE IF NOT EXISTS community_votes (
      promo_id    TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      vote        TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (promo_id, user_id)
    )
  `);

  // Index utiles
  await app.pool.query(`
    CREATE INDEX IF NOT EXISTS idx_community_promos_store
      ON community_promos (store_id, status, expires_at)
  `);
  await app.pool.query(`
    CREATE INDEX IF NOT EXISTS idx_community_promos_ean
      ON community_promos (ean, status)
  `);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function communityRoutes(app: FastifyInstance) {

  // Crée les tables au démarrage (idempotent)
  await ensureCommunityTable(app);

  // ── POST /v1/community/promos — signaler une promo ──────────────────────────
  app.post('/v1/community/promos', async (request, reply) => {
    const userId = getUserId(request as any);
    if (!userId) {
      return reply.status(400).send({ error: 'X-User-Id header requis' });
    }

    const parsed = ReportPromoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Payload invalide', details: parsed.error.flatten() });
    }

    const d = parsed.data;

    // Résoudre le variant_id depuis l'EAN
    const variantRes = await app.pool.query<{ id: string }>(
      'SELECT id FROM product_variants WHERE ean = $1 LIMIT 1',
      [d.ean],
    );
    const variantId = variantRes.rows[0]?.id ?? null;

    // Vérifier que le store existe
    const storeRes = await app.pool.query<{ id: string }>(
      'SELECT id FROM stores WHERE id = $1 LIMIT 1',
      [d.storeId],
    );
    if (storeRes.rows.length === 0) {
      return reply.status(400).send({ error: `Enseigne inconnue : ${d.storeId}` });
    }

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // +48h

    await app.pool.query(
      `INSERT INTO community_promos
         (id, ean, variant_id, store_id, promo_type, promo_value, promo_label,
          stock_level, units_approx, valid_until, reported_by, expires_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        d.ean, variantId, d.storeId,
        d.promoType, d.promoValue, d.promoLabel,
        d.stockLevel, d.unitsApprox ?? null,
        d.validUntil ? new Date(d.validUntil) : null,
        userId, expiresAt,
      ],
    );

    return reply.status(201).send({
      ok:      true,
      message: 'Promo signalée — merci pour la communauté ! 🎉',
    });
  });

  // ── POST /v1/community/promos/:id/vote — voter ──────────────────────────────
  app.post<{ Params: { id: string } }>('/v1/community/promos/:id/vote', async (request, reply) => {
    const userId = getUserId(request as any);
    if (!userId) {
      return reply.status(400).send({ error: 'X-User-Id header requis' });
    }

    const parsed = VoteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'vote doit être "up" ou "down"' });
    }

    const { id }   = request.params;
    const { vote } = parsed.data;

    // Vérifier que le signalement existe et n'est pas expiré
    const promoRes = await app.pool.query<{ id: string; upvotes: number; downvotes: number; status: string }>(
      `SELECT id, upvotes, downvotes, status
       FROM community_promos
       WHERE id = $1 AND expires_at > NOW() AND status NOT IN ('rejected','expired')`,
      [id],
    );
    if (promoRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Signalement introuvable ou expiré' });
    }

    // Empêcher le double vote
    try {
      await app.pool.query(
        `INSERT INTO community_votes (promo_id, user_id, vote) VALUES ($1, $2, $3)`,
        [id, userId, vote],
      );
    } catch {
      return reply.status(409).send({ error: 'Tu as déjà voté pour ce signalement' });
    }

    // Mettre à jour les compteurs
    const col = vote === 'up' ? 'upvotes' : 'downvotes';
    const updated = await app.pool.query<{ upvotes: number; downvotes: number }>(
      `UPDATE community_promos
       SET "${col === 'upvotes' ? 'upvotes' : 'downvotes'}" = ${col} + 1, "updatedAt" = NOW()
       WHERE id = $1
       RETURNING upvotes, downvotes`,
      [id],
    );

    const { upvotes, downvotes } = updated.rows[0];

    // Auto-confirmation / rejet selon seuils
    let newStatus: string | null = null;
    if (upvotes >= 3)   newStatus = 'confirmed';
    if (downvotes >= 3) newStatus = 'rejected';

    if (newStatus) {
      await app.pool.query(
        `UPDATE community_promos SET status = $1, "updatedAt" = NOW() WHERE id = $2`,
        [newStatus, id],
      );
    }

    return reply.send({
      ok:      true,
      upvotes,
      downvotes,
      status:  newStatus ?? promoRes.rows[0].status,
    });
  });

  // ── GET /v1/community/promos — lister les promos actives ────────────────────
  app.get('/v1/community/promos', async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Paramètres invalides' });
    }

    const { storeId, status, limit } = parsed.data;

    const conditions = [
      `cp.expires_at > NOW()`,
      `cp.status = $1`,
    ];
    const params: unknown[] = [status];

    if (storeId) {
      conditions.push(`cp.store_id = $${params.length + 1}`);
      params.push(storeId);
    }

    params.push(limit);
    const limitParam = `$${params.length}`;

    const result = await app.pool.query(
      `SELECT
         cp.id, cp.ean, cp.store_id, cp.promo_type, cp.promo_value, cp.promo_label,
         cp.stock_level, cp.units_approx, cp.valid_until, cp.upvotes, cp.downvotes,
         cp.status, cp."createdAt", cp.expires_at,
         pv.brand, pv.name AS variant_name,
         pg."genericName" AS generic_name, pg.emoji
       FROM community_promos cp
       LEFT JOIN product_variants pv ON pv.id = cp.variant_id
       LEFT JOIN product_groups   pg ON pg.id  = pv."groupId"
       WHERE ${conditions.join(' AND ')}
       ORDER BY cp.upvotes DESC, cp."createdAt" DESC
       LIMIT ${limitParam}`,
      params,
    );

    return reply.send({
      generated_at: Date.now(),
      count:        result.rows.length,
      promos:       result.rows,
    });
  });

  // ── GET /v1/community/promos/product/:ean — promos pour un produit ──────────
  app.get<{ Params: { ean: string } }>('/v1/community/promos/product/:ean', async (request, reply) => {
    const { ean } = request.params;

    const result = await app.pool.query(
      `SELECT
         cp.id, cp.store_id, cp.promo_type, cp.promo_value, cp.promo_label,
         cp.stock_level, cp.units_approx, cp.upvotes, cp.downvotes,
         cp.status, cp."createdAt", cp.expires_at
       FROM community_promos cp
       WHERE cp.ean = $1
         AND cp.expires_at > NOW()
         AND cp.status IN ('pending', 'confirmed')
       ORDER BY cp.status DESC, cp.upvotes DESC`,
      [ean],
    );

    return reply.send({
      ean,
      promos: result.rows,
    });
  });
}
