/**
 * SmartHunt — Moteur de correspondance ODR côté serveur
 *
 * Même algorithme que le client mobile (engine/matchOffers.ts),
 * centralisé ici pour pré-marquer les produits lors de l'ingestion.
 *
 * Algorithme :
 *  1. Match exact EAN         → score 1.0, retour immédiat
 *  2. Jaccard tokenisé        → |A∩B| / |A∪B| ≥ FUZZY_THRESHOLD
 */

const FUZZY_THRESHOLD = 0.25;

// ─── Normalisation ───────────────────────────────────────────────────────────

/** Supprime les accents, met en minuscule, tokenise (≥3 chars). */
function tokenize(str: string): Set<string> {
  const normalized = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');

  const tokens = normalized.split(/\s+/).filter(t => t.length >= 3);
  return new Set(tokens);
}

// ─── Jaccard ─────────────────────────────────────────────────────────────────

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ─── Types d'offres ───────────────────────────────────────────────────────────

export interface OfferInput {
  id:       string;
  label:    string;
  eanList:  string[];
  amount:   number;
  minQty:   number;
}

export interface MatchResult {
  offerId:    string;
  score:      number;
  matchType:  'ean' | 'fuzzy';
}

// ─── Correspondance produit ↔ offres ─────────────────────────────────────────

/**
 * Retourne la meilleure offre correspondante pour un produit donné.
 * Priorité : EAN exact > Jaccard max.
 */
export function matchProductWithOffers(
  ean:         string,
  brand:       string,
  genericName: string,
  offers:      OfferInput[],
): MatchResult | null {
  // 1. Match EAN exact
  for (const offer of offers) {
    if (offer.eanList.includes(ean)) {
      return { offerId: offer.id, score: 1.0, matchType: 'ean' };
    }
  }

  // 2. Jaccard sur (brand + genericName)
  const productTokens = new Set([
    ...tokenize(brand),
    ...tokenize(genericName),
  ]);

  let bestScore  = 0;
  let bestOfferId: string | null = null;

  for (const offer of offers) {
    const offerTokens = tokenize(offer.label);
    const score = jaccard(productTokens, offerTokens);
    if (score > bestScore) {
      bestScore   = score;
      bestOfferId = offer.id;
    }
  }

  if (bestScore >= FUZZY_THRESHOLD && bestOfferId) {
    return { offerId: bestOfferId, score: bestScore, matchType: 'fuzzy' };
  }

  return null;
}

// ─── Filtre offres valides ────────────────────────────────────────────────────

/** Retourne uniquement les offres dont la date d'expiration est future. */
export function filterValidOffers<T extends { validUntil: Date; active: boolean }>(
  offers: T[],
): T[] {
  const now = Date.now();
  return offers.filter(o => o.active && o.validUntil.getTime() > now);
}
