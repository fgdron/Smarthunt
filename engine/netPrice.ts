import { ProductGroup, ProductVariant, SegmentType, StoreId, ALL_STORE_IDS, STORES_CONFIG, PRODUCTS_DB } from '@/data/productsDB';
import { matchProductWithOffers, filterValidOffers, type ExternalCashbackOffer, type OfferMatch } from '@/engine/matchOffers';

// ─── EAN reverse lookup ─────────────────────────────────────

const EAN_MAP = new Map<string, { group: ProductGroup; variant: ProductVariant }>();

for (const group of PRODUCTS_DB) {
  for (const variant of Object.values(group.variants) as ProductVariant[]) {
    EAN_MAP.set(variant.ean, { group, variant });
  }
}

export function findVariantByEAN(ean: string) {
  return EAN_MAP.get(ean) ?? null;
}

// ─── Net price calculation ──────────────────────────────────

export interface NetPriceResult {
  baseStorePrice: number;
  afterPromo: number;      // prix unitaire moyen après promo catalogue
  afterCashback: number;   // prix unitaire moyen après cashback statique (productsDB)
  netPrice: number;        // prix net final = afterCashback - remboursement externe
  promoLabel?: string;
  cashbackLabel?: string;
  totalSaving: number;     // économie unitaire totale (promo + cashback statique + ODR externe)
  last_verified: number;
  // ── Champs quantity-aware ──────────────────────────────────
  qty: number;
  totalNet: number;        // total pour qty unités (promos volume + ODR inclus)
  totalSaving_qty: number; // économie totale pour qty unités
  // ── Offre externe (V2 Matchmaker ODR) ─────────────────────
  /** Présent si une offre externe a été trouvée via le matchmaker */
  externalOffer?: OfferMatch;
  /**
   * true quand le prix final inclut un remboursement qui nécessite
   * de scanner le ticket de caisse (ODR post-achat).
   */
  requiresScan: boolean;
}

// Returns null when the product is not available at this store.
// qty (default 1) active les promos de volume et renvoie totalNet / totalSaving_qty.
// externalOffers (optionnel) : liste des offres externes du matchmaker ODR.
export function getBestNetPrice(
  variant: ProductVariant,
  storeId: StoreId,
  qty: number = 1,
  externalOffers?: ExternalCashbackOffer[],
  productMeta?: { brand: string; genericName: string },
): NetPriceResult | null {
  // Rupture de stock explicite dans cette enseigne
  if (variant.in_stock !== undefined && variant.in_stock[storeId] === false) return null;

  const baseStorePrice = variant.prices[storeId];
  if (baseStorePrice === undefined) return null;

  // ── Calcul du total après promo (qty-aware) ─────────────────
  let totalAfterPromo = baseStorePrice * qty;
  let promoLabel: string | undefined;

  if (variant.catalogue_promo) {
    const p = variant.catalogue_promo;
    if (p.store === 'all' || p.store === storeId) {
      promoLabel = p.label;
      if (p.type === 'percent') {
        totalAfterPromo = Math.round(baseStorePrice * (1 - p.value) * qty * 100) / 100;
      } else if (p.type === 'volume') {
        // Ex: "2ème à -70%" → value=0.70, minQty=2
        // Chaque tranche de minQty unités : (minQty-1) plein prix + 1 remisé
        const minQty = p.minQty ?? 2;
        const pairs = Math.floor(qty / minQty);
        const remaining = qty % minQty;
        totalAfterPromo = Math.round((
          pairs * ((minQty - 1) * baseStorePrice + baseStorePrice * (1 - p.value)) +
          remaining * baseStorePrice
        ) * 100) / 100;
      } else {
        // 'immediate' — remise fixe par unité
        totalAfterPromo = Math.max(0, Math.round((baseStorePrice - p.value) * qty * 100) / 100);
      }
    }
  }

  // ── Cashback statique productsDB (par unité × qty) ─────────
  let totalAfterCashback = totalAfterPromo;
  let cashbackLabel: string | undefined;

  if (variant.cashback_app) {
    const cb = variant.cashback_app;
    totalAfterCashback = Math.max(0, Math.round((totalAfterPromo - cb.amount * qty) * 100) / 100);
    cashbackLabel = cb.label;
  }

  // ── Offre externe ODR (Matchmaker V2) ───────────────────────
  let externalOffer: OfferMatch | undefined;
  let totalAfterExternal = totalAfterCashback;

  if (externalOffers && externalOffers.length > 0 && productMeta) {
    const validOffers = filterValidOffers(externalOffers);
    const match = matchProductWithOffers(
      variant.ean,
      productMeta.brand,
      productMeta.genericName,
      validOffers,
    );
    if (match) {
      const effectiveQty = Math.floor(qty / Math.max(1, match.offer.minQty));
      const rebate       = effectiveQty * match.offer.amount;
      totalAfterExternal = Math.max(0, Math.round((totalAfterCashback - rebate) * 100) / 100);
      externalOffer = match;
    }
  }

  // ── Prix unitaire moyen (pour affichage et comparaisons) ────
  const afterPromo    = Math.round((totalAfterPromo    / qty) * 100) / 100;
  const afterCashback = Math.round((totalAfterCashback / qty) * 100) / 100;
  const netUnit       = Math.round((totalAfterExternal / qty) * 100) / 100;
  const totalSaving   = Math.round((baseStorePrice - netUnit) * 100) / 100;

  return {
    baseStorePrice,
    afterPromo,
    afterCashback,
    netPrice: netUnit,
    promoLabel,
    cashbackLabel,
    totalSaving,
    last_verified: variant.last_verified,
    qty,
    totalNet:         totalAfterExternal,
    totalSaving_qty:  Math.round((baseStorePrice * qty - totalAfterExternal) * 100) / 100,
    externalOffer,
    requiresScan:     !!(variant.cashback_app || externalOffer),
  };
}

