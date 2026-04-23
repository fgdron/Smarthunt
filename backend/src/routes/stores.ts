/**
 * GET /v1/stores/nearby
 *
 * Retourne les IDs des enseignes situées dans un rayon donné.
 * Appelé séparément par fetchNearbyStores() dans services/api.ts.
 *
 * Query params :
 *   lat        Float  Latitude utilisateur
 *   lng        Float  Longitude utilisateur
 *   radius_km  Float  (optionnel, défaut 20) Rayon en km
 *
 * Réponse :
 *   {
 *     store_ids:    string[]   — IDs des enseignes dans le rayon
 *     generated_at: number     — timestamp ms
 *   }
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { haversineKm } from '../utils/haversine.js';

// ─── Validation ───────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  lat:       z.coerce.number().min(-90).max(90),
  lng:       z.coerce.number().min(-180).max(180),
  radius_km: z.coerce.number().min(1).max(200).optional().default(20),
});

// ─── Route ────────────────────────────────────────────────────────────────────

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

    const stores = await app.prisma.store.findMany({
      select: { id: true, lat: true, lng: true },
    });

    const store_ids = stores
      .filter(s => haversineKm(lat, lng, s.lat, s.lng) <= radius_km)
      .map(s => s.id);

    return reply.send({
      generated_at: Date.now(),
      store_ids,
    });
  });
}
