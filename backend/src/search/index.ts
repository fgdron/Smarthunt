/**
 * SmartHunt — Moteur de recherche temps réel multi-enseignes
 *
 * Pour chaque produit d'un panier, interroge simultanément
 * toutes les enseignes disponibles et retourne les prix + promos du moment.
 *
 * Ordre de priorité : Carrefour > Auchan > Leclerc > Super U > Intermarché > Monoprix > Lidl
 */

import { carrefourSearch }   from './stores/carrefour.js';
import { auchanSearch }      from './stores/auchan.js';
import { leclercSearch }     from './stores/leclerc.js';
import { superUSearch }      from './stores/superU.js';
import { intermarcheSearch } from './stores/intermarche.js';
import { monoprixSearch }    from './stores/monoprix.js';
import { lidlSearch }        from './stores/lidl.js';

// ─── Interface commune ────────────────────────────────────────────────────────

/** Un résultat produit normalisé, quel que soit le store */
export interface StoreProduct {
  // Identification
  storeId:        string;          // ex: "carrefour-nantes-beaulieu"
  storeName:      string;          // ex: "Carrefour Nantes Beaulieu"
  chain:          StoreChain;      // ex: "carrefour"
  distanceKm?:    number;          // distance depuis la position utilisateur

  // Produit
  name:           string;          // nom tel qu'affiché sur le site
  brand:          string;
  quantity:       string;          // ex: "500g", "1L", "×8"
  imageUrl?:      string;

  // Prix
  price:          number;          // prix actuel (peut être promo)
  originalPrice?: number;          // prix barré si promo
  inStock:        boolean;

  // Promo
  hasPromo:       boolean;
  promoLabel?:    string;          // ex: "-20%", "2+1 offert", "Prix Malin"
  promoType?:     'percent' | 'immediate' | 'volume' | 'loyalty';
  promoValue?:    number;          // montant ou % de remise
  promoEndDate?:  string;          // ISO date
  loyaltyOnly?:   boolean;         // promo réservée carte de fidélité

  // Méta
  url?:           string;          // lien direct produit
  confidence:     'high' | 'medium' | 'low'; // fiabilité du match
}

export type StoreChain =
  | 'carrefour' | 'auchan' | 'leclerc'
  | 'superU' | 'intermarche' | 'monoprix' | 'lidl';

/** Un résultat de recherche pour un produit donné */
export interface ProductSearchResult {
  query:    string;              // terme recherché
  results:  StoreProduct[];     // classés par pertinence/prix
  cached:   boolean;
  fetchedAt: string;            // ISO timestamp
}

/** Résultat global pour un panier complet */
export interface BasketSearchResult {
  items: Array<{
    originalProduct: {           // produit tel qu'extrait de la capture
      name:       string;
      brand:      string;
      quantity:   number;
      unitPrice:  number;
    };
    results: StoreProduct[];     // prix trouvés dans les enseignes
    bestPrice: StoreProduct | null;
    bestPriceWithOdr: number | null; // après déduction ODR communauté
  }>;
  searchedAt: string;
}

// ─── Registre des enseignes ───────────────────────────────────────────────────

interface StoreSearcher {
  chain:    StoreChain;
  priority: number;             // ordre de priorité (1 = plus important)
  search:   (
    query:   string,
    lat?:    number,
    lng?:    number,
  ) => Promise<StoreProduct[]>;
}

const STORE_SEARCHERS: StoreSearcher[] = [
  { chain: 'carrefour',   priority: 1, search: carrefourSearch   },
  { chain: 'auchan',      priority: 2, search: auchanSearch      },
  { chain: 'leclerc',     priority: 3, search: leclercSearch     },
  { chain: 'superU',      priority: 4, search: superUSearch      },
  { chain: 'intermarche', priority: 5, search: intermarcheSearch },
  { chain: 'monoprix',    priority: 6, search: monoprixSearch    },
  { chain: 'lidl',        priority: 7, search: lidlSearch        },
];

// ─── Cache simple en mémoire (TTL 1h) ────────────────────────────────────────

interface CacheEntry {
  results:   StoreProduct[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure

function getCacheKey(query: string, lat?: number, lng?: number): string {
  const geoKey = lat != null ? `${Math.round(lat * 100)},${Math.round(lng! * 100)}` : 'nogeo';
  return `${query.toLowerCase().trim()}|${geoKey}`;
}

// ─── Recherche principale ─────────────────────────────────────────────────────

/**
 * Recherche un produit dans toutes les enseignes en parallèle.
 * Met en cache les résultats 1h.
 */
export async function searchProduct(
  query:      string,
  lat?:       number,
  lng?:       number,
  chains?:    StoreChain[],   // filtre optionnel par enseignes
): Promise<ProductSearchResult> {
  const cacheKey = getCacheKey(query, lat, lng);
  const cached   = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return {
      query,
      results:   cached.results,
      cached:    true,
      fetchedAt: new Date(cached.expiresAt - CACHE_TTL_MS).toISOString(),
    };
  }

  // Filtre les enseignes si demandé
  const searchers = chains
    ? STORE_SEARCHERS.filter(s => chains.includes(s.chain))
    : STORE_SEARCHERS;

  // Lance toutes les recherches en parallèle avec timeout individuel
  const searches = searchers.map(async searcher => {
    try {
      const results = await Promise.race([
        searcher.search(query, lat, lng),
        new Promise<StoreProduct[]>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 8000)
        ),
      ]);
      return results;
    } catch {
      return [] as StoreProduct[]; // timeout ou erreur → enseigne ignorée
    }
  });

  const allResults = (await Promise.all(searches)).flat();

  // Trie : meilleur prix en premier (avec bonus si promo)
  allResults.sort((a, b) => {
    const pa = a.price;
    const pb = b.price;
    return pa - pb;
  });

  // Met en cache
  cache.set(cacheKey, {
    results:   allResults,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return {
    query,
    results:   allResults,
    cached:    false,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Recherche tous les produits d'un panier en parallèle.
 */
export async function searchBasket(
  products: Array<{ name: string; brand: string; quantity: number; unit_price: number }>,
  lat?:     number,
  lng?:     number,
): Promise<BasketSearchResult> {
  const searches = products.map(async product => {
    const query   = `${product.brand} ${product.name}`.trim().slice(0, 60);
    const { results } = await searchProduct(query, lat, lng);

    const bestPrice = results.length > 0 ? results[0] : null;

    return {
      originalProduct: {
        name:      product.name,
        brand:     product.brand,
        quantity:  product.quantity,
        unitPrice: product.unit_price,
      },
      results,
      bestPrice,
      bestPriceWithOdr: null, // enrichi séparément via ODR sources
    };
  });

  const items = await Promise.all(searches);

  return {
    items,
    searchedAt: new Date().toISOString(),
  };
}