// ─── Bio-Switch detection ───────────────────────────────────

export interface BioSwitchResult {
  available: boolean;
  delta: number;
  label: string;
}

export function checkBioSwitch(
  group: ProductGroup,
  chosenType: SegmentType,
  storeId: StoreId,
): BioSwitchResult {
  const noSwitch: BioSwitchResult = { available: false, delta: 0, label: '' };

  if (chosenType === 'bio') return noSwitch;

  const bioVariant = group.variants.bio;
  const chosenVariant = group.variants[chosenType];
  if (!bioVariant || !chosenVariant) return noSwitch;

  const chosenRes = getBestNetPrice(chosenVariant, storeId);
  const bioRes = getBestNetPrice(bioVariant, storeId);
  if (!chosenRes || !bioRes) return noSwitch;

  const chosenNet = chosenRes.netPrice;
  const bioNet = bioRes.netPrice;
  const delta = Math.round((bioNet - chosenNet) * 100) / 100;

  const threshold = chosenNet * 0.10;
  if (Math.abs(delta) <= threshold) {
    const sign = delta >= 0 ? '+' : '-';
    const label = delta === 0
      ? '🌿 Bio au même prix !'
      : `🌿 Bio pour ${sign}${Math.abs(delta).toFixed(2)}€ seulement !`;
    return { available: true, delta, label };
  }

  return noSwitch;
}

// ─── Géolocalisation ───────────────────────────────────────

export interface Coords { lat: number; lng: number; }

export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const chord = sinLat * sinLat +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
  return R * 2 * Math.asin(Math.sqrt(chord));
}

// En production, userCoords vient de expo-location.
// Renvoie les StoreId disponibles dans le rayon donné (km).
export function getNearbyStores(userCoords: Coords, radiusKm: number = 15): StoreId[] {
  return ALL_STORE_IDS.filter(id => haversineKm(userCoords, STORES_CONFIG[id].coords) <= radiusKm);
}

// Coordonnées de Paris centre — utilisées par défaut dans l'appli
export const PARIS_CENTER: Coords = { lat: 48.8566, lng: 2.3522 };
