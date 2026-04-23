import { ProductGroup, SegmentType, StoreId } from '@/data/productsDB';
import { getBestNetPrice } from './netPrice';

// ─── Substitution inter-variantes ──────────────────────────────
// For a given product group, finds cheaper variants of other types
// available at the target store — enables "Marque vs MDD" arbitrage.

export interface CrossStoreEquivalent {
  variantType: SegmentType;
  brand: string;
  netPrice: number;
  pricePerUnit: number;
  unitRef: string;
  saving: number;
}

export function getCrossStoreEquivalents(
  group: ProductGroup,
  selectedType: SegmentType,
  targetStoreId: StoreId,
  originalNetPrice: number,
): CrossStoreEquivalent[] {
  const results: CrossStoreEquivalent[] = [];

  for (const [typeStr, variant] of Object.entries(group.variants)) {
    const type = typeStr as SegmentType;
    if (type === selectedType || !variant) continue;
    const res = getBestNetPrice(variant, targetStoreId);
    if (!res) continue;
    const saving = Math.round((originalNetPrice - res.netPrice) * 100) / 100;
    if (saving > 0.10) {
      results.push({
        variantType: type,
        brand: variant.brand,
        netPrice: res.netPrice,
        pricePerUnit: variant.price_per_unit,
        unitRef: group.unit_type,
        saving,
      });
    }
  }

  return results.sort((a, b) => a.netPrice - b.netPrice);
}
