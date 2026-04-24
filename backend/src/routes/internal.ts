/**
 * Routes internes — réservées au scraper / pipeline d'ingestion.
 * Protégées par `Authorization: Bearer <INTERNAL_API_KEY>`.
 *
 * POST /v1/internal/update-prices
 *   Upsert atomique (transaction Prisma) de groupes produits + variantes + prix.
 *
 * POST /v1/internal/update-offers
 *   Upsert atomique des offres ODR externes (Shopmium, Quoty, Coupon Network).
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

const StorePriceSchema = z.record(z.number().nonnegative());  // { carrefour: 2.49 }

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

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function internalRoutes(app: FastifyInstance) {
  requireInternalKey(app);

  // ── GET /v1/internal/ping-db — test connexion Prisma ────────────────────────
  app.get('/v1/internal/ping-db', async (_request, reply) => {
    try {
      const stores   = await app.prisma.store.count();
      const groups   = await app.prisma.productGroup.count();
      return reply.send({ ok: true, stores, groups });
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });

  // ── POST /v1/internal/update-prices ─────────────────────────────────────────
  app.post('/v1/internal/update-prices', async (request, reply) => {
    const parseResult = UpdatePricesBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error:   'Invalid payload',
        details: parseResult.error.flatten(),
      });
    }

    const { products } = parseResult.data;
    let upsertedGroups   = 0;
    let upsertedVariants = 0;
    let upsertedPrices   = 0;

    try { for (const group of products) { await app.prisma.$transaction(async (tx) => {
        // 1. Upsert groupe produit
        await tx.productGroup.upsert({
          where:  { id: group.groupId },
          create: {
            id:              group.groupId,
            genericName:     group.genericName,
            emoji:           group.emoji,
            imageUrl:        group.imageUrl ?? null,
            categorySlug:    group.categorySlug,
            subcategorySlug: group.subcategorySlug,
            equivalenceKey:  group.equivalenceKey,
            unitSize:        group.unitSize,
            unitType:        group.unitType,
          },
          update: {
            genericName:     group.genericName,
            emoji:           group.emoji,
            imageUrl:        group.imageUrl ?? null,
            categorySlug:    group.categorySlug,
            subcategorySlug: group.subcategorySlug,
            equivalenceKey:  group.equivalenceKey,
            unitSize:        group.unitSize,
            unitType:        group.unitType,
          },
        });
        upsertedGroups++;

        for (const variant of group.variants) {
          // 2. Upsert variante
          const dbVariant = await tx.productVariant.upsert({
            where:  { ean: variant.ean },
            create: {
              ean:          variant.ean,
              segment:      variant.segment,
              brand:        variant.brand,
              name:         variant.name,
              imageUrl:     variant.imageUrl ?? null,
              basePrice:    variant.basePrice,
              pricePerUnit: variant.pricePerUnit,
              unitRef:      variant.unitRef,
              groupId:      group.groupId,
              lastVerified: new Date(),
            },
            update: {
              brand:        variant.brand,
              name:         variant.name,
              imageUrl:     variant.imageUrl ?? null,
              basePrice:    variant.basePrice,
              pricePerUnit: variant.pricePerUnit,
              lastVerified: new Date(),
            },
          });
          upsertedVariants++;

          // 3. Upsert prix par enseigne
          for (const [storeId, price] of Object.entries(variant.prices)) {
            const inStock = variant.in_stock?.[storeId] !== false;
            await tx.storePrice.upsert({
              where:  { variantId_storeId: { variantId: dbVariant.id, storeId } },
              create: { variantId: dbVariant.id, storeId, price, inStock },
              update: { price, inStock },
            });
            upsertedPrices++;
          }

          // 4. Upsert promo catalogue (remplace l'existante)
          if (variant.promo) {
            await tx.cataloguePromo.deleteMany({ where: { variantId: dbVariant.id } });
            await tx.cataloguePromo.create({
              data: {
                variantId:  dbVariant.id,
                type:       variant.promo.type,
                value:      variant.promo.value,
                label:      variant.promo.label,
                store:      variant.promo.store,
                minQty:     variant.promo.minQty ?? null,
                validUntil: variant.promo.validUntil
                  ? new Date(variant.promo.validUntil)
                  : null,
              },
            });
          }

          // 5. Upsert cashback statique
          if (variant.cashback) {
            await tx.variantCashback.deleteMany({ where: { variantId: dbVariant.id } });
            await tx.variantCashback.create({
              data: {
                variantId: dbVariant.id,
                app:       variant.cashback.app,
                amount:    variant.cashback.amount,
                label:     variant.cashback.label,
              },
            });
          }
        }
    }); } } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, 'update-prices transaction failed');
      return reply.status(500).send({ error: 'Transaction failed', details: msg });
    }

    return reply.status(200).send({
      ok:              true,
      upsertedGroups,
      upsertedVariants,
      upsertedPrices,
      processedAt:     new Date().toISOString(),
    });
  });

  // ── POST /v1/internal/update-offers ─────────────────────────────────────────
  app.post('/v1/internal/update-offers', async (request, reply) => {
    const parseResult = UpdateOffersBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error:   'Invalid payload',
        details: parseResult.error.flatten(),
      });
    }

    const { offers } = parseResult.data;

    await app.prisma.$transaction(async (tx) => {
      for (const offer of offers) {
        await tx.cashbackOffer.upsert({
          where:  { id: offer.id },
          create: {
            id:              offer.id,
            provider:        offer.provider,
            label:           offer.label,
            amount:          offer.amount,
            eanList:         offer.eanList,
            minQty:          offer.minQty,
            validUntil:      new Date(offer.validUntil),
            deeplinkIos:     offer.deeplinkIos     ?? null,
            deeplinkAndroid: offer.deeplinkAndroid ?? null,
            active:          offer.active,
          },
          update: {
            label:           offer.label,
            amount:          offer.amount,
            eanList:         offer.eanList,
            minQty:          offer.minQty,
            validUntil:      new Date(offer.validUntil),
            deeplinkIos:     offer.deeplinkIos     ?? null,
            deeplinkAndroid: offer.deeplinkAndroid ?? null,
            active:          offer.active,
          },
        });
      }
    });

    return reply.status(200).send({
      ok:          true,
      upserted:    offers.length,
      processedAt: new Date().toISOString(),
    });
  });
}
