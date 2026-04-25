#!/usr/bin/env tsx
/**
 * SmartHunt — Bridge d'ingestion initiale
 *
 * Convertit la base statique locale (data/productsDB.ts)
 * au format attendu par POST /v1/internal/update-prices
 * et pousse les données vers le backend.
 *
 * Usage :
 *   INTERNAL_API_KEY=xxx API_URL=http://localhost:3000 npx tsx src/bridge.ts
 *
 * En production :
 *   INTERNAL_API_KEY=xxx API_URL=https://<railway-url> npx tsx src/bridge.ts
 */

import path from 'path';
import { fileURLToPath } from 'url';

// ─── Résolution du chemin vers data/productsDB.ts ─────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Remonte de scraper/src/ → backend/ → Smarthunt/ → data/
const DB_PATH = path.resolve(__dirname, '../../../data/productsDB.ts');

// ─── Config ───────────────────────────────────────────────────────────────────

const API_URL        = process.env.API_URL        ?? 'http://localhost:3000';
const INTERNAL_KEY   = process.env.INTERNAL_API_KEY;
const BATCH_SIZE     = 5; // groupes par requête — petits batches pour éviter les timeouts

if (!INTERNAL_KEY) {
  console.error('❌  INTERNAL_API_KEY manquante.');
  process.exit(1);
}

// ─── Import dynamique de la base statique ────────────────────────────────────
// On utilise `require` via tsx pour pouvoir importer du TS non compilé.

type ProductDB = Awaited<typeof import('../../../data/productsDB')>;

async function loadStaticDB(): Promise<ProductDB['PRODUCTS_DB']> {
  // tsx résout les imports TS natifs — pas besoin de compiler
  const mod = await import(DB_PATH) as ProductDB;
  return mod.PRODUCTS_DB;
}

async function loadStoresConfig(): Promise<ProductDB['STORES_CONFIG']> {
  const mod = await import(DB_PATH) as ProductDB;
  return mod.STORES_CONFIG;
}

// ─── Seed enseignes ───────────────────────────────────────────────────────────

async function seedStores(storesConfig: ProductDB['STORES_CONFIG']) {
  const stores = Object.values(storesConfig).map(s => ({
    id:    s.id,
    name:  s.label,
    color: s.color,
    lat:   s.coords.lat,
    lng:   s.coords.lng,
  }));

  const res = await fetch(`${API_URL}/v1/internal/seed-stores`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${INTERNAL_KEY}`,
    },
    body: JSON.stringify({ stores }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`seed-stores HTTP ${res.status}: ${body}`);
  }

  const json = await res.json() as { ok: boolean; upserted: number };
  console.log(`   ✓ ${json.upserted} enseignes seedées.\n`);
}

// ─── Transformation ProductGroup → payload API ───────────────────────────────

function transformGroup(group: ProductDB['PRODUCTS_DB'][number]) {
  const variants = Object.entries(group.variants).map(([, variant]) => {
    if (!variant) return null;

    const priceValues = Object.values(variant.prices).filter(
      (p): p is number => typeof p === 'number',
    );
    // basePrice = moyenne des prix disponibles (fallback sur 0)
    const basePrice = priceValues.length > 0
      ? Math.round((priceValues.reduce((a, b) => a + b, 0) / priceValues.length) * 100) / 100
      : 0;

    return {
      ean:          variant.ean,
      brand:        variant.brand,
      name:         variant.brand + ' ' + group.genericName,
      segment:      variant.type,
      basePrice:    basePrice,
      pricePerUnit: variant.price_per_unit,
      unitRef:      variant.unit_ref,
      prices:       Object.fromEntries(
        Object.entries(variant.prices).filter(([, v]) => v !== undefined),
      ) as Record<string, number>,
      ...(variant.in_stock && { in_stock: variant.in_stock as Record<string, boolean> }),
      ...(variant.catalogue_promo && {
        promo: {
          type:    variant.catalogue_promo.type,
          value:   variant.catalogue_promo.value,
          label:   variant.catalogue_promo.label,
          store:   variant.catalogue_promo.store,
          ...(variant.catalogue_promo.minQty !== undefined && {
            minQty: variant.catalogue_promo.minQty,
          }),
        },
      }),
      ...(variant.cashback_app && {
        cashback: {
          app:    variant.cashback_app.app,
          amount: variant.cashback_app.amount,
          label:  variant.cashback_app.label,
        },
      }),
    };
  }).filter(Boolean);

  if (variants.length === 0) return null;

  return {
    groupId:         group.groupId,
    genericName:     group.genericName,
    emoji:           group.emoji,
    ...(group.imageUrl && { imageUrl: group.imageUrl }),
    categorySlug:    group.categorySlug,
    subcategorySlug: group.subcategorySlug,
    equivalenceKey:  group.equivalence_key,
    unitSize:        group.unit_size,
    unitType:        group.unit_type,
    variants,
  };
}

// ─── Envoi par batch ──────────────────────────────────────────────────────────

async function sendBatch(products: ReturnType<typeof transformGroup>[]) {
  const res = await fetch(`${API_URL}/v1/internal/update-prices`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${INTERNAL_KEY}`,
    },
    body: JSON.stringify({ products }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  return res.json() as Promise<{
    ok: boolean;
    upsertedGroups: number;
    upsertedVariants: number;
    upsertedPrices: number;
  }>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🔗  Bridge SmartHunt → ${API_URL}`);
  console.log(`📦  Chargement de la base statique...`);

  // 0. Seed enseignes (requis avant les store_prices)
  console.log(`🏪  Seeding des enseignes...`);
  const storesConfig = await loadStoresConfig();
  await seedStores(storesConfig);

  const db = await loadStaticDB();
  console.log(`   ${db.length} groupes produits trouvés.\n`);

  // Transforme et filtre les groupes vides
  const payload = db.map(transformGroup).filter(Boolean) as NonNullable<ReturnType<typeof transformGroup>>[];
  console.log(`   ${payload.length} groupes valides à envoyer.\n`);

  // Découpe en batches
  const batches: typeof payload[] = [];
  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    batches.push(payload.slice(i, i + BATCH_SIZE));
  }

  let totalGroups = 0, totalVariants = 0, totalPrices = 0;

  for (let i = 0; i < batches.length; i++) {
    process.stdout.write(`   Batch ${i + 1}/${batches.length}... `);
    try {
      const result = await sendBatch(batches[i]);
      totalGroups   += result.upsertedGroups;
      totalVariants += result.upsertedVariants;
      totalPrices   += result.upsertedPrices;
      console.log(`✓ (${result.upsertedGroups} groupes, ${result.upsertedVariants} variantes)`);
    } catch (err) {
      console.error(`\n❌  Erreur batch ${i + 1}:`, (err as Error).message);
      process.exit(1);
    }
  }

  console.log(`
✅  Import terminé !
   ${totalGroups} groupes produits
   ${totalVariants} variantes
   ${totalPrices} prix en enseigne`);
}

main().catch(err => {
  console.error('❌  Erreur fatale:', err);
  process.exit(1);
});
