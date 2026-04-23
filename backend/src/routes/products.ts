/**
 * GET /v1/products
 *
 * Retourne le catalogue produits complet au format attendu par le mobile
 * (types ProductGroup / ProductVariant de data/productsDB.ts).
 *
 * Query params :
 *   lat       Float  (optionnel) Latitude utilisateur
 *   lng       Float  (optionnel) Longitude utilisateur
 *   radiusKm  Float  (optionnel, défaut 20) Rayon en km
 *
 * Réponse :
 *   {
 *     products:       ProductGroup[]   — catalogue complet (filtré GPS si coords)
 *     nearbyStoreIds: string[] | null  — enseignes dans le rayon (null si pas de GPS)
 *     generated_at:   number           — timestamp ms du fetch
 *   }
 *
 * Chaque variante inclut en bonus `matched_offer` (offre ODR pré-matchée Jaccard).
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { haversineKm } from '../utils/haversine.js';
import { matchProductWithOffers, filterValidOffers } from '../utils/matchOffers.js';

// ─── Validation query params ─────────────────────────────────────────────────

const QuerySchema = z.object({
  lat:      z.coerce.number().min(-90).max(90).optional(),
  lng:      z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(200).optional().default(20),
});

// ─── Route ───────────────────────────────────────────────────────────────────

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

    // ── Déterminer les enseignes dans le rayon ───────────────────────────────
    let nearbyStoreIds: string[] | null = null;

    if (hasCoords) {
      const stores = await app.prisma.store.findMany({
        select: { id: true, lat: true, lng: true },
      });
      nearbyStoreIds = stores
        .filter(s => haversineKm(lat!, lng!, s.lat, s.lng) <= radiusKm)
        .map(s => s.id);

      if (nearbyStoreIds.length === 0) {
        return reply.send({
          generated_at:   Date.now(),
          nearbyStoreIds: [],
          products:       [],
        });
      }
    }

    // ── Offres ODR actives (pour pre-matching Jaccard) ───────────────────────
    const now = new Date();
    const rawOffers = await app.prisma.cashbackOffer.findMany({
      where: { active: true, validUntil: { gt: now } },
    });
    const validOffers = filterValidOffers(rawOffers);

    // ── Charger groupes + variantes + prix + promos + cashbacks ──────────────
    const groups = await app.prisma.productGroup.findMany({
      include: {
        variants: {
          include: {
            prices:    { include: { store: { select: { id: true } } } },
            promos:    {
              where: {
                OR: [{ validUntil: null }, { validUntil: { gt: now } }],
              },
            },
            cashbacks: true,
          },
        },
      },
    });

    // ── Sérialisation au format ProductGroup (mobile) ────────────────────────

    const products = groups.map(group => {
      const variants: Record<string, unknown> = {};

      for (const variant of group.variants) {
        // Filtrer les prix sur les enseignes proches si GPS fourni
        const relevantPrices = nearbyStoreIds
          ? variant.prices.filter(p => nearbyStoreIds!.includes(p.storeId))
          : variant.prices;

        const pricesMap: Record<string, number> = {};
        const inStockMap: Record<string, boolean> = {};

        for (const sp of relevantPrices) {
          pricesMap[sp.storeId] = sp.price;
          if (!sp.inStock) inStockMap[sp.storeId] = false;
        }

        // Variante sans prix disponible dans le rayon → on la saute
        if (Object.keys(pricesMap).length === 0) continue;

        // Promo catalogue (unique — prend la première active)
        const promo    = variant.promos[0]    ?? null;
        const cashback = variant.cashbacks[0] ?? null;

        // Pre-matching ODR (Jaccard serveur)
        const match = matchProductWithOffers(
          variant.ean,
          variant.brand,
          group.genericName,
          validOffers.map(o => ({
            id:      o.id,
            label:   o.label,
            eanList: o.eanList,
            amount:  o.amount,
            minQty:  o.minQty,
          })),
        );

        // Format attendu par ProductVariant (data/productsDB.ts)
        variants[variant.segment] = {
          ean:            variant.ean,
          type:           variant.segment,       // alias — mobile utilise .type
          brand:          variant.brand,
          basePrice:      variant.basePrice,
          prices:         pricesMap,
          price_per_unit: variant.pricePerUnit,
          unit_ref:       variant.unitRef,
          last_verified:  variant.lastVerified.getTime(),
          ...(Object.keys(inStockMap).length > 0 && { in_stock: inStockMap }),
          ...(variant.imageUrl && { imageUrl: variant.imageUrl }),
          ...(promo && {
            catalogue_promo: {
              type:     promo.type,
              value:    promo.value,
              label:    promo.label,
              store:    promo.store,
              ...(promo.minQty !== null && { minQty: promo.minQty }),
            },
          }),
          ...(cashback && {
            cashback_app: {
              app:    cashback.app,              // "shopmium" | "quoty" | "coupon_network"
              amount: cashback.amount,
              label:  cashback.label,
            },
          }),
          // Bonus serveur — non typé côté mobile mais ignoré sans erreur
          ...(match && {
            matched_offer: {
              offerId:   match.offerId,
              score:     match.score,
              matchType: match.matchType,
            },
          }),
        };
      }

      // Groupe sans aucune variante disponible → on le saute
      if (Object.keys(variants).length === 0) return null;

      // Format attendu par ProductGroup (data/productsDB.ts)
      return {
        groupId:         group.id,
        genericName:     group.genericName,
        emoji:           group.emoji,
        imageUrl:        group.imageUrl ?? undefined,
        categorySlug:    group.categorySlug,
        subcategorySlug: group.subcategorySlug,
        equivalence_key: group.equivalenceKey,
        unit_size:       group.unitSize,
        unit_type:       group.unitType,
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
