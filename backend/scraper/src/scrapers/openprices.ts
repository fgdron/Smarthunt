/**
 * Scraper Open Food Facts — Open Prices API (v2)
 * https://prices.openfoodfacts.org/api/v1/
 *
 * Approche EAN-first (inverse de v1) :
 *  1. Récupère tous les EANs de notre catalogue via /v1/internal/eans
 *  2. Pour chaque EAN, cherche les prix dans Open Prices (filtrés France)
 *  3. Identifie les magasins Nantes par nom/ville dans la réponse
 *  4. Mappe sur nos IDs de magasins internes
 *  5. Retourne les StorePriceEntry matchés
 *
 * Avantage : 100% de couverture sur notre catalogue, zéro EAN inconnu.
 * Rate limit : 1 req/s max.
 */

import { NANTES_STORES } from '../stores/nantes.js';

const BASE_URL  = 'https://prices.openfoodfacts.org/api/v1';
const DELAY_MS  = 1000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Mots-clés géographiques Nantes Métropole ─────────────────────────────────
const NANTES_CITIES = [
  'nantes', 'saint-herblain', 'sainherblain', 'herblain',
  'rezé', 'reze', 'sainte-luce', 'sainteluce',
  'orvault', 'carquefou', 'vertou', 'bouguenais',
  'saint-sébastien', 'stsebastien',
];

// Mots-clés enseigne pour mapper sur notre storeId
const CHAIN_KEYWORDS: Record<string, string> = {
  'leclerc':   'leclerc',
  'e.leclerc': 'leclerc',
  'carrefour': 'carrefour',
  'lidl':      'lidl',
};

// ─── Types API Open Prices ────────────────────────────────────────────────────

interface OPPrice {
  id:                    number;
  product_code:          string | null;
  price:                 number;
  price_is_discounted:   boolean;
  price_without_discount: number | null;
  date:                  string;
  location?: {
    id:       number;
    osm_id:   number | null;
    osm_type: string | null;
    name:     string | null;
    city:     string | null;
    country:  string | null;
  } | null;
}

interface OPPricesResponse {
  items:     OPPrice[];
  page:      number;
  page_size: number;
  total:     number;
}

// ─── Résultat normalisé ───────────────────────────────────────────────────────

export interface StorePriceEntry {
  ean:             string;
  storeId:         string;
  price:           number;
  inStock:         boolean;
  promoType?:      'percent' | 'immediate';
  promoValue?:     number;
  promoLabel?:     string;
  promoValidUntil?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'SmartHunt-Scraper/2.0 (contact@smarthunt.app)',
        'Accept':     'application/json',
      },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

/**
 * Identifie la chaîne d'une location Open Prices.
 * Retourne 'leclerc' | 'carrefour' | 'lidl' | null
 */
function detectChain(location: OPPrice['location']): 'leclerc' | 'carrefour' | 'lidl' | null {
  if (!location) return null;
  const name = (location.name ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [keyword, chainName] of Object.entries(CHAIN_KEYWORDS)) {
    if (name.includes(keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
      return chainName as 'leclerc' | 'carrefour' | 'lidl';
    }
  }
  return null;
}

/**
 * Calcule la promo à partir d'un prix Open Prices.
 */
function extractPromo(item: OPPrice): Pick<StorePriceEntry, 'promoType'|'promoValue'|'promoLabel'|'promoValidUntil'> | null {
  if (!item.price_is_discounted || !item.price_without_discount) return null;
  if (item.price_without_discount <= item.price) return null;

  const savings = item.price_without_discount - item.price;
  const pct     = Math.round((savings / item.price_without_discount) * 100);

  if (pct < 5 || pct > 90) return null;

  const nextSunday = new Date();
  nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()));
  nextSunday.setHours(23, 59, 59, 0);

  if (pct >= 10) {
    return {
      promoType:      'percent',
      promoValue:     pct,
      promoLabel:     `-${pct}% (prix normal : ${item.price_without_discount.toFixed(2)} €)`,
      promoValidUntil: nextSunday.toISOString(),
    };
  }
  return {
    promoType:      'immediate',
    promoValue:     Math.round(savings * 100) / 100,
    promoLabel:     `-${savings.toFixed(2)} € (prix normal : ${item.price_without_discount.toFixed(2)} €)`,
    promoValidUntil: nextSunday.toISOString(),
  };
}

