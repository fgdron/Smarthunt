/**
 * SmartHunt — Routes Basket Optimizer
 *
 * POST /v1/basket/parse-screenshot
 *   Envoie une capture d'écran (base64) à Claude Vision.
 *   Retourne la liste des produits extraits.
 *
 * POST /v1/basket/optimize
 *   Prend une liste de produits + coordonnées GPS.
 *   Retourne 4 stratégies d'optimisation avec économies.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedProduct {
  name:        string;   // ex: "Barilla Spaghetti"
  brand:       string;   // ex: "Barilla"
  quantity:    number;   // nb d'unités dans le panier
  unit_price:  number;   // prix unitaire (€)
  total_price: number;   // prix total = qty × unit_price
  unit:        string;   // ex: "500g", "1L", "×8"
}

interface Strategy {
  id:          string;
  title:       string;
  description: string;
  total:       number;        // coût total (€)
  savings:     number;        // économie vs panier original
  savings_pct: number;        // % d'économie
  items:       StrategyItem[];
  stores:      string[];      // IDs des magasins impliqués
}

interface StrategyItem {
  original_name:  string;
  matched_name:   string;
  original_price: number;
  best_price:     number;
  savings:        number;
  store_id:       string;
  store_name:     string;
  is_mdd:         boolean;
  promo_label?:   string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Distance en km entre deux points GPS (Haversine) */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R  = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dl  = ((lng2 - lng1) * Math.PI) / 180;
  const a   = Math.sin(dL / 2) ** 2 +
              Math.cos((lat1 * Math.PI) / 180) *
              Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Similarité basique entre deux chaînes (0–1) */
function similarity(a: string, b: string): number {
  const na = a.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const nb = b.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const wa  = new Set(na.split(/\s+/).filter(w => w.length > 2));
  const wb  = new Set(nb.split(/\s+/).filter(w => w.length > 2));
  const inter = [...wa].filter(w => wb.has(w)).length;
  return inter / Math.max(wa.size, wb.size, 1);
}

// ─── Parse screenshot ─────────────────────────────────────────────────────────

