/**
 * GET /v1/stores/nearby
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { haversineKm } from '../utils/haversine.js';

const QuerySchema = z.object({
  lat:       z.coerce.number().min(-90).max(90),
  lng:       z.coerce.number().min(-180).max(180),
  radius_km: z.coerce.number().min(1).max(200).optional().default(20),
});

export async function storesRoutes(app: FastifyInstance) {
  app.get('/v1/stores/nearby', async (request, reply) => {
    const parseResult = QuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error:   'lat and lng are required',
        details: parseResult.error.flatten(),
      });
    }

    const { lat, lng, radius_km } = parseResult.data;

    const result = await app.pool.query<{ id: string; lat: number; lng: number }>(
      'SELECT id, lat, lng FROM stores',
    );

    const store_ids = result.rows
      .filter(s => haversineKm(lat, lng, s.lat, s.lng) <= radius_km)
      .map(s => s.id);

    return reply.send({
      generated_at: Date.now(),
      store_ids,
    });
  });
}
