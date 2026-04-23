// ============================================================
// SmartHunt — Moteur de comparaison "Total Basket Optimizer"
//
// calculateBestShoppingStrategy(userBasket, userLocation)
//
// Retourne deux scénarios :
//   1. Mono-magasin  : enseigne unique la moins chère sur tout le panier
//   2. Multi-magasins: répartition article par article pour le Net-Net absolu
//
// + Suggestions Bio Switch quand l'alternative biologique est
//   financièrement proche ou moins chère que le conventionnel.
// ============================================================

import {
  BasketItem, UserLocation, StrategyResult, ShoppingScenario,
  StoreTotal, ItemResult, BioSwitchSuggestion, Partner,
} from './types';
import {
  PRODUCTS, STORES, STORE_LOCATIONS,
  STORE_PRICES, CATALOGUE_PROMOS, CASHBACK_OFFERS,
} from './mockCatalog';

// ── Seuil de suggestion Bio : on recommande si le surcoût net est ≤ ce montant ──
const BIO_SWITCH_THRESHOLD_EUR = 0.30;

// ── Rayon de recherche des enseignes par défaut ──
const DEFAULT_RADIUS_KM = 15;

// ============================================================
// 1. Utilitaires géographiques
// ============================================================

/** Formule de Haversine — distance en km entre deux coordonnées GPS */
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getNearbyStores(location: UserLocation, radiusKm: number) {
  return STORE_LOCATIONS
    .map(loc => ({
      ...loc,
      distance_km: Math.round(haversineKm(location.lat, location.lng, loc.lat, loc.lng) * 10) / 10,
    }))
    .filter(loc => loc.distance_km <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km);
}

// ============================================================
// 2. Calcul du prix net d'un article dans une enseigne donnée
// ============================================================

interface PriceBreakdown {
  base_price: number;
  promo_price: number;   // = base_price si pas de promo
  final_price: number;   // = promo_price si pas de cashback
  promo_label?: string;
  cashback_amount: number;
  cashback_partner?: Partner;
  deeplink_ios?: string;
  is_cumul_max: boolean;
  in_stock: boolean;
}

function computeItemPrice(ean: string, storeId: number, today: Date): PriceBreakdown | null {
  const storePrice = STORE_PRICES.find(p => p.ean === ean && p.store_id === storeId);
  if (!storePrice || !storePrice.in_stock) return null;

  const base = storePrice.base_price;

  // Cherche la promo catalogue valide
  const promo = CATALOGUE_PROMOS.find(
    p => p.ean === ean
      && p.store_id === storeId
      && new Date(p.valid_until) >= today,
  );

  const promoPrice = promo ? promo.promo_price : base;

  // Cherche le cashback valide dans cette enseigne
  const cashback = CASHBACK_OFFERS.find(
    o => o.ean === ean
      && new Date(o.valid_until) >= today
      && (o.store_ids === null || o.store_ids.includes(storeId)),
  );

  const cashbackAmount = cashback ? cashback.cashback_amount : 0;
  const finalPrice = Math.max(0, promoPrice - cashbackAmount);

  return {
    base_price: base,
    promo_price: promoPrice,
    final_price: Math.round(finalPrice * 100) / 100,
    promo_label: promo?.promo_label,
    cashback_amount: cashbackAmount,
    cashback_partner: cashback?.partner as Partner | undefined,
    deeplink_ios: cashback?.deeplink_ios,
    is_cumul_max: !!promo && cashbackAmount > 0,
    in_stock: true,
  };
}

// ============================================================
// 3. Calcul du Bio Switch pour un article
// ============================================================

function computeBioSwitch(
  ean: string,
  conventionalFinalPrice: number,
  storeIds: number[],
  today: Date,
): BioSwitchSuggestion | undefined {
  const product = PRODUCTS.find(p => p.ean === ean);
  if (!product?.bio_alt_ean) return undefined;

  const bioProduct = PRODUCTS.find(p => p.ean === product.bio_alt_ean);
  if (!bioProduct) return undefined;

  // Cherche le meilleur prix du produit bio dans les enseignes proches
  let bestBioFinal = Infinity;
  let bestBioStoreId = -1;

  for (const sid of storeIds) {
    const breakdown = computeItemPrice(bioProduct.ean, sid, today);
    if (breakdown && breakdown.final_price < bestBioFinal) {
      bestBioFinal = breakdown.final_price;
      bestBioStoreId = sid;
    }
  }

  if (bestBioStoreId === -1) return undefined;

  const delta = Math.round((bestBioFinal - conventionalFinalPrice) * 100) / 100;
  const bestStore = STORES.find(s => s.id === bestBioStoreId);

  return {
    bio_ean: bioProduct.ean,
    bio_name: bioProduct.name,
    bio_brand: bioProduct.brand,
    bio_unit_label: bioProduct.unit_label,
    bio_best_store: bestStore?.name ?? '',
    bio_final_price: bestBioFinal,
    conventional_final_price: conventionalFinalPrice,
    price_delta: delta,
    // Recommandé si bio moins cher OU surcoût ≤ seuil
    recommended: delta <= BIO_SWITCH_THRESHOLD_EUR,
  };
}

