/**
 * Routes internes — réservées au scraper / pipeline d'ingestion.
 * Protégées par `Authorization: Bearer <INTERNAL_API_KEY>`.
 * Toutes les requêtes DB utilisent pg pur (pas de Prisma).
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';

// ─── Middleware auth ──────────────────────────────────────────────────────────

function requireInternalKey(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    const apiKey = process.env.INTERNAL_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({ error: 'INTERNAL_API_KEY not configured' });
    }
    const auth = request.headers['authorization'];
    if (!auth || auth !== `Bearer ${apiKey}`) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });
}

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

const StorePriceSchema = z.record(z.number().nonnegative());

const PromoSchema = z.object({
  type:       z.enum(['percent', 'volume', 'immediate']),
  value:      z.number().nonnegative(),
  label:      z.string().min(1),
  store:      z.string().default('all'),
  minQty:     z.number().int().positive().optional(),
  validUntil: z.string().datetime().optional(),
}).optional();

const CashbackSchema = z.object({
  app:    z.enum(['shopmium', 'quoty', 'coupon_network']),
  amount: z.number().positive(),
  label:  z.string().min(1),
}).optional();

const VariantSchema = z.object({
  ean:          z.string().min(8).max(14),
  brand:        z.string().min(1),
  name:         z.string().min(1),
  segment:      z.enum(['mdd', 'leader', 'bio']),
  imageUrl:     z.string().url().optional(),
  basePrice:    z.number().positive(),
  pricePerUnit: z.number().positive(),
  unitRef:      z.enum(['kg', 'L', 'unit']),
  prices:       StorePriceSchema,
  in_stock:     z.record(z.boolean()).optional(),
  promo:        PromoSchema,
  cashback:     CashbackSchema,
});

const ProductGroupSchema = z.object({
  groupId:         z.string().min(1),
  genericName:     z.string().min(1),
  emoji:           z.string().min(1),
  imageUrl:        z.string().url().optional(),
  categorySlug:    z.string().min(1),
  subcategorySlug: z.string().min(1),
  equivalenceKey:  z.string().min(1),
  unitSize:        z.number().positive(),
  unitType:        z.enum(['kg', 'L', 'unit']),
  variants:        z.array(VariantSchema).min(1),
});

const UpdatePricesBodySchema = z.object({
  products: z.array(ProductGroupSchema).min(1),
});

const OfferSchema = z.object({
  id:              z.string().min(1),
  provider:        z.enum(['shopmium', 'quoty', 'coupon_network']),
  label:           z.string().min(1),
  amount:          z.number().positive(),
  eanList:         z.array(z.string()).default([]),
  minQty:          z.number().int().positive().default(1),
  validUntil:      z.string().datetime(),
  deeplinkIos:     z.string().url().optional(),
  deeplinkAndroid: z.string().url().optional(),
  active:          z.boolean().default(true),
});

const UpdateOffersBodySchema = z.object({
  offers: z.array(OfferSchema).min(1),
});

const StoreSchema = z.object({
  id:    z.string().min(1),
  name:  z.string().min(1),
  color: z.string().min(1),
  lat:   z.number(),
  lng:   z.number(),
});

const SeedStoresBodySchema = z.object({
  stores: z.array(StoreSchema).min(1),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function internalRoutes(app: FastifyInstance) {
  requireInternalKey(app);

  // ── POST /v1/internal/seed-stores ──────────────────────────────────────────
  app.post('/v1/internal/seed-stores', async (request, reply) => {
    const parseResult = SeedStoresBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid payload', details: parseResult.error.flatten() });
    }

    const { stores } = parseResult.data;
    const client = await app.pool.connect();
    try {
      await client.query('BEGIN');
      for (const store of stores) {
        await client.query(
          `INSERT INTO stores (id, name, color, lat, lng, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
           ON CONFLICT (id) DO UPDATE SET
             name       = EXCLUDED.name,
             color      = EXCLUDED.color,
             lat        = EXCLUDED.lat,
             lng        = EXCLUDED.lng,
             "updatedAt" = NOW()`,
          [store.id, store.name, store.color, store.lat, store.lng],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: String(err) });
    } finally {
      client.release();
    }

    return reply.status(200).send({ ok: true, upserted: stores.length });
  });

  // ── GET /v1/internal/ping-db ────────────────────────────────────────────────
  app.get('/v1/internal/ping-db', async (_request, reply) => {
    try {
      const [storesRes, groupsRes] = await Promise.all([
        app.pool.query<{ count: string }>('SELECT COUNT(*) FROM stores'),
        app.pool.query<{ count: string }>('SELECT COUNT(*) FROM product_groups'),
      ]);
      return reply.send({
        ok:     true,
        stores: Number(storesRes.rows[0].count),
        groups: Number(groupsRes.rows[0].count),
      });
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });

  // ── POST /v1/internal/update-prices ────────────────────────────────────────
  app.post('/v1/internal/update-prices', async (request, reply) => {
    const parseResult = UpdatePricesBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error:   'Invalid payload',
        details: parseResult.error.flatten(),
      });
    }

    const { products } = parseResult.data;
    let upsertedGroups = 0, upsertedVariants = 0, upsertedPrices = 0;

    const client = await app.pool.connect();
    try {
      await client.query('BEGIN');

      for (const group of products) {
        // 1. Upsert groupe produit
        await client.query(
          `INSERT INTO product_groups
             (id, "genericName", emoji, "imageUrl", "categorySlug", "subcategorySlug",
              "equivalenceKey", "unitSize", "unitType", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
           ON CONFLICT (id) DO UPDATE SET
             "genericName"     = EXCLUDED."genericName",
             emoji             = EXCLUDED.emoji,
             "imageUrl"        = EXCLUDED."imageUrl",
             "categorySlug"    = EXCLUDED."categorySlug",
             "subcategorySlug" = EXCLUDED."subcategorySlug",
             "equivalenceKey"  = EXCLUDED."equivalenceKey",
             "unitSize"        = EXCLUDED."unitSize",
             "unitType"        = EXCLUDED."unitType",
             "updatedAt"       = NOW()`,
          [group.groupId, group.genericName, group.emoji, group.imageUrl ?? null,
           group.categorySlug, group.subcategorySlug, group.equivalenceKey,
           group.unitSize, group.unitType],
        );
        upsertedGroups++;

        for (const variant of group.variants) {
          // 2. Upsert variante
          const variantRes = await client.query<{ id: string }>(
            `INSERT INTO product_variants
               (id, ean, segment, brand, name, "imageUrl", "basePrice", "pricePerUnit",
                "unitRef", "groupId", "lastVerified", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW(),NOW())
             ON CONFLICT (ean) DO UPDATE SET
               brand          = EXCLUDED.brand,
               name           = EXCLUDED.name,
               "imageUrl"     = EXCLUDED."imageUrl",
               "basePrice"    = EXCLUDED."basePrice",
               "pricePerUnit" = EXCLUDED."pricePerUnit",
               "lastVerified" = NOW(),
               "updatedAt"    = NOW()
             RETURNING id`,
            [variant.ean, variant.segment, variant.brand, variant.name,
             variant.imageUrl ?? null, variant.basePrice, variant.pricePerUnit,
             variant.unitRef, group.groupId],
          );
          const variantId = variantRes.rows[0].id;
          upsertedVariants++;

          // 3. Upsert prix par enseigne
          for (const [storeId, price] of Object.entries(variant.prices)) {
            const inStock = variant.in_stock?.[storeId] !== false;
            await client.query(
              `INSERT INTO store_prices (id, "variantId", "storeId", price, "inStock", "updatedAt")
               VALUES (gen_random_uuid()::text,$1,$2,$3,$4,NOW())
               ON CONFLICT ("variantId", "storeId") DO UPDATE SET
                 price      = EXCLUDED.price,
                 "inStock"  = EXCLUDED."inStock",
                 "updatedAt" = NOW()`,
              [variantId, storeId, price, inStock],
            );
            upsertedPrices++;
          }

          // 4. Upsert promo catalogue
          if (variant.promo) {
            await client.query(
              'DELETE FROM catalogue_promos WHERE "variantId" = $1',
              [variantId],
            );
            await client.query(
              `INSERT INTO catalogue_promos
                 (id, "variantId", type, value, label, store, "minQty", "validUntil", "createdAt", "updatedAt")
               VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
              [variantId, variant.promo.type, variant.promo.value, variant.promo.label,
               variant.promo.store, variant.promo.minQty ?? null,
               variant.promo.validUntil ? new Date(variant.promo.validUntil) : null],
            );
          }

          // 5. Upsert cashback statique
          if (variant.cashback) {
            await client.query(
              'DELETE FROM variant_cashbacks WHERE "variantId" = $1',
              [variantId],
            );
            await client.query(
              `INSERT INTO variant_cashbacks
                 (id, "variantId", app, amount, label, "createdAt", "updatedAt")
               VALUES (gen_random_uuid()::text,$1,$2,$3,$4,NOW(),NOW())`,
              [variantId, variant.cashback.app, variant.cashback.amount, variant.cashback.label],
            );
          }
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      const msg = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, 'update-prices transaction failed');
      return reply.status(500).send({ error: 'Transaction failed', details: msg });
    } finally {
      client.release();
    }

    return reply.status(200).send({
      ok:              true,
      upsertedGroups,
      upsertedVariants,
      upsertedPrices,
      processedAt:     new Date().toISOString(),
    });
  });

  // ── POST /v1/internal/update-offers ────────────────────────────────────────
  app.post('/v1/internal/update-offers', async (request, reply) => {
    const parseResult = UpdateOffersBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error:   'Invalid payload',
        details: parseResult.error.flatten(),
      });
    }

    const { offers } = parseResult.data;
    const client = await app.pool.connect();
    try {
      await client.query('BEGIN');

      for (const offer of offers) {
        await client.query(
          `INSERT INTO cashback_offers
             (id, provider, label, amount, "eanList", "minQty", "validUntil",
              "deeplinkIos", "deeplinkAndroid", active, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
           ON CONFLICT (id) DO UPDATE SET
             label              = EXCLUDED.label,
             amount             = EXCLUDED.amount,
             "eanList"          = EXCLUDED."eanList",
             "minQty"           = EXCLUDED."minQty",
             "validUntil"       = EXCLUDED."validUntil",
             "deeplinkIos"      = EXCLUDED."deeplinkIos",
             "deeplinkAndroid"  = EXCLUDED."deeplinkAndroid",
             active             = EXCLUDED.active,
             "updatedAt"        = NOW()`,
          [offer.id, offer.provider, offer.label, offer.amount, offer.eanList,
           offer.minQty, new Date(offer.validUntil),
           offer.deeplinkIos ?? null, offer.deeplinkAndroid ?? null, offer.active],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: String(err) });
    } finally {
      client.release();
    }

    return reply.status(200).send({
      ok:          true,
      upserted:    offers.length,
      processedAt: new Date().toISOString(),
    });
  });
}
