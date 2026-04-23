/**
 * SmartHunt — Matchmaker ODR v2
 *
 * Réconcilie les offres de remboursement externes (Shopmium, Quoty, Coupon Network)
 * avec les produits du catalogue via deux stratégies :
 *
 *   1. Match EAN exact  → score = 1.00  (priorité absolue)
 *   2. Fuzzy text       → similarité de Jaccard entre les tokens du label offre
 *                         et ceux de (brand + genericName) du produit
 *
 * Aucune dépendance externe — module pur, testable unitairement.
 */

// ─── Types publics ────────────────────────────────────────────────────────────

export type OfferProvider = 'shopmium' | 'quoty' | 'coupon_network';

export interface ExternalCashbackOffer {
  /** Identifiant unique côté API */
  id: string;
  provider: OfferProvider;
  /** Label humain de l'offre, ex: "Couches Pampers Taille 4 x44" */
  label: string;
  /** Montant remboursé en € après scan du ticket */
  amount: number;
  /** EANs éligibles — liste exacte fournie par le provider */
  eanList: string[];
  /** Quantité minimum à acheter pour déclencher le remboursement */
  minQty: number;
  /** Date d'expiration (timestamp ms) */
  validUntil: number;
  deeplinkIos: string;
  deeplinkAndroid: string;
}

export interface OfferMatch {
  offer: ExternalCashbackOffer;
  /** Score de confiance 0..1 (1.0 = EAN exact, <1 = fuzzy) */
  score: number;
  matchType: 'ean' | 'fuzzy';
}

// ─── Metadata providers (couleurs UI, libellés) ───────────────────────────────

export const PROVIDER_META: Record<OfferProvider, { label: string; color: string }> = {
  shopmium:       { label: 'Shopmium',        color: '#FF3B5C' },
  quoty:          { label: 'Quoty',            color: '#FF6B00' },
  coupon_network: { label: 'Coupon Network',  color: '#0072CE' },
};

// ─── Paramétrage du fuzzy match ───────────────────────────────────────────────

/**
 * Score Jaccard minimum pour accepter un match fuzzy.
 * En dessous : ignoré (évite les faux positifs sur des mots courants).
 * Calibré empiriquement sur le corpus français de labels ODR.
 */
const FUZZY_THRESHOLD = 0.25;

/**
 * Longueur minimum d'un token pour être pris en compte.
 * Filtre les articles ("de", "la", "un"…) et les codes courts.
 */
const MIN_TOKEN_LEN = 3;

// ─── Helpers texte ────────────────────────────────────────────────────────────

/**
 * Normalise une chaîne et retourne un Set de tokens significatifs.
 *
 * Transformations :
 *  - Minuscules
 *  - Suppression des accents (NFD + strip combining chars)
 *  - Ponctuation → espace
 *  - Filtre les tokens < MIN_TOKEN_LEN caractères
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // accents
      .replace(/[^a-z0-9\s]/g, ' ')    // ponctuation
      .split(/\s+/)
      .filter(t => t.length >= MIN_TOKEN_LEN),
  );
}

/**
 * Indice de Jaccard : |A ∩ B| / |A ∪ B|
 * Vaut 0 si l'un des deux ensembles est vide.
 */
function jaccardScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter(t => b.has(t)).length;
  const union        = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Recherche la meilleure offre externe pour un produit.
 *
 * Priorité :
 *  1. Match EAN exact dans `offer.eanList`   → retourné immédiatement (score 1)
 *  2. Meilleur score Jaccard ≥ FUZZY_THRESHOLD sur (brand + genericName) vs label
 *
 * @param ean          EAN de la variante produit
 * @param brand        Marque du produit (ex: "Danone")
 * @param genericName  Nom générique (ex: "Yaourt nature 125g")
 * @param offers       Liste des offres reçues de l'API
 * @returns            Meilleur match ou null si aucun ne dépasse le seuil
 */
export function matchProductWithOffers(
  ean: string,
  brand: string,
  genericName: string,
  offers: ExternalCashbackOffer[],
): OfferMatch | null {
  if (offers.length === 0) return null;

  // Pré-calcul des tokens produit (fait une seule fois pour toutes les offres)
  const productTokens = tokenize(`${brand} ${genericName}`);

  let best: OfferMatch | null = null;

  for (const offer of offers) {
    // ── 1. Match EAN exact ──────────────────────────────────────────────────
    if (offer.eanList.includes(ean)) {
      // Confiance maximale — inutile de continuer
      return { offer, score: 1, matchType: 'ean' };
    }

    // ── 2. Fuzzy match ─────────────────────────────────────────────────────
    const offerTokens = tokenize(offer.label);
    const score       = jaccardScore(productTokens, offerTokens);

    if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) {
      best = { offer, score, matchType: 'fuzzy' };
    }
  }

  return best;
}

/**
 * Filtre les offres expirées.
 * À appeler avant de passer la liste au matchmaker pour éviter
 * d'afficher des remboursements périmés.
 */
export function filterValidOffers(offers: ExternalCashbackOffer[]): ExternalCashbackOffer[] {
  const now = Date.now();
  return offers.filter(o => o.validUntil > now);
}