// ============================================================
// 4. Construction d'un ItemResult complet
// ============================================================

function buildItemResult(
  ean: string,
  qty: number,
  storeId: number,
  breakdown: PriceBreakdown,
  nearbyStoreIds: number[],
  today: Date,
): ItemResult {
  const product = PRODUCTS.find(p => p.ean === ean)!;
  const store = STORES.find(s => s.id === storeId)!;

  const savingsAmount = Math.round((breakdown.base_price - breakdown.final_price) * qty * 100) / 100;
  const savingsPct = Math.round(((breakdown.base_price - breakdown.final_price) / breakdown.base_price) * 100);

  const bioSwitch = computeBioSwitch(ean, breakdown.final_price, nearbyStoreIds, today);

  return {
    ean,
    name: product.name,
    brand: product.brand,
    unit_label: product.unit_label,
    segment: product.segment,
    qty,
    store_id: storeId,
    store_name: store.name,
    base_price: breakdown.base_price,
    promo_price: breakdown.promo_price,
    final_price: breakdown.final_price,
    line_total: Math.round(breakdown.final_price * qty * 100) / 100,
    savings_amount: savingsAmount,
    savings_percent: savingsPct,
    is_cumul_max: breakdown.is_cumul_max,
    promo_label: breakdown.promo_label,
    cashback: breakdown.cashback_partner
      ? {
        partner: breakdown.cashback_partner,
        amount: breakdown.cashback_amount,
        deeplink_ios: breakdown.deeplink_ios ?? '',
      }
      : undefined,
    bio_switch: bioSwitch,
  };
}

// ============================================================
// 5. Agrégation par enseigne → StoreTotal
// ============================================================

function aggregateByStore(items: ItemResult[]): StoreTotal[] {
  const map = new Map<number, StoreTotal>();

  for (const item of items) {
    if (!map.has(item.store_id)) {
      const store = STORES.find(s => s.id === item.store_id)!;
      map.set(item.store_id, {
        store_id: item.store_id,
        store_name: store.name,
        store_color: store.color,
        items: [],
        subtotal_base: 0,
        subtotal_promo: 0,
        subtotal_cashback: 0,
        subtotal_final: 0,
        items_in_stock: 0,
        items_total: 0,
      });
    }
    const group = map.get(item.store_id)!;
    group.items.push(item);
    group.subtotal_base     += item.base_price * item.qty;
    group.subtotal_promo    += (item.base_price - item.promo_price) * item.qty;
    group.subtotal_cashback += item.cashback ? item.cashback.amount * item.qty : 0;
    group.subtotal_final    += item.line_total;
    group.items_in_stock    += 1;
    group.items_total       += 1;
  }

  // Arrondi à 2 décimales
  for (const g of map.values()) {
    g.subtotal_base     = Math.round(g.subtotal_base * 100) / 100;
    g.subtotal_promo    = Math.round(g.subtotal_promo * 100) / 100;
    g.subtotal_cashback = Math.round(g.subtotal_cashback * 100) / 100;
    g.subtotal_final    = Math.round(g.subtotal_final * 100) / 100;
  }

  return Array.from(map.values()).sort((a, b) => a.store_id - b.store_id);
}

// ============================================================
// 6. Totaux d'un scénario
// ============================================================

function buildScenarioTotals(
  scenario: 'mono_store' | 'multi_store',
  stores: StoreTotal[],
  unavailable: Array<{ ean: string; name: string }>,
  bioSwitches: BioSwitchSuggestion[],
): ShoppingScenario {
  const totalBase     = Math.round(stores.reduce((s, g) => s + g.subtotal_base, 0) * 100) / 100;
  const totalPromo    = Math.round(stores.reduce((s, g) => s + g.subtotal_promo, 0) * 100) / 100;
  const totalCashback = Math.round(stores.reduce((s, g) => s + g.subtotal_cashback, 0) * 100) / 100;
  const totalFinal    = Math.round(stores.reduce((s, g) => s + g.subtotal_final, 0) * 100) / 100;
  const totalSavings  = Math.round((totalBase - totalFinal) * 100) / 100;
  const savingsPct    = totalBase > 0 ? Math.round((totalSavings / totalBase) * 100) : 0;

  return {
    scenario,
    total_base: totalBase,
    total_promo_savings: totalPromo,
    total_cashback: totalCashback,
    total_final: totalFinal,
    total_savings: totalSavings,
    savings_percent: savingsPct,
    stores,
    unavailable_items: unavailable,
    bio_switches: bioSwitches,
  };
}

// ============================================================
// 7. SCÉNARIO MONO-MAGASIN
//    Pour chaque enseigne proche, calcule le total du panier.
//    Retourne celui avec le total_final le plus bas.
// ============================================================

