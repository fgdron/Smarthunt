#!/usr/bin/env tsx
/**
 * SmartHunt — Runner scraper Nantes Métropole
 *
 * Modes :
 *   --daily    : Open Prices (prix du jour) + Lidl promos [défaut]
 *   --weekly   : Open Prices + Lidl promos + recharge complète
 *   --stores   : Seed uniquement les magasins Nantes
 *   --openprices : Open Prices uniquement
 *   --lidl     : Lidl uniquement
 *
 * Usage :
 *   INTERNAL_API_KEY=xxx API_URL=https://xxx.railway.app npx tsx src/run.ts --daily
 */

import { toSeedPayload, NANTES_STORES } from './stores/nantes.js';
import { scrapeOpenPrices, StorePriceEntry } from './scrapers/openprices.js';
import { scrapeLidlPromos }                  from './scrapers/lidl.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const API_URL      = process.env.API_URL ?? 'http://localhost:3000';
const API_KEY      = process.env.INTERNAL_API_KEY;
const BATCH_SIZE   = 200;  // prix par requête vers le backend
const args         = process.argv.slice(2);
const mode         = args.find(a => a.startsWith('--'))?.slice(2) ?? 'daily';

if (!API_KEY) {
  console.error('❌  INTERNAL_API_KEY manquante');
  process.exit(1);
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ─── Steps ────────────────────────────────────────────────────────────────────

/** Seed les magasins Nantes en base */
async function seedStores() {
  console.log('\n🏪 Seed magasins Nantes Métropole…');
  const payload = toSeedPayload();
  const result  = await apiPost('/v1/internal/seed-stores', payload) as { upserted: number };
  console.log(`  ✓ ${result.upserted} magasins upsertés`);
}

/** Push les entrées prix vers le backend par batches */
async function pushPrices(entries: StorePriceEntry[], source: string) {
  if (entries.length === 0) {
    console.log(`  ⚠️  Aucune entrée à pusher pour ${source}`);
    return;
  }

  console.log(`\n📤 Push ${entries.length} prix (source: ${source}) par batches de ${BATCH_SIZE}…`);
  let totalUpdated = 0, totalSkipped = 0, totalPromos = 0;
  const batches = Math.ceil(entries.length / BATCH_SIZE);

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch  = entries.slice(i, i + BATCH_SIZE);
    const batchN = Math.floor(i / BATCH_SIZE) + 1;

    try {
      const res = await apiPost('/v1/internal/upsert-store-prices', {
        source,
        prices: batch,
      }) as { updated: number; skipped: number; promosSet: number };

      totalUpdated += res.updated ?? 0;
      totalSkipped += res.skipped ?? 0;
      totalPromos  += res.promosSet ?? 0;
      process.stdout.write(`\r  ⏳ Batch ${batchN}/${batches} — ${totalUpdated} màj, ${totalSkipped} skip, ${totalPromos} promos`);
    } catch (err) {
      console.error(`\n  ❌ Erreur batch ${batchN}:`, err);
    }
  }

  console.log(`\n  ✅ ${source} terminé : ${totalUpdated} prix màj, ${totalSkipped} EAN inconnus, ${totalPromos} promos`);
}

/** Affiche un résumé post-run */
async function printSummary() {
  try {
    const res = await fetch(`${API_URL}/v1/internal/ping-db`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    });
    const data = await res.json() as { stores: number; groups: number };
    console.log(`\n📊 État DB : ${data.groups} groupes produits · ${data.stores} magasins`);
  } catch { /* silencieux */ }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log('═══════════════════════════════════════════════════');
  console.log(`🚀 SmartHunt Scraper — mode: ${mode.toUpperCase()}`);
  console.log(`   ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`);
  console.log(`   Backend: ${API_URL}`);
  console.log(`   Magasins: ${NANTES_STORES.length} (Nantes Métropole)`);
  console.log('═══════════════════════════════════════════════════');

  try {
    switch (mode) {

      case 'stores':
        await seedStores();
        break;

      case 'openprices': {
        await seedStores();
        const entries = await scrapeOpenPrices(['leclerc', 'carrefour', 'lidl']);
        await pushPrices(entries, 'openprices');
        break;
      }

      case 'lidl': {
        await seedStores();
        const entries = await scrapeLidlPromos();
        await pushPrices(entries, 'lidl');
        break;
      }

      case 'daily':
      default: {
        // 1. Seed stores (idempotent)
        await seedStores();

        // 2. Open Prices — tous les magasins (prix + promos détectées)
        const openPricesEntries = await scrapeOpenPrices(['leclerc', 'carrefour', 'lidl']);
        await pushPrices(openPricesEntries, 'openprices');

        // 3. Lidl promos hebdo (enrichit les prix Lidl déjà en base)
        const lidlEntries = await scrapeLidlPromos();
        await pushPrices(lidlEntries, 'lidl-promos');
        break;
      }
    }

    await printSummary();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Terminé en ${elapsed}s`);
    console.log('═══════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n💥 Erreur fatale:', err);
    process.exit(1);
  }
}

main();