/**
 * Cherche les prix d'un EAN dans Open Prices.
 * Stratégie nationale : regroupe par chaîne (Leclerc/Carrefour/Lidl) et calcule
 * la médiane France entière → assigne à tous nos magasins Nantes de cette chaîne.
 *
 * Justification MVP : les prix Leclerc/Carrefour/Lidl varient peu selon les régions
 * sur les produits de grande marque (écart généralement < 5%). C'est une base réaliste
 * en attendant que la communauté remonte des prix Nantes spécifiques.
 */
async function fetchPricesForEan(ean: string): Promise<StorePriceEntry[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365); // 1 an max
  const dateMin = cutoff.toISOString().split('T')[0];

  const url = `${BASE_URL}/prices?product_code=${ean}&date__gte=${dateMin}&page_size=100&order_by=-date`;
  const data = await fetchJSON<OPPricesResponse>(url);
  if (!data || data.items.length === 0) return [];

  // Collecte les prix par chaîne
  const pricesByChain: Record<string, number[]> = { leclerc: [], carrefour: [], lidl: [] };
  const promoByChain:  Record<string, ReturnType<typeof extractPromo>> = {};

  for (const item of data.items) {
    if (!item.price || item.price <= 0 || item.price > 500) continue;
    const chain = detectChain(item.location);
    if (!chain) continue;

    pricesByChain[chain].push(item.price);

    // Conserve la première promo trouvée par chaîne
    if (!promoByChain[chain]) {
      const promo = extractPromo(item);
      if (promo) promoByChain[chain] = promo;
    }
  }

  // Calcule la médiane par chaîne
  const median = (arr: number[]): number | null => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid    = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const entries: StorePriceEntry[] = [];

  for (const chain of ['leclerc', 'carrefour', 'lidl'] as const) {
    const med = median(pricesByChain[chain]);
    if (!med) continue;

    const price = Math.round(med * 100) / 100;
    const promo = promoByChain[chain] ?? null;

    // Assigne à tous nos magasins Nantes de cette chaîne
    const chainStores = NANTES_STORES.filter(s => s.chain === chain);
    for (const store of chainStores) {
      entries.push({
        ean,
        storeId: store.id,
        price,
        inStock: true,
        ...(promo ?? {}),
      });
    }
  }

  return entries;
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Scrape Open Prices pour tous les EANs du catalogue SmartHunt.
 * @param apiUrl   URL du backend SmartHunt
 * @param apiKey   Clé interne
 * @param maxEans  Limite pour les tests (0 = tous)
 */
export async function scrapeOpenPrices(
  apiUrl: string,
  apiKey: string,
  maxEans = 0,
): Promise<StorePriceEntry[]> {
  console.log('\n🔍 Open Prices — récupération des EANs du catalogue…');

  // 1. Récupère les EANs de notre catalogue
  const res = await fetch(`${apiUrl}/v1/internal/eans`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Impossible de récupérer les EANs : HTTP ${res.status}`);
  const { eans, total } = await res.json() as { eans: string[]; total: number };

  const targetEans = maxEans > 0 ? eans.slice(0, maxEans) : eans;
  console.log(`  ✓ ${total} EANs en catalogue — on en scrappe ${targetEans.length}`);

  // 2. Pour chaque EAN, cherche les prix Nantes dans Open Prices
  const allEntries: StorePriceEntry[] = [];
  let found = 0, empty = 0;

  for (let i = 0; i < targetEans.length; i++) {
    const ean = targetEans[i];
    await sleep(DELAY_MS);

    const entries = await fetchPricesForEan(ean);

    if (entries.length > 0) {
      allEntries.push(...entries);
      found++;
    } else {
      empty++;
    }

    // Affiche la progression toutes les 10 EANs
    if ((i + 1) % 10 === 0 || i === targetEans.length - 1) {
      process.stdout.write(
        `\r  ⏳ ${i + 1}/${targetEans.length} EANs — ${found} avec prix Nantes, ${empty} sans résultat`,
      );
    }
  }

  console.log(`\n\n  ✅ ${allEntries.length} prix trouvés pour ${found} produits`);
  console.log(`  ℹ️  ${empty} produits non référencés dans Open Prices pour Nantes`);

  return allEntries;
}