function computeMonoStore(
  basket: BasketItem[],
  nearbyStoreIds: number[],
  today: Date,
): { best: ShoppingScenario; allTotals: Array<{ store_id: number; total_final: number }> } {
  const allTotals: Array<{ store_id: number; total_final: number }> = [];
  let bestStoreId = -1;
  let bestTotal = Infinity;

  for (const storeId of nearbyStoreIds) {
    let storeTotal = 0;
    let allAvailable = true;

    for (const { ean, qty } of basket) {
      const bp = computeItemPrice(ean, storeId, today);
      if (!bp) { allAvailable = false; continue; }
      storeTotal += bp.final_price * qty;
    }

    allTotals.push({ store_id: storeId, total_final: Math.round(storeTotal * 100) / 100 });

    if (storeTotal < bestTotal) {
      bestTotal = storeTotal;
      bestStoreId = storeId;
    }
  }

  // Construit le résultat détaillé pour la meilleure enseigne
  const items: ItemResult[] = [];
  const unavailable: Array<{ ean: string; name: string }> = [];
  const bioSwitches: BioSwitchSuggestion[] = [];

  for (const { ean, qty } of basket) {
    const bp = computeItemPrice(ean, bestStoreId, today);
    if (!bp) {
      const p = PRODUCTS.find(p => p.ean === ean);
      unavailable.push({ ean, name: p?.name ?? ean });
      continue;
    }
    const item = buildItemResult(ean, qty, bestStoreId, bp, nearbyStoreIds, today);
    items.push(item);
    if (item.bio_switch?.recommended) bioSwitches.push(item.bio_switch);
  }

  const stores = aggregateByStore(items);
  return {
    best: buildScenarioTotals('mono_store', stores, unavailable, bioSwitches),
    allTotals,
  };
}

// ============================================================
// 8. SCÉNARIO MULTI-MAGASINS
//    Pour chaque article, sélectionne greedy l'enseigne avec
//    le final_price le plus bas (indépendamment des autres).
//    Optimal pour maximiser l'économie — sans contrainte de trajet.
// ============================================================

function computeMultiStore(
  basket: BasketItem[],
  nearbyStoreIds: number[],
  today: Date,
): ShoppingScenario {
  const items: ItemResult[] = [];
  const unavailable: Array<{ ean: string; name: string }> = [];
  const bioSwitches: BioSwitchSuggestion[] = [];

  for (const { ean, qty } of basket) {
    let bestBreakdown: ReturnType<typeof computeItemPrice> = null;
    let bestStoreId = -1;
    let bestFinal = Infinity;

    for (const storeId of nearbyStoreIds) {
      const bp = computeItemPrice(ean, storeId, today);
      if (bp && bp.final_price < bestFinal) {
        bestFinal = bp.final_price;
        bestBreakdown = bp;
        bestStoreId = storeId;
      }
    }

    if (!bestBreakdown || bestStoreId === -1) {
      const p = PRODUCTS.find(p => p.ean === ean);
      unavailable.push({ ean, name: p?.name ?? ean });
      continue;
    }

    const item = buildItemResult(ean, qty, bestStoreId, bestBreakdown, nearbyStoreIds, today);
    items.push(item);
    if (item.bio_switch?.recommended) bioSwitches.push(item.bio_switch);
  }

  const stores = aggregateByStore(items);
  return buildScenarioTotals('multi_store', stores, unavailable, bioSwitches);
}

// ============================================================
// 9. FONCTION PRINCIPALE — Point d'entrée public
// ============================================================

export function calculateBestShoppingStrategy(
  userBasket: BasketItem[],
  userLocation: UserLocation,
): StrategyResult {
  const today = new Date();
  const radius = userLocation.radius_km ?? DEFAULT_RADIUS_KM;

  // Enseignes dans le rayon
  const nearbyLocations = getNearbyStores(userLocation, radius);
  if (nearbyLocations.length === 0) {
    throw new Error(`Aucune enseigne trouvée dans un rayon de ${radius}km.`);
  }
  const nearbyStoreIds = [...new Set(nearbyLocations.map(l => l.store.id))];

  // Calcul des deux scénarios
  const { best: mono } = computeMonoStore(userBasket, nearbyStoreIds, today);
  const multi = computeMultiStore(userBasket, nearbyStoreIds, today);

  const extraSavings = Math.round((mono.total_final - multi.total_final) * 100) / 100;

  // Recommande multi uniquement si le gain supplémentaire dépasse 2€
  // (en-dessous, le coût du trajet supplémentaire ne vaut pas la peine)
  const recommended: 'mono_store' | 'multi_store' = extraSavings >= 2 ? 'multi_store' : 'mono_store';

  return {
    user_location: userLocation,
    nearby_stores: nearbyLocations,
    mono_store: mono,
    multi_store: multi,
    recommended_scenario: recommended,
    multi_store_extra_savings: extraSavings,
    computed_at: today.toISOString(),
  };
}
