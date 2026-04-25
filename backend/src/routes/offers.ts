/**
 * GET /v1/offers
 */

import { FastifyInstance } from 'fastify';

export async function offersRoutes(app: FastifyInstance) {
  app.get('/v1/offers', async (_request, reply) => {
    const result = await app.pool.query<{
      id:               string;
      provider:         string;
      label:            string;
      amount:           number;
      ean_list:         string[];
      min_qty:          number;
      valid_until:      Date;
      deeplink_ios:     string | null;
      deeplink_android: string | null;
    }>(
      `SELECT id, provider, label, amount, "eanList" AS ean_list, "minQty" AS min_qty, "validUntil" AS valid_until,
              "deeplinkIos" AS deeplink_ios, "deeplinkAndroid" AS deeplink_android
       FROM cashback_offers
       WHERE active = true AND "validUntil" > NOW()
       ORDER BY amount DESC`,
    );

    const offers = result.rows.map(o => ({
      id:              o.id,
      provider:        o.provider,
      label:           o.label,
      amount:          Number(o.amount),
      eanList:         o.ean_list,
      minQty:          o.min_qty,
      validUntil:      new Date(o.valid_until).getTime(),
      deeplinkIos:     o.deeplink_ios     ?? null,
      deeplinkAndroid: o.deeplink_android ?? null,
    }));

    return reply.send({
      generated_at: Date.now(),
      offers,
    });
  });
}
