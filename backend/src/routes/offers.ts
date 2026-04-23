/**
 * GET /v1/offers
 *
 * Retourne toutes les offres ODR externes actives et non expirées.
 * Format attendu par ExternalCashbackOffer (engine/matchOffers.ts).
 *
 * Réponse :
 *   {
 *     generated_at: number    Timestamp ms
 *     offers:       ExternalCashbackOffer[]
 *   }
 */

import { FastifyInstance } from 'fastify';

export async function offersRoutes(app: FastifyInstance) {
  app.get('/v1/offers', async (_request, reply) => {
    const now = new Date();

    const offers = await app.prisma.cashbackOffer.findMany({
      where:   { active: true, validUntil: { gt: now } },
      orderBy: { amount: 'desc' },
    });

    // Format attendu par ExternalCashbackOffer (engine/matchOffers.ts mobile)
    const serialized = offers.map(o => ({
      id:              o.id,
      provider:        o.provider,          // "shopmium" | "quoty" | "coupon_network"
      label:           o.label,
      amount:          o.amount,
      eanList:         o.eanList,
      minQty:          o.minQty,
      validUntil:      o.validUntil.getTime(),   // timestamp ms (number)
      deeplinkIos:     o.deeplinkIos  ?? null,
      deeplinkAndroid: o.deeplinkAndroid ?? null,
    }));

    return reply.send({
      generated_at: Date.now(),
      offers:       serialized,
    });
  });
}