async function parseScreenshot(base64Image: string, mimeType: string): Promise<ParsedProduct[]> {
  const message = await anthropic.messages.create({
    model:      'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{
      role:    'user',
      content: [
        {
          type:   'image',
          source: {
            type:       'base64',
            media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
            data:        base64Image,
          },
        },
        {
          type: 'text',
          text: `Cette image est une capture d'écran d'une application de courses en ligne (Leclerc Drive, Carrefour, Intermarché, etc.).

Extrais la liste complète des produits visibles dans le panier.

Réponds UNIQUEMENT avec un JSON valide, sans texte avant ou après. Format exact :
[
  {
    "name": "nom complet du produit",
    "brand": "marque (vide si non visible)",
    "quantity": 1,
    "unit_price": 2.99,
    "total_price": 2.99,
    "unit": "format/taille ex: 500g, 1L, x4"
  }
]

Si un champ n'est pas visible, utilise une valeur par défaut (0 pour les prix, "" pour les textes).
Ne mets aucun commentaire, uniquement le JSON.`,
        },
      ],
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';

  // Extrait le JSON de la réponse (Claude peut entourer de backticks)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  return JSON.parse(jsonMatch[0]) as ParsedProduct[];
}

// ─── Optimization engine ───────────────────────────────────────────────────────

interface StoreRow {
  id: string; name: string; chain: string; lat: number; lng: number;
}

interface PriceRow {
  ean: string; store_id: string; price: number; in_stock: boolean;
  promo_type?: string; promo_value?: number; promo_label?: string;
  variant_name: string; variant_brand: string; is_mdd: boolean;
}

async function runOptimization(
  pool:       import('pg').Pool,
  products:   ParsedProduct[],
  lat?:       number,
  lng?:       number,
  radiusKm    = 15,
  maxStores   = 3,
): Promise<{ strategies: Strategy[]; originalTotal: number }> {

  // 1. Récupère les magasins proches
  const allStores = await pool.query<StoreRow>(`
    SELECT id, name, chain, lat, lng FROM stores
  `);

  const nearbyStores = lat != null && lng != null
    ? allStores.rows.filter(s => distanceKm(lat, lng, s.lat, s.lng) <= radiusKm)
    : allStores.rows;

  const storeIds   = nearbyStores.map(s => s.id);
  const storeById  = Object.fromEntries(nearbyStores.map(s => [s.id, s]));

  if (storeIds.length === 0) {
    return { strategies: [], originalTotal: 0 };
  }

  // 2. Pour chaque produit, cherche les prix dans les magasins proches
  const enriched: Array<{
    product:   ParsedProduct;
    prices:    PriceRow[];
  }> = [];

  for (const product of products) {
    const searchTerm = `%${product.name.toLowerCase().replace(/\s+/g, '%')}%`;

    const rows = await pool.query<PriceRow>(`
      SELECT
        sp.ean,
        sp.store_id,
        sp.price,
        sp.in_stock,
        sp.promo_type,
        sp.promo_value,
        sp.promo_label,
        v.name  AS variant_name,
        v.brand AS variant_brand,
        (v.brand ILIKE '%repère%' OR v.brand ILIKE '%monoprix%' OR
         v.brand ILIKE '%carrefour%' OR v.name ILIKE '%leclerc%' OR
         v.brand ILIKE '%lidl%' OR v.brand ILIKE '%aldi%'
        ) AS is_mdd
      FROM store_prices sp
      JOIN variants v ON v.ean = sp.ean
      WHERE sp.store_id = ANY($1)
        AND sp.in_stock = true
        AND sp.price > 0
        AND (
          LOWER(v.name)  LIKE $2
          OR LOWER(v.brand || ' ' || v.name) LIKE $2
        )
      ORDER BY sp.price ASC
      LIMIT 20
    `, [storeIds, searchTerm]);

    enriched.push({ product, prices: rows.rows });
  }

  // Total original (prix du panier importé)
  const originalTotal = products.reduce((s, p) => s + (p.total_price || p.unit_price * p.quantity), 0);

  // ── Stratégie 1 : Meilleur prix par produit (multi-magasins) ──────────────
  const strategy1Items: StrategyItem[] = [];
  let s1Total = 0;
  const s1Stores = new Set<string>();

  for (const { product, prices } of enriched) {
    if (prices.length === 0) {
      s1Total += product.total_price || product.unit_price * product.quantity;
      continue;
    }
    const best  = prices[0];
    const store = storeById[best.store_id];
    const orig  = product.unit_price * product.quantity;
    const cost  = best.price * product.quantity;
    s1Total    += cost;
    s1Stores.add(best.store_id);
    strategy1Items.push({
      original_name:  product.name,
      matched_name:   best.variant_name,
      original_price: orig,
      best_price:     cost,
      savings:        Math.max(0, orig - cost),
      store_id:       best.store_id,
      store_name:     store?.name ?? best.store_id,
      is_mdd:         best.is_mdd,
      promo_label:    best.promo_label,
    });
  }

  // ── Stratégie 2 : Meilleur magasin unique ─────────────────────────────────
  const storesTotals: Record<string, number> = {};
  const storesItems:  Record<string, StrategyItem[]> = {};

  for (const storeId of storeIds) {
    let total = 0;
    const items: StrategyItem[] = [];
    const store = storeById[storeId];

    for (const { product, prices } of enriched) {
      const storePrice = prices.find(p => p.store_id === storeId);
      const orig = product.unit_price * product.quantity;

      if (storePrice) {
        const cost = storePrice.price * product.quantity;
        total += cost;
        items.push({
          original_name:  product.name,
          matched_name:   storePrice.variant_name,
          original_price: orig,
          best_price:     cost,
          savings:        Math.max(0, orig - cost),
          store_id:       storeId,
          store_name:     store?.name ?? storeId,
          is_mdd:         storePrice.is_mdd,
          promo_label:    storePrice.promo_label,
        });
      } else {
        total += orig; // produit non trouvé → prix original
        items.push({
          original_name:  product.name,
          matched_name:   product.name,
          original_price: orig,
          best_price:     orig,
          savings:        0,
          store_id:       storeId,
          store_name:     store?.name ?? storeId,
          is_mdd:         false,
        });
      }
    }
    storesTotals[storeId] = total;
    storesItems[storeId]  = items;
  }

  const bestStoreId    = Object.entries(storesTotals).sort((a, b) => a[1] - b[1])[0]?.[0];
  const s2Total        = bestStoreId ? storesTotals[bestStoreId] : originalTotal;
  const strategy2Items = bestStoreId ? storesItems[bestStoreId] : [];

  // ── Stratégie 3 : Marques Repères (MDD) ───────────────────────────────────
  const strategy3Items: StrategyItem[] = [];
  let s3Total = 0;
  const s3Stores = new Set<string>();

  for (const { product, prices } of enriched) {
    const mddPrices = prices.filter(p => p.is_mdd);
    const orig = product.unit_price * product.quantity;

    if (mddPrices.length > 0) {
      const best  = mddPrices[0];
      const store = storeById[best.store_id];
      const cost  = best.price * product.quantity;
      s3Total    += cost;
      s3Stores.add(best.store_id);
      strategy3Items.push({
        original_name:  product.name,
        matched_name:   best.variant_name,
        original_price: orig,
        best_price:     cost,
        savings:        Math.max(0, orig - cost),
        store_id:       best.store_id,
        store_name:     store?.name ?? best.store_id,
        is_mdd:         true,
        promo_label:    best.promo_label,
      });
    } else {
      // Pas de MDD trouvé → garde le prix original
      s3Total += orig;
    }
  }

  // ── Stratégie 4 : Promos actuelles ───────────────────────────────────────
  const strategy4Items: StrategyItem[] = [];
  let s4Total = 0;
  const s4Stores = new Set<string>();

  for (const { product, prices } of enriched) {
    const promoPrices = prices.filter(p => p.promo_type && p.promo_value);
    const allPrices   = [...promoPrices, ...prices.filter(p => !p.promo_type)];
    const orig        = product.unit_price * product.quantity;

    if (allPrices.length > 0) {
      const best  = allPrices[0];
      const store = storeById[best.store_id];
      const cost  = best.price * product.quantity;
      s4Total    += cost;
      s4Stores.add(best.store_id);
      strategy4Items.push({
        original_name:  product.name,
        matched_name:   best.variant_name,
        original_price: orig,
        best_price:     cost,
        savings:        Math.max(0, orig - cost),
        store_id:       best.store_id,
        store_name:     store?.name ?? best.store_id,
        is_mdd:         best.is_mdd,
        promo_label:    best.promo_label,
      });
    } else {
      s4Total += orig;
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;

  const strategies: Strategy[] = [
    {
      id:          'best-price',
      title:       'Meilleur prix par produit',
      description: `Répartit les achats sur ${Math.min(s1Stores.size, maxStores)} magasin(s) pour le prix le plus bas sur chaque article`,
      total:       round(s1Total),
      savings:     round(Math.max(0, originalTotal - s1Total)),
      savings_pct: originalTotal > 0 ? round(Math.max(0, (originalTotal - s1Total) / originalTotal * 100)) : 0,
      items:       strategy1Items,
      stores:      [...s1Stores],
    },
    {
      id:          'best-store',
      title:       'Meilleur magasin unique',
      description: 'Tout dans un seul magasin au meilleur rapport global',
      total:       round(s2Total),
      savings:     round(Math.max(0, originalTotal - s2Total)),
      savings_pct: originalTotal > 0 ? round(Math.max(0, (originalTotal - s2Total) / originalTotal * 100)) : 0,
      items:       strategy2Items,
      stores:      bestStoreId ? [bestStoreId] : [],
    },
    {
      id:          'mdd',
      title:       'Marques Repères',
      description: 'Remplace les grandes marques par leurs équivalents MDD',
      total:       round(s3Total),
      savings:     round(Math.max(0, originalTotal - s3Total)),
      savings_pct: originalTotal > 0 ? round(Math.max(0, (originalTotal - s3Total) / originalTotal * 100)) : 0,
      items:       strategy3Items,
      stores:      [...s3Stores],
    },
    {
      id:          'promos',
      title:       'Promos du moment',
      description: 'Profite des promotions en cours dans les magasins proches',
      total:       round(s4Total),
      savings:     round(Math.max(0, originalTotal - s4Total)),
      savings_pct: originalTotal > 0 ? round(Math.max(0, (originalTotal - s4Total) / originalTotal * 100)) : 0,
      items:       strategy4Items,
      stores:      [...s4Stores],
    },
  ].sort((a, b) => b.savings - a.savings);

  return { strategies, originalTotal: round(originalTotal) };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function basketRoutes(app: FastifyInstance) {

  // Augmente la limite de body pour les images base64
  app.addContentTypeParser('application/json', { bodyLimit: 10 * 1024 * 1024 }, app.getDefaultJsonParser('ignore', 'ignore'));

  /**
   * POST /v1/basket/parse-screenshot
   * Body : { image: string (base64), mimeType: string }
   */
  app.post('/v1/basket/parse-screenshot', async (
    req: FastifyRequest<{ Body: { image: string; mimeType: string } }>,
    reply: FastifyReply,
  ) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      return reply.status(503).send({ error: 'ANTHROPIC_API_KEY non configurée' });
    }

    const { image, mimeType } = req.body;
    if (!image || !mimeType) {
      return reply.status(400).send({ error: 'image et mimeType requis' });
    }

    try {
      const products = await parseScreenshot(image, mimeType);
      return { products, count: products.length };
    } catch (err) {
      app.log.error(err, 'Erreur parse-screenshot');
      return reply.status(500).send({ error: 'Impossible de lire la capture d\'écran' });
    }
  });

  /**
   * POST /v1/basket/optimize
   * Body : { products: ParsedProduct[], lat?: number, lng?: number, radiusKm?: number, maxStores?: number }
   */
  app.post('/v1/basket/optimize', async (
    req: FastifyRequest<{
      Body: {
        products:   ParsedProduct[];
        lat?:       number;
        lng?:       number;
        radiusKm?:  number;
        maxStores?: number;
      };
    }>,
    reply: FastifyReply,
  ) => {
    const { products, lat, lng, radiusKm = 15, maxStores = 3 } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return reply.status(400).send({ error: 'products requis (tableau non vide)' });
    }

    try {
      const result = await runOptimization(app.pool, products, lat, lng, radiusKm, maxStores);
      return result;
    } catch (err) {
      app.log.error(err, 'Erreur optimize');
      return reply.status(500).send({ error: 'Erreur lors de l\'optimisation' });
    }
  });
}
