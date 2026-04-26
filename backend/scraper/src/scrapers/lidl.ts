/**
 * Scraper Lidl France — Promos hebdomadaires
 * https://www.lidl.fr/c/offres-de-la-semaine/a10007552
 *
 * Stratégie :
 *  1. Appel à l'API publique Lidl (JSON structuré chargé par leur SPA)
 *  2. Fallback : parsing de la page HTML avec extraction JSON-LD
 *  3. Cross-référence EAN via Open Food Facts si non fourni par Lidl
 *  4. Retourne les entrées promo pour tous les Lidl Nantes
 *
 * Note : Lidl ne fournit pas toujours l'EAN directement.
 * Le cross-ref OFF est une tentative best-effort (peut rater ~30% des cas).
 */

import { storesByChain } from '../stores/nantes.js';
import type { StorePriceEntry } from './openprices.js';

const LIDL_API_URL = 'https://www.lidl.fr/api/products/v1/promotions?locale=fr_FR&page=1&size=100';
const OFF_SEARCH   = 'https://world.openfoodfacts.org/cgi/search.pl?search_terms={NAME}&brands=Lidl&json=1&page_size=3';
const DELAY_MS     = 800;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Types Lidl API ───────────────────────────────────────────────────────────

interface LidlProduct {
  fullTitle?:      string;
  title?:          string;
  price?:          number | string;
  originalPrice?:  number | string;
  discount?:       number | string;
  discountPercent?: number | string;
  keyfacts?:       string[];
  ean?:            string;
  gtins?:          string[];
  validFrom?:      string;
  validTo?:        string;
  category?:       string;
}

interface LidlAPIResponse {
  items?: LidlProduct[];
  data?:  LidlProduct[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept':          'application/json, text/html',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Referer':         'https://www.lidl.fr/',
      },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

/**
 * Cherche l'EAN d'un produit Lidl via Open Food Facts (cross-référence par nom).
 */
async function lookupEanByName(productName: string): Promise<string | null> {
  try {
    await sleep(DELAY_MS);
    const cleaned = productName.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, '').trim().slice(0, 40);
    const url     = OFF_SEARCH.replace('{NAME}', encodeURIComponent(cleaned));
    const res     = await fetch(url, {
      headers: { 'User-Agent': 'SmartHunt-Scraper/1.0' },
    });
    if (!res.ok) return null;
    const data    = await res.json() as { products?: Array<{ code?: string }> };
    const code    = data.products?.[0]?.code;
    return code && code.length >= 8 ? code : null;
  } catch {
    return null;
  }
}

/**
 * Normalise un prix (peut être string "2,99 €" ou number 2.99).
 */
