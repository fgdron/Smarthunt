// ─────────────────────────────────────────────────────────────
// SmartNudge — Détection d'opportunités de volume
// Pour chaque produit du panier avec une promo de type 'volume',
// simule qty+1 et vérifie si le prix unitaire chute de >5%.
// ─────────────────────────────────────────────────────────────

import { BasketItem } from '@/store/useSmartHuntStore';
import { StoreId, ALL_STORE_IDS } from '@/data/productsDB';
import { getBestNetPrice } from './netPrice';

export interface SmartNudge {
  groupId: string;
  genericName: string;
  emoji: string;
  currentQty: number;
  suggestedQty: number;
  unitPriceBefore: number;  // prix unitaire moyen à qty actuelle
  unitPriceAfter: number;   // prix unitaire moyen à qty+1
  savingDelta: number;      // économie supplémentaire totale
  dropPct: number;          // % de baisse du prix unitaire (entier)
  promoLabel: string;
}

export function getSmartNudges(basket: BasketItem[]): SmartNudge[] {
  const nudges: SmartNudge[] = [];

  for (const item of basket) {
    const v = item.variant;
    const p = v.catalogue_promo;
    if (!p || p.type !== 'volume') continue;

    // Trouver un magasin où le produit est disponible et la promo s'applique
    const storeId: StoreId =
      p.store !== 'all'
        ? p.store
        : (ALL_STORE_IDS.find(sid => v.prices[sid] !== undefined) ?? 'leclerc');

    const currentQty = item.qty;
    const suggestedQty = currentQty + 1;

    const resCurrent = getBestNetPrice(v, storeId, currentQty);
    const resNext    = getBestNetPrice(v, storeId, suggestedQty);
    if (!resCurrent || !resNext) continue;

    // Baisse de prix unitaire
    const unitDrop = resCurrent.netPrice - resNext.netPrice;
    const dropPct  = resCurrent.netPrice > 0 ? unitDrop / resCurrent.netPrice : 0;
    if (dropPct < 0.05) continue; // < 5% → pas significatif

    // Économie additionnelle totale (vs acheter suggestedQty au plein tarif)
    const savingDelta = Math.round(
      (resNext.totalSaving_qty - resCurrent.totalSaving_qty) * 100
    ) / 100;
    if (savingDelta <= 0) continue;

    nudges.push({
      groupId: item.groupId,
      genericName: item.genericName,
      emoji: item.emoji,
      currentQty,
      suggestedQty,
      unitPriceBefore: resCurrent.netPrice,
      unitPriceAfter:  resNext.netPrice,
      savingDelta,
      dropPct: Math.round(dropPct * 100),
      promoLabel: p.label,
    });
  }

  return nudges;
}
