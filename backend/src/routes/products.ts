/**
 * GET /v1/products
 *
 * Retourne le catalogue produits complet au format attendu par le mobile.
 * Queries SQL pures via pg — zéro Prisma, zéro binaire natif.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { haversineKm } from '../utils/haversine.js';
import { matchProductWithOffers, filterValidOffers } from '../utils/matchOffers.js';

const QuerySchema = z.object({
  lat:      z.coerce.number().min(-90).max(90).optional(),
  lng:      z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(200).optional().default(20),
});

export async function productsRoutes(app: FastifyInstance) {
  app.get('/v1/products', async (request, reply) => {
    const parseResult = QuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error:   'Invalid query parameters',
        details: parseResult.error.flatten(),
      });
    }

    const { lat, lng, radiusKm } = parseResult.data;
    const hasCoords = lat !== undefined && lng !== undefined;

    // ── Enseignes dans le rayon ─────────────────────────────────────────────
    let nearbyStoreIds: string[] | null = null;

    if (hasCoords) {
      const storeRes = await app.pool.query<{ id: string; lat: number; lng: number }>(
        'SELECT id, lat, lng FROM stores',
      );
      nearbyStoreIds = storeRes.rows
        .filter(s => haversineKm(lat!, lng!, s.lat, s.lng) <= radiusKm)
        .map(s => s.id);

      if (nearbyStoreIds.length === 0) {
        return reply.send({ generated_at: Date.now(), nearbyStoreIds: [], products: [] });
      }
    }

    // ── Offres ODR actives ──────────────────────────────────────────────────
    const offerRes = await app.pool.query<{
      id: string; label: string; ean_list: string[];
      amount: number; min_qty: number; valid_until: Date; active: boolean;
    }>(
      `SELECT id, label, "eanList" AS ean_list, amount, "minQty" AS min_qty, "validUntil" AS valid_until, active
       FROM cashback_offers WHERE active = true AND "validUntil" > NOW()`,
    );

    const validOffers = filterValidOffers(
      offerRes.rows.map(o => ({
        id:        o.id,
        label:     o.label,
        eanList:   o.ean_list,
        amount:    Number(o.amount),
        minQty:    o.min_qty,
        validUntil: new Date(o.valid_until),
        active:    o.active,
      })),
    );

    // ── Groupes produits ────────────────────────────────────────────────────
    const groupRes = await app.pool.query<{
      id: string; generic_name: string; emoji: string; image_url: string | null;
      category_slug: string; subcategory_slug: string; equivalence_key: string;
      unit_size: number; unit_type: string;
    }>('SELECT id, "genericName" AS generic_name, emoji, "imageUrl" AS image_url, "categorySlug" AS category_slug, "subcategorySlug" AS subcategory_slug, "equivalenceKey" AS equivalence_key, "unitSize" AS unit_size, "unitType" AS unit_type FROM product_groups ORDER BY id');

    // ── Variantes ───────────────────────────────────────────────────────────
    const variantRes = await app.pool.query<{
      id: string; group_id: string; ean: string; segment: string; brand: string;
      image_url: string | null; base_price: number; price_per_unit: number;
      unit_ref: string; last_verified: Date;
    }>('SELECT id, "groupId" AS group_id, ean, segment, brand, "imageUrl" AS image_url, "basePrice" AS base_price, "pricePerUnit" AS price_per_unit, "unitRef" AS unit_ref, "lastVerified" AS last_verified FROM product_variants');

    // ── Prix par enseigne ───────────────────────────────────────────────────
    const priceRes = nearbyStoreIds
      ? await app.pool.query<{ variant_id: string; store_id: string; price: number; in_stock: boolean }>(
          'SELECT "variantId" AS variant_id, "storeId" AS store_id, price, "inStock" AS in_stock FROM store_prices WHERE "storeId" = ANY($1)',
          [nearbyStoreIds],
        )
      : await app.pool.query<{ variant_id: string; store_id: string; price: number; in_stock: boolean }>(
          'SELECT "variantId" AS variant_id, "storeId" AS store_id, price, "inStock" AS in_stock FROM store_prices',
        );

    // ── Promos catalogue (une par variante, la plus récente active) ─────────
    const promoRes = await app.pool.query<{
      variant_id: string; type: string; value: number; label: string;
      store: string; min_qty: number | null;
    }>(
      `SELECT DISTINCT ON ("variantId") "variantId" AS variant_id, type, value, label, store, "minQty" AS min_qty
       FROM catalogue_promos
       WHERE "validUntil" IS NULL OR "validUntil" > NOW()
       ORDER BY "variantId", "createdAt" DESC`,
    );

    // ── Cashbacks statiques (un par variante) ───────────────────────────────
    const cashbackRes = await app.pool.query<{
      variant_id: string; app: string; amount: number; label: string;
    }>(
      `SELECT DISTINCT ON ("variantId") "variantId" AS variant_id, app, amount, label
       FROM variant_cashbacks
       ORDER BY "variantId", "createdAt" DESC`,
    );

    // ── Construction des lookup maps ────────────────────────────────────────
    const pricesByVariant = new Map<string, { store_id: string; price: number; in_stock: boolean }[]>();
    for (const p of priceRes.rows) {
      if (!pricesByVariant.has(p.variant_id)) pricesByVariant.set(p.variant_id, []);
      pricesByVariant.get(p.variant_id)!.push(p);
    }

    const promoByVariant   = new Map(promoRes.rows.map(p => [p.variant_id, p]));
    const cashbackByVariant = new Map(cashbackRes.rows.map(c => [c.variant_id, c]));

    const variantsByGroup = new Map<string, typeof variantRes.rows>();
    for (const v of variantRes.rows) {
      if (!variantsByGroup.has(v.group_id)) variantsByGroup.set(v.group_id, []);
      variantsByGroup.get(v.group_id)!.push(v);
    }

    // ── Assemblage ──────────────────────────────────────────────────────────
    const products = groupRes.rows.map(group => {
      const variants: Record<string, unknown> = {};
      const groupVariants = variantsByGroup.get(group.id) ?? [];

      for (const variant of groupVariants) {
        const prices = pricesByVariant.get(variant.id) ?? [];
        if (prices.length === 0) continue;

        const pricesMap:  Record<string, number>  = {};
        const inStockMap: Record<string, boolean> = {};

        for (const sp of prices) {
          pricesMap[sp.store_id] = Number(sp.price);
          if (!sp.in_stock) inStockMap[sp.store_id] = false;
        }

        const promo    = promoByVariant.get(variant.id)    ?? null;
        const cashback = cashbackByVariant.get(variant.id) ?? null;

        const match = matchProductWithOffers(
          variant.ean,
          variant.brand,
          group.generic_name,
          validOffers.map(o => ({
            id:      o.id,
            label:   o.label,
            eanList: o.eanList,
            amount:  o.amount,
            minQty:  o.minQty,
          })),
        );

        variants[variant.segment] = {
          ean:            variant.ean,
          type:           variant.segment,
          brand:          variant.brand,
          basePrice:      Number(variant.base_price),
          prices:         pricesMap,
          price_per_unit: Number(variant.price_per_unit),
          unit_ref:       variant.unit_ref,
          last_verified:  new Date(variant.last_verified).getTime(),
          ...(Object.keys(inStockMap).length > 0 && { in_stock: inStockMap }),
          ...(variant.image_url && { imageUrl: variant.image_url }),
          ...(promo && {
            catalogue_promo: {
              type:  promo.type,
              value: Number(promo.value),
              label: promo.label,
              store: promo.store,
              ...(promo.min_qty !== null && { minQty: promo.min_qty }),
            },
          }),
          ...(cashback && {
            cashback_app: {
              app:    cashback.app,
              amount: Number(cashback.amount),
              label:  cashback.label,
            },
          }),
          ...(match && {
            matched_offer: {
              offerId:   match.offerId,
              score:     match.score,
              matchType: match.matchType,
            },
          }),
        };
      }

      if (Object.keys(variants).length === 0) return null;

      return {
        groupId:         group.id,
        genericName:     group.generic_name,
        emoji:           group.emoji,
        imageUrl:        group.image_url ?? undefined,
        categorySlug:    group.category_slug,
        subcategorySlug: group.subcategory_slug,
        equivalence_key: group.equivalence_key,
        unit_size:       Number(group.unit_size),
        unit_type:       group.unit_type,
        variants,
      };
    }).filter(Boolean);

    return reply.send({
      generated_at:   Date.now(),
      nearbyStoreIds: nearbyStoreIds ?? null,
      products,
    });
  });
}