function parsePrice(raw: number | string | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw > 0 ? raw : null;
  const n = parseFloat(raw.toString().replace(',', '.').replace(/[^0-9.]/g, ''));
  return isNaN(n) || n <= 0 ? null : n;
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * Tente de récupérer les promos via l'API JSON de Lidl.
 */
async function fetchLidlAPI(): Promise<LidlProduct[]> {
  console.log('  → Tentative API JSON Lidl…');
  const data = await fetchJSON<LidlAPIResponse>(LIDL_API_URL);
  if (!data) return [];
  const items = data.items ?? data.data ?? [];
  console.log(`  ✓ API Lidl : ${items.length} produits`);
  return items;
}

/**
 * Fallback : scrape la page HTML des offres de la semaine et extrait le JSON-LD.
 */
async function fetchLidlHTML(): Promise<LidlProduct[]> {
  console.log('  → Fallback : scraping page HTML Lidl…');
  try {
    const res = await fetch('https://www.lidl.fr/c/offres-de-la-semaine/a10007552', {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept':          'text/html',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Extrait les blocs JSON-LD
    const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    const products: LidlProduct[] = [];

    for (const match of jsonLdMatches) {
      try {
        const obj = JSON.parse(match[1]);
        // ItemList ou Product
        if (obj['@type'] === 'ItemList' && obj.itemListElement) {
          for (const el of obj.itemListElement) {
            const item = el.item ?? el;
            if (item.name && item.offers?.price) {
              products.push({
                title:         item.name,
                price:         item.offers.price,
                originalPrice: item.offers.priceSpecification?.price,
                ean:           item.gtin13 ?? item.gtin ?? item.sku,
              });
            }
          }
        } else if (obj['@type'] === 'Product') {
          products.push({
            title:         obj.name,
            price:         obj.offers?.price,
            originalPrice: obj.offers?.priceSpecification?.price,
            ean:           obj.gtin13 ?? obj.gtin ?? obj.sku,
          });
        }
      } catch { /* JSON invalide */ }
    }

    // Cherche aussi les données dans __NEXT_DATA__ ou window.__data
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const promos = nextData?.props?.pageProps?.offers
                    ?? nextData?.props?.pageProps?.products
                    ?? [];
        for (const p of promos) {
          if (p.price && (p.title || p.name)) {
            products.push({
              title: p.title ?? p.name,
              price: p.price ?? p.currentPrice,
              originalPrice: p.originalPrice ?? p.normalPrice,
              ean: p.ean ?? p.gtin,
            });
          }
        }
      } catch { /* skip */ }
    }

    console.log(`  ✓ HTML Lidl : ${products.length} produits extraits`);
    return products;
  } catch (err) {
    console.warn('  ❌ Erreur scraping HTML Lidl:', err);
    return [];
  }
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Scrape les promos hebdomadaires Lidl et retourne des StorePriceEntry
 * pour tous les Lidl Nantes.
 */
export async function scrapeLidlPromos(): Promise<StorePriceEntry[]> {
  console.log('\n🟡 Lidl — Promos de la semaine');

  const lidlStores = storesByChain('lidl');
  if (lidlStores.length === 0) {
    console.log('  ⚠️  Aucun magasin Lidl Nantes configuré');
    return [];
  }

  // 1. Récupère les promos
  let products = await fetchLidlAPI();
  if (products.length === 0) {
    products = await fetchLidlHTML();
  }
  if (products.length === 0) {
    console.log('  ❌ Aucune promo Lidl récupérée');
    return [];
  }

  // 2. Calcule la date de fin (dimanche prochain 23h59)
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + (7 - validUntil.getDay()));
  validUntil.setHours(23, 59, 59, 0);
  const validUntilISO = validUntil.toISOString();

  // 3. Construit les entrées
  const entries: StorePriceEntry[] = [];
  let eanFound = 0, eanLookup = 0, eanMissed = 0;

  for (const product of products) {
    const title = product.fullTitle ?? product.title ?? '';
    if (!title) continue;

    const price         = parsePrice(product.price);
    const originalPrice = parsePrice(product.originalPrice);
    if (!price) continue;

    // EAN : direct ou lookup OFF
    let ean = product.ean
           ?? product.gtins?.[0]
           ?? product.keyfacts?.find(f => /^\d{8,14}$/.test(f));

    if (ean) {
      eanFound++;
    } else {
      // Lookup via Open Food Facts (best effort, rate limité)
      if (eanLookup < 20) { // max 20 lookups par run pour limiter les appels
        ean = await lookupEanByName(title) ?? undefined;
        eanLookup++;
        if (!ean) { eanMissed++; continue; }
      } else {
        eanMissed++;
        continue;
      }
    }

    // Calcule la promo
    let promoType: StorePriceEntry['promoType'];
    let promoValue: number | undefined;
    let promoLabel: string | undefined;

    const discountPct = parsePrice(product.discountPercent ?? product.discount);
    if (discountPct && discountPct >= 5 && discountPct <= 90) {
      promoType  = 'percent';
      promoValue = discountPct;
      promoLabel = `-${discountPct}% Lidl cette semaine`;
    } else if (originalPrice && originalPrice > price) {
      const savings = originalPrice - price;
      const pct     = Math.round((savings / originalPrice) * 100);
      if (pct >= 5) {
        promoType  = 'percent';
        promoValue = pct;
        promoLabel = `-${pct}% Lidl (prix normal : ${originalPrice.toFixed(2)} €)`;
      } else if (savings >= 0.10) {
        promoType  = 'immediate';
        promoValue = Math.round(savings * 100) / 100;
        promoLabel = `-${savings.toFixed(2)} € Lidl cette semaine`;
      }
    }

    // Ajoute pour chaque Lidl Nantes
    for (const store of lidlStores) {
      entries.push({
        ean,
        storeId: store.id,
        price,
        inStock: true,
        ...(promoType ? { promoType, promoValue, promoLabel, promoValidUntil: validUntilISO } : {}),
      });
    }
  }

  console.log(`  ✓ ${entries.length / lidlStores.length} produits | EAN directs: ${eanFound} | Lookups OFF: ${eanLookup} | Manquants: ${eanMissed}`);
  console.log(`  ✓ ${entries.filter(e => e.promoType).length} entrées avec promo (${lidlStores.length} magasins)`);

  return entries;
}
