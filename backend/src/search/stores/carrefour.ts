/**
 * SmartHunt — Carrefour Drive search adapter
 *
 * ⚠️  CONFIGURATION REQUISE
 * Lance la discovery DevTools sur www.carrefour.fr/courses :
 *  1. DevTools → Réseau → XHR/Fetch
 *  2. Recherche "barilla spaghetti"
 *  3. Copie l'URL + headers + payload de la requête search
 *  4. Remplis SEARCH_URL, DEFAULT_HEADERS et buildPayload() ci-dessous
 *
 * Carrefour utilise probablement Algolia ou une API REST interne.
 */

import type { StoreProduct } from '../index.js';

// ─── Config (à remplir après DevTools) ───────────────────────────────────────

const SEARCH_URL = ''; // TODO: ex "https://www.carrefour.fr/api/v1/search"

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept':     'application/json',
  // TODO: ajouter les headers nécessaires (Authorization, x-api-key, etc.)
};

/** Construit le payload de recherche */
function buildPayload(query: string, storeCode?: string): unknown {
  // TODO: adapter selon ce que DevTools montre
  // Exemple Algolia :
  // return { query, hitsPerPage: 10, filters: `store:${storeCode}` }
  // Exemple REST :
  // return { q: query, store: storeCode, limit: 10 }
  return { query };
}

// ─── Parsing réponse (à adapter selon la vraie réponse) ──────────────────────

interface CarrefourHit {
  // TODO: typer selon la vraie réponse API
  // Exemple Algolia :
  id?:                string;
  objectID?:          string;
  label?:             string;
  name?:              string;
  brandName?:         string;
  brand?:             string;
  price?:             { value?: number; amount?: number };
  priceBeforeDiscount?: number;
  promotionLabel?:    string;
  promotion?:         { label?: string; endDate?: string; discountValue?: number };
  quantity?:          string;
  unit?:              string;
  available?:         boolean;
  inStock?:           boolean;
  images?:            Array<{ url: string }>;
  image?:             string;
  [key: string]:      unknown;
}

function parseHit(hit: CarrefourHit, storeId: string, storeName: string): StoreProduct | null {
  // TODO: adapter selon la vraie structure de réponse
  const name  = hit.label ?? hit.name ?? '';
  const brand = hit.brandName ?? hit.brand ?? '';
  if (!name) return null;

  // Prix
  const price = typeof hit.price === 'object'
    ? (hit.price?.value ?? hit.price?.amount ?? 0)
    : (hit.price as number ?? 0);

  if (!price || price <= 0 || price > 500) return null;

  const originalPrice = hit.priceBeforeDiscount ?? undefined;
  const hasPromo      = !!(originalPrice && originalPrice > price);

  // Promo
  const promoLabel = hit.promotionLabel
    ?? hit.promotion?.label
    ?? (hasPromo ? `-${Math.round((1 - price / originalPrice!) * 100)}%` : undefined);

  const promoEndDate = hit.promotion?.endDate ?? undefined;

  return {
    storeId,
    storeName,
    chain:     'carrefour',
    name,
    brand,
    quantity:  hit.quantity ?? hit.unit ?? '',
    imageUrl:  hit.images?.[0]?.url ?? hit.image ?? undefined,
    price:     Math.round(price * 100) / 100,
    originalPrice: originalPrice ? Math.round(originalPrice * 100) / 100 : undefined,
    inStock:   hit.available ?? hit.inStock ?? true,
    hasPromo,
    promoLabel,
    promoEndDate,
    promoType: hasPromo ? 'percent' : undefined,
    promoValue: hasPromo && originalPrice
      ? Math.round((1 - price / originalPrice) * 100)
      : undefined,
    loyaltyOnly: false,
    confidence: 'high',
  };
}

// ─── Magasins Carrefour Nantes (à compléter avec les vrais IDs) ──────────────

interface CarrefourStore {
  id:        string;    // ID interne SmartHunt
  name:      string;
  storeCode: string;    // code Drive Carrefour (TODO: découvrir via DevTools)
  lat:       number;
  lng:       number;
}

const CARREFOUR_NANTES_STORES: CarrefourStore[] = [
  { id: 'carrefour-nantes-beaulieu',   name: 'Carrefour Nantes Beaulieu',   storeCode: '', lat: 47.2078, lng: -1.5212 },
  { id: 'carrefour-saint-herblain',    name: 'Carrefour Saint-Herblain',    storeCode: '', lat: 47.2201, lng: -1.6189 },
  { id: 'carrefour-sainte-luce',       name: 'Carrefour Sainte-Luce',       storeCode: '', lat: 47.2380, lng: -1.4710 },
  { id: 'carrefour-market-orvault',    name: 'Carrefour Market Orvault',    storeCode: '', lat: 47.2678, lng: -1.6234 },
];

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R  = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dl  = ((lng2 - lng1) * Math.PI) / 180;
  const a   = Math.sin(dL / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Export principal ─────────────────────────────────────────────────────────

export async function carrefourSearch(
  query: string,
  lat?:  number,
  lng?:  number,
): Promise<StoreProduct[]> {
  if (!SEARCH_URL) {
    // Pas encore configuré → retourne vide silencieusement
    return [];
  }

  // Sélectionne les magasins les plus proches
  const stores = CARREFOUR_NANTES_STORES
    .map(s => ({
      ...s,
      distanceKm: lat != null ? distanceKm(lat, lng!, s.lat, s.lng) : 0,
    }))
    .filter(s => lat == null || s.distanceKm <= 20)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 2); // max 2 magasins proches

  const allProducts: StoreProduct[] = [];

  for (const store of stores) {
    try {
      const isPost = true; // TODO: adapter si GET

      const res = await fetch(SEARCH_URL, {
        method:  isPost ? 'POST' : 'GET',
        headers: DEFAULT_HEADERS,
        body:    isPost ? JSON.stringify(buildPayload(query, store.storeCode)) : undefined,
      });

      if (!res.ok) continue;

      const data = await res.json() as { hits?: CarrefourHit[]; products?: CarrefourHit[]; results?: CarrefourHit[]; [k: string]: unknown };

      // TODO: adapter selon la vraie structure (hits / products / results / items…)
      const hits: CarrefourHit[] = data.hits ?? data.products ?? data.results ?? [];

      for (const hit of hits.slice(0, 5)) {
        const product = parseHit(hit, store.id, store.name);
        if (product) {
          allProducts.push({ ...product, distanceKm: store.distanceKm });
        }
      }

    } catch { /* timeout ou erreur réseau → ignoré */ }
  }

  return allProducts;
}
