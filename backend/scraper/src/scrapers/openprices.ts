/**
 * Scraper Open Food Facts — Open Prices API
 * https://prices.openfoodfacts.org/api/v1/
 *
 * Stratégie :
 *  1. Recherche les locations OSM correspondant aux enseignes Nantes
 *  2. Pour chaque location, récupère les prix (paginé, max 200 par page)
 *  3. Détecte les promos (price_is_discounted + price_without_discount)
 *  4. Retourne un tableau de StorePriceEntry prêt à pusher
 *
 * Respecte un rate limit conservateur (1 req/s) pour ne pas abuser de l'API publique.
 */

import { NANTES_STORES, NantesStore } from '../stores/nantes.js';

const BASE_URL  = 'https://prices.openfoodfacts.org/api/v1';
const PAGE_SIZE = 200;
const DELAY_MS  = 1000;  // 1s entre chaque requête

// ─── Types API Open Prices ────────────────────────────────────────────────────

interface OPLocation {
  id:             number;
  osm_id:         number;
  osm_type:       string;
  name:           string | null;
  city:           string | null;
  country:        string | null;
  price_count:    number;
}

interface OPPrice {
  product_code:          string | null;    // EAN
  price:                 number;
  price_is_discounted:   boolean;
  price_without_discount: number | null;
  location:              { osm_id: number; osm_type: string; name: string | null } | null;
  date:                  string;           // ISO date
}

interface OPPricesResponse {
  items:    OPPrice[];
  page:     number;
  page_size: number;
  total:    number;
}

interface OPLocationsResponse {
  items: OPLocation[];
  total: number;
}

// ─── Résultat normalisé ───────────────────────────────────────────────────────

export interface StorePriceEntry {
  ean:             string;
  storeId:         string;   // notre ID interne (ex: "leclerc-saint-herblain")
  price:           number;
  inStock:         boolean;
  promoType?:      'percent' | 'immediate';
  promoValue?:     number;
  promoLabel?:     string;
  promoValidUntil?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'SmartHunt-Scraper/1.0 (contact@smarthunt.app)',
      'Accept':     'application/json',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json() as Promise<T>;
}

/**
 * Trouve l'ID Open Prices d'un magasin via son OSM ID.
 * Retourne null si non trouvé (magasin pas encore dans la base Open Prices).
 */
async function findLocationId(store: NantesStore): Promise<number | null> {
  if (!store.osmId) return null;
  try {
    const url = `${BASE_URL}/locations?osm_id=${store.osmId}&osm_type=${store.osmType ?? 'node'}`;
    const data = await fetchJSON<OPLocationsResponse>(url);
    return data.items[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Fallback : recherche par nom + ville si l'OSM ID n'est pas dans Open Prices.
 */
async function searchLocation(store: NantesStore): Promise<number | null> {
  try {
    const q = encodeURIComponent(store.name);
    const url = `${BASE_URL}/locations?search=${q}&country=en:france&page_size=5`;
    const data = await fetchJSON<OPLocationsResponse>(url);
    // Prend la première location dont le nom contient le nom de l'enseigne
    const chain = store.chain === 'leclerc' ? 'leclerc'
                : store.chain === 'carrefour' ? 'carrefour'
                : 'lidl';
    const match = data.items.find(l =>
      l.name?.toLowerCase().includes(chain) &&
      (l.city?.toLowerCase().includes('nantes') ||
       l.city?.toLowerCase().includes('saint-herblain') ||
       l.city?.toLowerCase().includes('rezé') ||
       l.city?.toLowerCase().includes('orvault') ||
       l.city?.toLowerCase().includes('carquefou')),
    );
    return match?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Récupère tous les prix d'une location Open Prices (paginé).
 */
async function fetchPricesForLocation(
  locationId: number,
  store: NantesStore,
): Promise<StorePriceEntry[]> {
  const entries: StorePriceEntry[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    await sleep(DELAY_MS);
    const url = `${BASE_URL}/prices?location_id=${locationId}&page=${page}&page_size=${PAGE_SIZE}`;

    let data: OPPricesResponse;
    try {
      data = await fetchJSON<OPPricesResponse>(url);
    } catch (err) {
      console.warn(`  ⚠️  Erreur fetch page ${page} pour ${store.name}:`, err);
      break;
    }

    totalPages = Math.ceil(data.total / PAGE_SIZE);

    for (const item of data.items) {
      if (!item.product_code) continue;                          // pas d'EAN → skip
      if (item.price <= 0 || item.price > 500) continue;        // prix aberrant

      const entry: StorePriceEntry = {
        ean:     item.product_code,
        storeId: store.id,
        price:   item.price,
        inStock: true,
      };

      // Détection promo
      if (item.price_is_discounted && item.price_without_discount && item.price_without_discount > item.price) {
        const savings = item.price_without_discount - item.price;
        const pct     = Math.round((savings / item.price_without_discount) * 100);

        if (pct >= 5 && pct <= 90) {
          // On préfère le % si remise ≥ 10%, sinon montant immédiat
          if (pct >= 10) {
            entry.promoType  = 'percent';
            entry.promoValue = pct;
            entry.promoLabel = `-${pct}% cette semaine`;
          } else {
            entry.promoType  = 'immediate';
            entry.promoValue = Math.round(savings * 100) / 100;
            entry.promoLabel = `-${savings.toFixed(2)} € cette semaine`;
          }
          // Les prix Open Prices n'ont pas de date de fin → on pose fin de semaine
          const nextSunday = new Date();
          nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()));
          nextSunday.setHours(23, 59, 59, 0);
          entry.promoValidUntil = nextSunday.toISOString();
        }
      }

      entries.push(entry);
    }

    console.log(`  📄 ${store.name} — page ${page}/${totalPages} (${data.items.length} prix)`);
    page++;
  } while (page <= totalPages && page <= 10); // max 10 pages = 2000 prix par magasin

  return entries;
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Lance le scraper Open Prices pour tous les magasins Nantes Métropole.
 * Retourne les entrées prix groupées par magasin.
 */
export async function scrapeOpenPrices(
  chains: Array<'leclerc' | 'carrefour' | 'lidl'> = ['leclerc', 'carrefour', 'lidl'],
): Promise<StorePriceEntry[]> {
  const stores   = NANTES_STORES.filter(s => chains.includes(s.chain));
  const allEntries: StorePriceEntry[] = [];

  console.log(`\n🔍 Open Prices — ${stores.length} magasins à scraper`);

  for (const store of stores) {
    console.log(`\n📍 ${store.name}`);

    // 1. Trouve l'ID location Open Prices
    let locationId = await findLocationId(store);
    await sleep(DELAY_MS);

    if (!locationId) {
      console.log(`  ⚠️  OSM ID non trouvé, tentative par nom…`);
      locationId = await searchLocation(store);
      await sleep(DELAY_MS);
    }

    if (!locationId) {
      console.log(`  ❌ Magasin non référencé dans Open Prices — skip`);
      continue;
    }

    console.log(`  ✅ Location ID: ${locationId}`);

    // 2. Récupère les prix
    const entries = await fetchPricesForLocation(locationId, store);
    console.log(`  ✓ ${entries.length} prix récupérés (dont ${entries.filter(e => e.promoType).length} promos)`);

    allEntries.push(...entries);
  }

  // Déduplique : garde le prix le plus récent par (ean, storeId)
  const deduped = new Map<string, StorePriceEntry>();
  for (const e of allEntries) {
    deduped.set(`${e.ean}::${e.storeId}`, e);
  }

  console.log(`\n✅ Open Prices total : ${deduped.size} prix uniques`);
  return [...deduped.values()];
}
